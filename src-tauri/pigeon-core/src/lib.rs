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
use std::sync::{Arc, Mutex, OnceLock};
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

#[derive(Default, Clone, Copy, Debug)]
pub struct TimingData {
    pub dns_time_ms: Option<u128>,
    pub connect_time_ms: Option<u128>,
}

tokio::task_local! {
    static TIMING: Arc<Mutex<TimingData>>;
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
struct ClientKey {
    insecure_ssl: Option<bool>,
    request_timeout: Option<u64>,
    max_redirects: Option<usize>,
}

impl From<Option<&AppSettings>> for ClientKey {
    fn from(settings: Option<&AppSettings>) -> Self {
        match settings {
            Some(s) => ClientKey {
                insecure_ssl: Some(s.insecure_ssl),
                request_timeout: Some(s.request_timeout),
                max_redirects: Some(s.max_redirects),
            },
            None => ClientKey {
                insecure_ssl: None,
                request_timeout: None,
                max_redirects: None,
            },
        }
    }
}

static CLIENT_CACHE: OnceLock<Mutex<HashMap<ClientKey, reqwest::Client>>> = OnceLock::new();

struct TimedResolver;

impl Resolve for TimedResolver {
    fn resolve(&self, name: Name) -> reqwest::dns::Resolving {
        let name_str = name.as_str().to_string();
        Box::pin(async move {
            let start = Instant::now();
            let mut addrs = vec![];
            if let Ok(lookup) = tokio::net::lookup_host((name_str.as_str(), 0)).await {
                for addr in lookup {
                    addrs.push(addr);
                }
            }
            
            let _ = TIMING.try_with(|timing| {
                if let Ok(mut lock) = timing.lock() {
                    if lock.dns_time_ms.is_none() {
                        lock.dns_time_ms = Some(start.elapsed().as_millis());
                    }
                }
            });
            
            Ok(Box::new(addrs.into_iter()) as Addrs)
        })
    }
}

#[derive(Clone)]
struct TimingLayer;

impl<S> Layer<S> for TimingLayer {
    type Service = TimingService<S>;
    fn layer(&self, inner: S) -> Self::Service {
        TimingService {
            inner,
        }
    }
}

#[derive(Clone)]
struct TimingService<S> {
    inner: S,
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
        let start = Instant::now();
        let fut = self.inner.call(req);
        Box::pin(async move {
            let res = fut.await;
            if res.is_ok() {
                let err = TIMING.try_with(|timing| {
                    if let Ok(mut lock) = timing.lock() {
                        if lock.connect_time_ms.is_none() {
                            lock.connect_time_ms = Some(start.elapsed().as_millis());
                        }
                    }
                });
                if err.is_err() {
                    println!("TIMING.try_with failed in TimingService!");
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
    let key = ClientKey::from(settings);
    
    let cache = CLIENT_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    
    let client = {
        let mut lock = cache.lock().unwrap();
        if !lock.contains_key(&key) {
            if lock.len() >= 100 {
                lock.clear(); // Simple eviction to prevent unbounded growth
            }
            let mut cb = ClientBuilder::new()
                .dns_resolver(Arc::new(TimedResolver))
                .connector_layer(TimingLayer);
                
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
            
            let c = cb.build().map_err(|e| CoreError::Other(format!("Failed to build client: {}", e)))?;
            lock.insert(key.clone(), c);
        }
        lock.get(&key).unwrap().clone()
    };
    
    let req_builder = build_request(&client, request, environment, local_vars).await?;
    
    let timing_data = Arc::new(Mutex::new(TimingData::default()));
    
    let response_result = TIMING.scope(timing_data.clone(), async {
        let start_time = Instant::now();
        
        let response = req_builder.send().await
            .map_err(|e| CoreError::Network(format!("Request failed: {}", e)))?;
            
        let ttfb_ms = start_time.elapsed().as_millis();
        let elapsed = start_time.elapsed().as_millis();
        
        Ok::<_, CoreError>((response, ttfb_ms, elapsed))
    }).await;
    
    let (response, ttfb_ms, elapsed) = response_result?;
    
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
    
    let (d_time, c_time) = {
        let lock = timing_data.lock().unwrap();
        (lock.dns_time_ms, lock.connect_time_ms)
    };

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
