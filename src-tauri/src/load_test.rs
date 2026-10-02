use reqwest::{Client, Method, header::{HeaderMap, HeaderName, HeaderValue}};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use std::sync::{Arc, Mutex};
use std::str::FromStr;
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;
use std::collections::HashMap;

#[derive(Deserialize, Debug, Clone)]
pub struct LoadTestConfig {
    pub url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub vus: usize,
    pub duration_sec: u64,
}

#[derive(Serialize, Clone, Default)]
pub struct MetricsBatch {
    pub total_requests: usize,
    pub success_count: usize,
    pub error_count: usize,
    pub rps: f64,
    pub p50_latency_ms: f64,
    pub p90_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub p99_latency_ms: f64,
    pub status_codes: HashMap<u16, usize>,
    pub running: bool,
}

#[tauri::command]
pub async fn start_load_test(app: AppHandle, config: LoadTestConfig) -> Result<(), String> {
    let method = Method::from_str(&config.method).map_err(|e| e.to_string())?;
    
    let mut headers = HeaderMap::new();
    for (k, v) in &config.headers {
        if let (Ok(name), Ok(val)) = (HeaderName::from_str(k), HeaderValue::from_str(v)) {
            headers.insert(name, val);
        }
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    let config = Arc::new(config);
    let start_time = Instant::now();
    let duration = Duration::from_secs(config.duration_sec);
    
    // Shared state to collect latencies and status codes
    let latencies = Arc::new(Mutex::new(Vec::new()));
    let statuses = Arc::new(Mutex::new(HashMap::new()));
    let is_running = Arc::new(Mutex::new(true));
    
    // Channel to signal stop
    let (stop_tx, _) = tokio::sync::broadcast::channel(1);

    // Spawn VUs
    let mut vu_handles = vec![];
    for _ in 0..config.vus {
        let client = client.clone();
        let config = Arc::clone(&config);
        let latencies = Arc::clone(&latencies);
        let statuses = Arc::clone(&statuses);
        let method = method.clone();
        let headers = headers.clone();
        let mut stop_rx = stop_tx.subscribe();

        let handle = tokio::spawn(async move {
            loop {
                // Check if we should stop
                if stop_rx.try_recv().is_ok() {
                    break;
                }
                
                let req_start = Instant::now();
                let mut req = client.request(method.clone(), &config.url).headers(headers.clone());
                
                if let Some(b) = &config.body {
                    if !b.is_empty() {
                        req = req.body(b.clone());
                    }
                }

                let res = req.send().await;
                let elapsed = req_start.elapsed().as_millis() as f64;
                
                let status = match res {
                    Ok(r) => r.status().as_u16(),
                    Err(_) => 0, // Network error
                };

                // Store metrics
                {
                    if let Ok(mut lats) = latencies.lock() {
                        lats.push(elapsed);
                    }
                    if let Ok(mut stats) = statuses.lock() {
                        *stats.entry(status).or_insert(0) += 1;
                    }
                }
                
                // Yield to scheduler slightly to prevent total starvation if immediate local fail
                tokio::task::yield_now().await;
            }
        });
        vu_handles.push(handle);
    }

    // Telemetry loop
    let telemetry_app = app.clone();
    let latencies_telemetry = Arc::clone(&latencies);
    let statuses_telemetry = Arc::clone(&statuses);
    let running_telemetry = Arc::clone(&is_running);
    let start_time_telemetry = start_time.clone();

    tokio::spawn(async move {
        loop {
            sleep(Duration::from_millis(500)).await;
            
            let running = *running_telemetry.lock().unwrap();
            
            // Calculate metrics
            let (mut lats, stats) = {
                let l = latencies_telemetry.lock().unwrap().clone();
                let s = statuses_telemetry.lock().unwrap().clone();
                (l, s)
            };

            lats.sort_by(|a, b| a.partial_cmp(b).unwrap());
            
            let total_requests = lats.len();
            let mut success_count = 0;
            let mut error_count = 0;
            
            for (code, count) in &stats {
                if *code >= 200 && *code < 400 {
                    success_count += count;
                } else {
                    error_count += count;
                }
            }

            let elapsed_sec = start_time_telemetry.elapsed().as_secs_f64();
            let rps = if elapsed_sec > 0.0 { total_requests as f64 / elapsed_sec } else { 0.0 };

            let p50 = percentile(&lats, 0.50);
            let p90 = percentile(&lats, 0.90);
            let p95 = percentile(&lats, 0.95);
            let p99 = percentile(&lats, 0.99);

            let batch = MetricsBatch {
                total_requests,
                success_count,
                error_count,
                rps,
                p50_latency_ms: p50,
                p90_latency_ms: p90,
                p95_latency_ms: p95,
                p99_latency_ms: p99,
                status_codes: stats,
                running,
            };

            let _ = telemetry_app.emit("load-test-metrics", batch);

            if !running {
                break;
            }
        }
    });

    // Wait for duration
    sleep(duration).await;
    
    // Stop VUs
    let _ = stop_tx.send(());
    *is_running.lock().unwrap() = false;
    
    for handle in vu_handles {
        let _ = handle.await;
    }

    Ok(())
}

fn percentile(sorted_data: &Vec<f64>, p: f64) -> f64 {
    if sorted_data.is_empty() { return 0.0; }
    if sorted_data.len() == 1 { return sorted_data[0]; }
    
    let index = (sorted_data.len() - 1) as f64 * p;
    let lower = index.floor() as usize;
    let upper = index.ceil() as usize;
    let weight = index - lower as f64;
    
    if lower == upper {
        return sorted_data[lower];
    }
    
    sorted_data[lower] * (1.0 - weight) + sorted_data[upper] * weight
}
