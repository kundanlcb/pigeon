pub mod models;
pub mod error;
pub mod variable_resolver;
pub mod secret_resolver;
pub mod auth_resolver;
pub mod request_builder;
pub mod dataset_parser;

pub mod sandbox;

use std::collections::HashMap;
use reqwest::{Client, ClientBuilder};
use std::time::{Duration, Instant};
use models::{RequestItem, Environment, RequestExecutionResult, AppSettings};
use error::CoreError;
use request_builder::build_request;

pub async fn execute_request(
    request: &RequestItem,
    environment: Option<&Environment>,
    local_vars: Option<&HashMap<String, String>>,
    settings: Option<&AppSettings>,
) -> Result<RequestExecutionResult, CoreError> {
    
    // Configure client
    let mut cb = ClientBuilder::new();
    if let Some(s) = settings {
        if s.insecure_ssl {
            cb = cb.danger_accept_invalid_certs(true);
        }
        cb = cb.connect_timeout(Duration::from_millis(s.request_timeout));
        cb = cb.timeout(Duration::from_millis(s.request_timeout));
        
        let policy = if s.max_redirects == 0 {
            reqwest::redirect::Policy::none()
        } else {
            reqwest::redirect::Policy::limited(s.max_redirects)
        };
        cb = cb.redirect(policy);
    }
    
    let client = cb.build().map_err(|e| CoreError::Other(format!("Failed to build client: {}", e)))?;
    
    let req_builder = build_request(&client, request, environment, local_vars).await?;
    
    let start_time = Instant::now();
    
    let response = req_builder.send().await
        .map_err(|e| CoreError::Network(format!("Request failed: {}", e)))?;
        
    let elapsed = start_time.elapsed().as_millis();
    
    let status = response.status().as_u16();
    let status_text = response.status().canonical_reason().unwrap_or("").to_string();
    
    let mut headers = HashMap::new();
    for (k, v) in response.headers() {
        headers.insert(k.as_str().to_string(), v.to_str().unwrap_or("").to_string());
    }
    
    let bytes = response.bytes().await.unwrap_or_default();
    let size_bytes = bytes.len();
    let max_size = 5 * 1024 * 1024; // 5 MB ceiling
    let is_truncated = size_bytes > max_size;
    
    let byte_slice = if is_truncated {
        &bytes[..max_size]
    } else {
        &bytes[..]
    };
    
    let (raw_text, data, is_binary) = match std::str::from_utf8(byte_slice) {
        Ok(s) => {
            let parsed = serde_json::from_str(s).unwrap_or(serde_json::Value::String(s.to_string()));
            (s.to_string(), parsed, false)
        },
        Err(_) => {
            (String::new(), serde_json::Value::Null, true)
        }
    };
    
    let mut res = RequestExecutionResult {
        status,
        status_text,
        time_ms: elapsed,
        headers,
        data,
        raw_text,
        test_results: vec![],
        env_mutations: None,
        is_binary: Some(is_binary),
        size_bytes: Some(size_bytes),
        is_truncated: Some(is_truncated),
        error: None,
        is_cancelled: Some(false),
    };
    
    if let Some(script) = &request.test_script {
        let env_vars = local_vars.cloned().unwrap_or_default();
        let (tests, mutations) = sandbox::execute_test_script(script, request, &res, &env_vars);
        res.test_results = tests;
        res.env_mutations = Some(mutations);
    }
    
    Ok(res)
}
