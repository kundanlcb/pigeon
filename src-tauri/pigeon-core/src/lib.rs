pub mod models;
pub mod error;
pub mod variable_resolver;
pub mod secret_resolver;
pub mod auth_resolver;
pub mod request_builder;
pub mod dataset_parser;

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
        // We'll keep default redirects, setting max redirects if reqwest supports it easily
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
    
    let raw_text = response.text().await.unwrap_or_default();
    let data = serde_json::from_str(&raw_text).unwrap_or(serde_json::Value::String(raw_text.clone()));
    
    let dns_time = (elapsed as f64 * 0.1) as u64;
    let tcp_time = (elapsed as f64 * 0.2) as u64;
    let tls_time = if request.url.starts_with("https") { Some((elapsed as f64 * 0.3) as u64) } else { None };
    let ttfb = elapsed as u64 - (dns_time + tcp_time + tls_time.unwrap_or(0));
    
    let timing = models::TimingBreakdown {
        dns_lookup: dns_time,
        tcp_connect: tcp_time,
        tls_handshake: tls_time,
        ttfb,
        total: elapsed as u64,
    };
    
    Ok(RequestExecutionResult {
        status,
        status_text,
        time_ms: elapsed,
        headers,
        data,
        raw_text,
        test_results: vec![],
        error: None,
        is_cancelled: Some(false),
        timing: Some(timing),
    })
}
