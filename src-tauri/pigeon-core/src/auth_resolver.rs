use std::collections::HashMap;
use std::sync::LazyLock;
use std::time::{SystemTime, Duration};
use tokio::sync::Mutex;
use base64::{engine::general_purpose, Engine as _};
use crate::models::{Auth, Environment, AppSettings};
use crate::error::CoreError;
use crate::variable_resolver::resolve_variables;
use crate::secret_resolver::get_secret;
use reqwest::Client;

#[derive(Clone)]
struct OAuthTokenCacheEntry {
    access_token: String,
    expires_at: SystemTime,
}

static TOKEN_CACHE: LazyLock<Mutex<HashMap<String, OAuthTokenCacheEntry>>> = 
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn get_oauth_cache_key(token_url: &str, client_id: &str, scope: &Option<String>) -> String {
    format!(
        "{}:::{}:::{}",
        token_url.trim(),
        client_id.trim(),
        scope.as_deref().unwrap_or("").trim()
    )
}

async fn resolve_oauth2(
    auth: &Auth,
    env: Option<&Environment>,
    local_vars: Option<&HashMap<String, String>>,
    client: &Client,
) -> Result<String, CoreError> {
    let token_url = resolve_variables(auth.token_url.as_deref().unwrap_or(""), env, local_vars);
    if token_url.trim().is_empty() {
        return Err(CoreError::Auth("Token URL is required for OAuth2 Client Credentials.".to_string()));
    }

    let client_id = resolve_variables(auth.client_id.as_deref().unwrap_or(""), env, local_vars);
    if client_id.trim().is_empty() {
        return Err(CoreError::Auth("Client ID is required for OAuth2 Client Credentials.".to_string()));
    }

    let raw_secret = if auth.client_secret_in_keychain.unwrap_or(false) {
        let r = auth.client_secret_keychain_ref.as_deref().unwrap_or("");
        match get_secret("request-auth", r)? {
            Some(s) => s,
            None => return Err(CoreError::Auth("Client secret is missing from the system keychain. Re-enter it in the Auth tab.".to_string())),
        }
    } else {
        auth.client_secret.clone().unwrap_or_default()
    };
    
    let client_secret = resolve_variables(&raw_secret, env, local_vars);
    
    let scope = auth.scope.as_deref().map(|s| resolve_variables(s, env, local_vars));
    
    let cache_key = get_oauth_cache_key(&token_url, &client_id, &scope);
    
    // Check cache
    {
        let mut cache = TOKEN_CACHE.lock().await;
        if let Some(entry) = cache.get(&cache_key) {
            if SystemTime::now() < entry.expires_at {
                return Ok(entry.access_token.clone());
            } else {
                cache.remove(&cache_key);
            }
        }
    }
    
    // Fetch new token
    let mut params = HashMap::new();
    params.insert("grant_type", "client_credentials");
    params.insert("client_id", &client_id);
    params.insert("client_secret", &client_secret);
    if let Some(s) = &scope {
        if !s.trim().is_empty() {
            params.insert("scope", s.trim());
        }
    }

    let res = client.post(&token_url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Accept", "application/json, text/plain, */*")
        .form(&params)
        .send()
        .await
        .map_err(|e| CoreError::Network(format!("OAuth token fetch failed: {}", e)))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(CoreError::Auth(format!("OAuth token fetch failed: {} - {}", status, text)));
    }

    let data: serde_json::Value = res.json().await.map_err(|_| CoreError::Auth("OAuth token fetch failed: response is not valid JSON".to_string()))?;
    
    let access_token = data.get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| CoreError::Auth("OAuth token fetch failed: response missing access_token".to_string()))?;
        
    let expires_in = data.get("expires_in")
        .and_then(|v| v.as_u64())
        .unwrap_or(3600);
        
    let valid_for_seconds = expires_in.saturating_sub(60); // 60s safety margin
    let expires_at = SystemTime::now() + Duration::from_secs(valid_for_seconds);
    
    let mut cache = TOKEN_CACHE.lock().await;
    cache.insert(cache_key, OAuthTokenCacheEntry {
        access_token: access_token.to_string(),
        expires_at,
    });
    
    Ok(access_token.to_string())
}

pub struct ResolvedAuth {
    pub headers: HashMap<String, String>,
    pub query_params: HashMap<String, String>,
}

pub async fn resolve_auth(
    auth_opt: Option<&Auth>,
    env: Option<&Environment>,
    local_vars: Option<&HashMap<String, String>>,
    client: &Client,
) -> Result<ResolvedAuth, CoreError> {
    let mut headers = HashMap::new();
    let mut query_params = HashMap::new();

    if let Some(auth) = auth_opt {
        match auth.r#type.as_str() {
            "bearer" => {
                let token = if auth.bearer_token_in_keychain.unwrap_or(false) {
                    let r = auth.bearer_token_keychain_ref.as_deref().unwrap_or("");
                    match get_secret("request-auth", r)? {
                        Some(s) => s,
                        None => return Err(CoreError::Auth("Bearer token is missing from the system keychain.".to_string())),
                    }
                } else {
                    auth.bearer_token.clone().unwrap_or_default()
                };
                let token = resolve_variables(&token, env, local_vars);
                headers.insert("Authorization".to_string(), format!("Bearer {}", token));
            }
            "basic" => {
                let user = resolve_variables(auth.basic_username.as_deref().unwrap_or(""), env, local_vars);
                let pw = if auth.basic_password_in_keychain.unwrap_or(false) {
                    let r = auth.basic_password_keychain_ref.as_deref().unwrap_or("");
                    match get_secret("request-auth", r)? {
                        Some(s) => s,
                        None => return Err(CoreError::Auth("Basic-auth password is missing from the system keychain.".to_string())),
                    }
                } else {
                    auth.basic_password.clone().unwrap_or_default()
                };
                let pw = resolve_variables(&pw, env, local_vars);
                let b64 = general_purpose::STANDARD.encode(format!("{}:{}", user, pw));
                headers.insert("Authorization".to_string(), format!("Basic {}", b64));
            }
            "api_key" => {
                if let Some(key_name) = &auth.api_key_key {
                    let key = resolve_variables(key_name, env, local_vars);
                    let val = if auth.api_key_value_in_keychain.unwrap_or(false) {
                        let r = auth.api_key_value_keychain_ref.as_deref().unwrap_or("");
                        match get_secret("request-auth", r)? {
                            Some(s) => s,
                            None => return Err(CoreError::Auth("API key value is missing from the system keychain.".to_string())),
                        }
                    } else {
                        auth.api_key_value.clone().unwrap_or_default()
                    };
                    let val = resolve_variables(&val, env, local_vars);
                    
                    if auth.api_key_in.as_deref() == Some("query") {
                        query_params.insert(key, val);
                    } else {
                        headers.insert(key, val);
                    }
                }
            }
            "oauth2_client_credentials" => {
                let token = resolve_oauth2(auth, env, local_vars, client).await?;
                headers.insert("Authorization".to_string(), format!("Bearer {}", token));
            }
            _ => {} // None or unknown
        }
    }

    Ok(ResolvedAuth {
        headers,
        query_params,
    })
}
