use reqwest::{Client, RequestBuilder, Method, header::{HeaderName, HeaderValue}};
use url::Url;
use std::str::FromStr;
use crate::models::{RequestItem, Environment};
use crate::error::CoreError;
use crate::variable_resolver::resolve_variables;
use crate::auth_resolver::resolve_auth;
use std::collections::HashMap;

pub async fn build_request(
    client: &Client,
    request: &RequestItem,
    env: Option<&Environment>,
    local_vars: Option<&HashMap<String, String>>,
) -> Result<RequestBuilder, CoreError> {
    
    // 1. Resolve URL
    let mut resolved_url = resolve_variables(&request.url, env, local_vars);
    let mut url = Url::parse(&resolved_url).map_err(|e| CoreError::Other(format!("Invalid URL: {}", e)))?;

    // Apply disabled query params
    if let Some(disabled_params) = &request.disabled_params {
        let pairs: Vec<(String, String)> = url.query_pairs().into_owned().collect();
        url.query_pairs_mut().clear();
        for (k, v) in pairs {
            if !disabled_params.contains(&k) {
                url.query_pairs_mut().append_pair(&k, &v);
            }
        }
    }

    // Resolve Auth
    let resolved_auth = resolve_auth(request.auth.as_ref(), env, local_vars, client).await?;

    // Apply auth query params
    if !resolved_auth.query_params.is_empty() {
        for (k, v) in &resolved_auth.query_params {
            url.query_pairs_mut().append_pair(k, v);
        }
    }

    // 2. Resolve Method
    let method = Method::from_bytes(request.method.as_bytes())
        .unwrap_or(Method::GET);

    // 3. Build Headers
    let mut final_headers = reqwest::header::HeaderMap::new();
    
    let disabled_headers = request.disabled_headers.clone().unwrap_or_default();
    let is_disabled = |k: &str| -> bool {
        disabled_headers.iter().any(|d| d.eq_ignore_ascii_case(k))
    };

    // Base headers
    for (k, v) in &request.headers {
        if !is_disabled(k) {
            let res_k = resolve_variables(k, env, local_vars);
            let res_v = resolve_variables(v, env, local_vars);
            if let (Ok(h_name), Ok(h_val)) = (HeaderName::from_str(&res_k), HeaderValue::from_str(&res_v)) {
                final_headers.insert(h_name, h_val);
            }
        }
    }

    // Auth headers
    let auth_disabled = is_disabled("Authorization") || is_disabled("authorization");
    if !auth_disabled {
        for (k, v) in &resolved_auth.headers {
            if let (Ok(h_name), Ok(h_val)) = (HeaderName::from_str(k), HeaderValue::from_str(v)) {
                final_headers.insert(h_name, h_val);
            }
        }
        
        // request.authorization_header_in_keychain override
        if request.authorization_header_in_keychain.unwrap_or(false) {
            let r = request.authorization_header_keychain_ref.as_deref().unwrap_or("");
            if let Some(auth_val) = crate::secret_resolver::get_secret("request-auth", r)? {
                if let Ok(h_val) = HeaderValue::from_str(&auth_val) {
                    final_headers.insert(reqwest::header::AUTHORIZATION, h_val);
                }
            } else {
                return Err(CoreError::Auth("Authorization header is missing from the system keychain. Re-enter it in the Headers tab.".to_string()));
            }
        }
    }

    // 4. Resolve Body
    let mut req_builder = client.request(method, url).headers(final_headers);
    
    if let Some(body_val) = &request.body {
        // If it's a string, just resolve it
        if let Some(s) = body_val.as_str() {
            let resolved_body = resolve_variables(s, env, local_vars);
            req_builder = req_builder.body(resolved_body);
        } else if let Ok(body_obj) = serde_json::from_value::<crate::models::RequestBody>(body_val.clone()) {
            match body_obj.r#type.as_str() {
                "raw" => {
                    if let Some(r) = body_obj.raw {
                        let resolved_body = resolve_variables(&r, env, local_vars);
                        req_builder = req_builder.body(resolved_body);
                    }
                }
                "x-www-form-urlencoded" => {
                    if let Some(pairs) = body_obj.urlencoded {
                        let mut form = HashMap::new();
                        for p in pairs {
                            if p.enabled {
                                let res_k = resolve_variables(&p.key, env, local_vars);
                                let res_v = resolve_variables(&p.value, env, local_vars);
                                form.insert(res_k, res_v);
                            }
                        }
                        req_builder = req_builder.form(&form);
                    }
                }
                "graphql" => {
                    if let Some(gql) = body_obj.graphql {
                        if let Some(query) = gql.get("query").and_then(|v| v.as_str()) {
                            let res_query = resolve_variables(query, env, local_vars);
                            let res_vars = if let Some(v) = gql.get("variables").and_then(|v| v.as_str()) {
                                resolve_variables(v, env, local_vars)
                            } else {
                                "{}".to_string()
                            };
                            // Serialize back to JSON for the body
                            let mut map = HashMap::new();
                            map.insert("query", serde_json::Value::String(res_query));
                            if let Ok(vars_json) = serde_json::from_str::<serde_json::Value>(&res_vars) {
                                map.insert("variables", vars_json);
                            }
                            req_builder = req_builder.json(&map);
                        }
                    }
                }
                "form-data" => {
                    if let Some(pairs) = body_obj.form_data {
                        let mut multipart = reqwest::multipart::Form::new();
                        for p in pairs {
                            if p.enabled {
                                let res_k = resolve_variables(&p.key, env, local_vars);
                                if p.r#type.as_deref() == Some("file") {
                                    // Not fully implemented file reading here, just pass path as string or error
                                    // For full implementation, we'd read the file async
                                } else {
                                    let res_v = resolve_variables(&p.value, env, local_vars);
                                    multipart = multipart.text(res_k, res_v);
                                }
                            }
                        }
                        req_builder = req_builder.multipart(multipart);
                    }
                }
                "binary" => {
                    // Binary path not handled deeply here yet, keeping it simple
                }
                _ => {}
            }
        }
    }

    Ok(req_builder)
}
