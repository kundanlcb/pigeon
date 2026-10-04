pub mod models;
pub mod error;
pub mod variable_resolver;
pub mod secret_resolver;
pub mod auth_resolver;
pub mod request_builder;
pub mod dataset_parser;

pub mod sandbox;

use std::collections::HashMap;

pub fn find_safe_boundary(bytes: &[u8], cut: usize) -> usize {
    if cut >= bytes.len() {
        return bytes.len();
    }
    
    match std::str::from_utf8(&bytes[..cut]) {
        Ok(_) => cut,
        Err(e) => {
            if e.error_len().is_none() {
                e.valid_up_to()
            } else {
                cut
            }
        }
    }
}
use std::sync::{Arc, Mutex};
use reqwest::ClientBuilder;
use std::time::{Duration, Instant};
use models::{RequestItem, Environment, RequestExecutionResult, AppSettings};
use error::CoreError;
use request_builder::build_request;
use reqwest::dns::{Resolve, Addrs, Name};
use std::future::Future;
use tower::{Layer, Service};
use std::task::{Context, Poll};
use std::pin::Pin;

struct TimedResolver {
    dns_time: Arc<Mutex<Option<u128>>>,
}

impl Resolve for TimedResolver {
    fn resolve(&self, name: Name) -> reqwest::dns::Resolving {
        let dns_time = self.dns_time.clone();
        let name_str = name.as_str().to_string();
        Box::pin(async move {
            let start = Instant::now();
            let mut addrs = vec![];
            if let Ok(lookup) = tokio::net::lookup_host((name_str.as_str(), 0)).await {
                for addr in lookup {
                    addrs.push(addr);
                }
            }
            if let Ok(mut lock) = dns_time.lock() {
                if lock.is_none() {
                    *lock = Some(start.elapsed().as_millis());
                }
            }
            Ok(Box::new(addrs.into_iter()) as Addrs)
        })
    }
}

#[derive(Clone)]
struct TimingLayer {
    connect_time: Arc<Mutex<Option<u128>>>,
}

impl<S> Layer<S> for TimingLayer {
    type Service = TimingService<S>;
    fn layer(&self, inner: S) -> Self::Service {
        TimingService {
            inner,
            connect_time: self.connect_time.clone(),
        }
    }
}

#[derive(Clone)]
struct TimingService<S> {
    inner: S,
    connect_time: Arc<Mutex<Option<u128>>>,
}

impl<S, Req> Service<Req> for TimingService<S>
where
    S: Service<Req>,
    S::Future: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Req) -> Self::Future {
        let connect_time = self.connect_time.clone();
        let start = Instant::now();
        let fut = self.inner.call(req);
        Box::pin(async move {
            let res = fut.await;
            if res.is_ok() {
                if let Ok(mut lock) = connect_time.lock() {
                    if lock.is_none() {
                        *lock = Some(start.elapsed().as_millis());
                    }
                }
            }
            res
        })
    }
}

pub async fn execute_request(
    request: &RequestItem,
    environment: Option<&Environment>,
    local_vars: Option<&HashMap<String, String>>,
    settings: Option<&AppSettings>,
) -> Result<RequestExecutionResult, CoreError> {
    
    let dns_time = Arc::new(Mutex::new(None));
    let connect_time = Arc::new(Mutex::new(None));
    
    // Configure client
    let mut cb = ClientBuilder::new()
        .dns_resolver(Arc::new(TimedResolver { dns_time: dns_time.clone() }))
        .connector_layer(TimingLayer { connect_time: connect_time.clone() });
        
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
        
    let ttfb_ms = start_time.elapsed().as_millis();
    
    let status = response.status().as_u16();
    let status_text = response.status().canonical_reason().unwrap_or("").to_string();
    
    let mut headers = HashMap::new();
    for (k, v) in response.headers() {
        headers.insert(k.as_str().to_string(), v.to_str().unwrap_or("").to_string());
    }
    
    let bytes = response.bytes().await.unwrap_or_default();
    
    let elapsed = start_time.elapsed().as_millis();
    let size_bytes = bytes.len();
    let max_size = 5 * 1024 * 1024; // 5 MB ceiling
    let is_truncated = size_bytes > max_size;
    
    let boundary = find_safe_boundary(&bytes, max_size);
    let byte_slice = &bytes[..boundary];
    
    let (raw_text, data, is_binary) = match std::str::from_utf8(byte_slice) {
        Ok(s) => {
            let parsed = serde_json::from_str(s).unwrap_or(serde_json::Value::String(s.to_string()));
            (s.to_string(), parsed, false)
        },
        Err(_) => {
            (String::new(), serde_json::Value::Null, true)
        }
    };
    
    let d_time = *dns_time.lock().unwrap();
    let c_time = *connect_time.lock().unwrap();

    let mut res = RequestExecutionResult {
        status,
        status_text,
        time_ms: elapsed,
        dns_time_ms: d_time,
        connect_time_ms: c_time,
        ttfb_time_ms: Some(ttfb_ms),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncation_never_splits_utf8_char() {
        let text = "a".repeat(100) + "café" + &"b".repeat(100) + "日本語" + &"c".repeat(100) + "🎉" + &"d".repeat(100);
        let bytes = text.as_bytes();

        for cut in 0..bytes.len() {
            let boundary = find_safe_boundary(bytes, cut);
            assert!(std::str::from_utf8(&bytes[..boundary]).is_ok(),
                "Truncation at swept cut point {} produced boundary {} that still fails UTF-8 decode", cut, boundary);
        }
    }

    #[test]
    fn test_binary_still_fails() {
        let mut binary = vec![0xFF, 0xFE, 0xFD]; // Invalid UTF-8 bytes
        binary.extend_from_slice("café".as_bytes());
        
        let boundary = find_safe_boundary(&binary, 5);
        assert!(std::str::from_utf8(&binary[..boundary]).is_err(), "Binary payload should still fail UTF-8 decode");
    }
}
