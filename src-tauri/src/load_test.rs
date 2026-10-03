use reqwest::Method;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use tokio::time::sleep;

pub struct LoadTestState {
    pub stop_tx: Mutex<Option<tokio::sync::broadcast::Sender<()>>>,
}

impl Default for LoadTestState {
    fn default() -> Self {
        Self {
            stop_tx: Mutex::new(None),
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
pub struct LoadTestTarget {
    pub url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct LoadTestConfig {
    pub targets: Vec<LoadTestTarget>,
    pub strategy: String, // "sequential" or "random"
    pub vus: usize,
    pub duration_sec: u64,
    pub allow_insecure_certs: Option<bool>,
    pub bypass_safety_limits: Option<bool>,
}

#[derive(Serialize, Clone, Default)]
pub struct TargetMetrics {
    pub total_requests: usize,
    pub success_count: usize,
    pub error_count: usize,
    pub rps: f64,
    pub p50_latency_ms: f64,
    pub p90_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub p99_latency_ms: f64,
    pub status_codes: HashMap<u16, usize>,
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
    pub target_metrics: HashMap<usize, TargetMetrics>,
}

#[tauri::command]
pub async fn start_load_test(app: AppHandle, state: State<'_, LoadTestState>, config: LoadTestConfig) -> Result<(), String> {
    if config.targets.is_empty() {
        return Err("No targets provided".to_string());
    }

    if config.vus > 500 && !config.bypass_safety_limits.unwrap_or(false) {
        return Err("VU count exceeds safety limit of 500. You must explicitly acknowledge the risk to proceed.".to_string());
    }

    let accept_invalid = config.allow_insecure_certs.unwrap_or(false);

    let client = crate::http::build_client(accept_invalid)?;

    let mut parsed_targets = vec![];
    for t in &config.targets {
        let method = Method::from_str(&t.method).map_err(|e| e.to_string())?;
        let mut headers = HeaderMap::new();
        for (k, v) in &t.headers {
            if let (Ok(name), Ok(val)) = (HeaderName::from_str(k), HeaderValue::from_str(v)) {
                headers.insert(name, val);
            }
        }
        parsed_targets.push((t.url.clone(), method, headers, t.body.clone()));
    }
    let parsed_targets = Arc::new(parsed_targets);

    let config = Arc::new(config);
    let start_time = Instant::now();
    let duration = Duration::from_secs(config.duration_sec);
    
    // Shared state to collect latencies and status codes per target
    let latencies = Arc::new(Mutex::new(HashMap::<usize, Vec<f64>>::new()));
    let statuses = Arc::new(Mutex::new(HashMap::<usize, HashMap<u16, usize>>::new()));
    let is_running = Arc::new(Mutex::new(true));
    
    // Channel to signal stop
    let (stop_tx, mut main_stop_rx) = tokio::sync::broadcast::channel(1);
    
    // Store stop_tx in state
    *state.stop_tx.lock().unwrap() = Some(stop_tx.clone());

    // Spawn VUs
    let mut vu_handles = vec![];
    for _ in 0..config.vus {
        let client = client.clone();
        let strategy = config.strategy.clone();
        let parsed_targets = Arc::clone(&parsed_targets);
        let latencies = Arc::clone(&latencies);
        let statuses = Arc::clone(&statuses);
        let mut stop_rx = stop_tx.subscribe();

        let handle = tokio::spawn(async move {
            let mut seq_index = 0;
            let mut lcg_state = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos() as u64;
            
            loop {
                // Check if we should stop
                if stop_rx.try_recv().is_ok() {
                    break;
                }
                
                let target_idx = if strategy == "random" {
                    lcg_state = lcg_state.wrapping_mul(6364136223846793005).wrapping_add(1);
                    (lcg_state as usize) % parsed_targets.len()
                } else {
                    let idx = seq_index;
                    seq_index = (seq_index + 1) % parsed_targets.len();
                    idx
                };

                let (url, method, headers, body) = &parsed_targets[target_idx];
                
                let req_start = Instant::now();
                let mut req = client.request(method.clone(), url).headers(headers.clone());
                
                if let Some(b) = body {
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

                // Store metrics per target
                {
                    if let Ok(mut lats) = latencies.lock() {
                        lats.entry(target_idx).or_insert_with(Vec::new).push(elapsed);
                    }
                    if let Ok(mut stats) = statuses.lock() {
                        *stats.entry(target_idx).or_insert_with(HashMap::new).entry(status).or_insert(0) += 1;
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
            let (lats_map, stats_map) = {
                let l = latencies_telemetry.lock().unwrap().clone();
                let s = statuses_telemetry.lock().unwrap().clone();
                (l, s)
            };

            let elapsed_sec = start_time_telemetry.elapsed().as_secs_f64();
            
            let mut global_lats = Vec::new();
            let mut global_stats = HashMap::new();
            let mut target_metrics = HashMap::new();
            
            for (t_idx, mut lats) in lats_map {
                let stats = stats_map.get(&t_idx).cloned().unwrap_or_default();
                
                global_lats.extend(lats.clone());
                
                lats.sort_by(|a, b| a.partial_cmp(b).unwrap());
                let t_total = lats.len();
                let mut t_succ = 0;
                let mut t_err = 0;
                for (code, count) in &stats {
                    *global_stats.entry(*code).or_insert(0) += count;
                    if *code >= 200 && *code < 400 { t_succ += count; } else { t_err += count; }
                }
                
                let t_rps = if elapsed_sec > 0.0 { t_total as f64 / elapsed_sec } else { 0.0 };
                target_metrics.insert(t_idx, TargetMetrics {
                    total_requests: t_total,
                    success_count: t_succ,
                    error_count: t_err,
                    rps: t_rps,
                    p50_latency_ms: percentile(&lats, 0.50),
                    p90_latency_ms: percentile(&lats, 0.90),
                    p95_latency_ms: percentile(&lats, 0.95),
                    p99_latency_ms: percentile(&lats, 0.99),
                    status_codes: stats,
                });
            }

            global_lats.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let global_total = global_lats.len();
            let mut global_succ = 0;
            let mut global_err = 0;
            for (code, count) in &global_stats {
                if *code >= 200 && *code < 400 { global_succ += count; } else { global_err += count; }
            }
            let global_rps = if elapsed_sec > 0.0 { global_total as f64 / elapsed_sec } else { 0.0 };

            let batch = MetricsBatch {
                total_requests: global_total,
                success_count: global_succ,
                error_count: global_err,
                rps: global_rps,
                p50_latency_ms: percentile(&global_lats, 0.50),
                p90_latency_ms: percentile(&global_lats, 0.90),
                p95_latency_ms: percentile(&global_lats, 0.95),
                p99_latency_ms: percentile(&global_lats, 0.99),
                status_codes: global_stats,
                running,
                target_metrics,
            };

            let _ = telemetry_app.emit("load-test-metrics", batch);

            if !running {
                break;
            }
        }
    });

    // Wait for duration or cancellation
    tokio::select! {
        _ = sleep(duration) => {}
        _ = main_stop_rx.recv() => {}
    }
    
    // Stop VUs
    let _ = stop_tx.send(());
    *is_running.lock().unwrap() = false;
    
    // Clear state
    *state.stop_tx.lock().unwrap() = None;
    
    for handle in vu_handles {
        let _ = handle.await;
    }

    Ok(())
}

#[tauri::command]
pub fn stop_load_test(state: State<'_, LoadTestState>) {
    if let Some(tx) = state.stop_tx.lock().unwrap().take() {
        let _ = tx.send(());
    }
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
