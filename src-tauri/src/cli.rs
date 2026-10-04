use clap::{Parser, Subcommand};
use std::fs;
use std::collections::HashMap;
use serde_json::{Value, json};
use std::process::Command;
use pigeon_core::models::{RequestItem, Environment, AppSettings};

#[derive(Parser)]
#[command(
    author, 
    version, 
    about = "Pigeon CLI", 
    long_about = "Pigeon Headless CLI runner.\n\nNote: Executing requests that contain test/assertion scripts requires Node.js to be installed on the system."
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run a Pigeon collection
    Run {
        /// Path to the collection JSON file
        collection: String,
        
        /// Optional path to an environment JSON file
        #[arg(short, long)]
        env: Option<String>,
        
        /// Allow insecure certificates
        #[arg(short = 'k', long)]
        insecure: bool,

        /// Inject secret (format: key=value)
        #[arg(long = "secret", value_name = "KEY=VALUE")]
        secrets: Vec<String>,

        /// Path to a JSON file containing secrets (object format)
        #[arg(long = "secret-file", value_name = "FILE")]
        secret_file: Option<String>,
        
        /// Path to a CSV or JSON dataset for data-driven runs
        #[arg(long = "data", value_name = "FILE")]
        data: Option<String>,
        
        /// Reporter format (text, json, junit)
        #[arg(long, default_value = "text")]
        reporter: String,
    },
}

#[derive(Debug)]
struct RequestResult {
    iteration: usize,
    name: String,
    method: String,
    url: String,
    status: u16,
    time_ms: u128,
    error: Option<String>,
    tests: Vec<TestResult>,
}

#[derive(Debug)]
struct TestResult {
    name: String,
    passed: bool,
    error: Option<String>,
}

fn escape_xml(input: &str) -> String {
    input.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
         .replace("\"", "&quot;")
         .replace("'", "&apos;")
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let mut exit_code = 0;

    match &cli.command {
        Commands::Run { collection, env, insecure, secrets, secret_file, data, reporter } => {
            let coll_data = fs::read_to_string(collection).unwrap_or_else(|e| {
                eprintln!("Failed to read collection file: {}", e);
                std::process::exit(1);
            });
            let parsed_coll: Value = serde_json::from_str(&coll_data).unwrap_or_else(|e| {
                eprintln!("Failed to parse collection JSON: {}", e);
                std::process::exit(1);
            });
            
            let dataset_rows = if let Some(data_path) = data {
                let data_content = fs::read_to_string(data_path).unwrap_or_else(|e| {
                    eprintln!("Failed to read dataset file: {}", e);
                    std::process::exit(1);
                });
                let is_csv = data_path.to_lowercase().ends_with(".csv");
                let parsed = pigeon_core::dataset_parser::parse_dataset(&data_content, is_csv).unwrap_or_else(|e| {
                    eprintln!("Failed to parse dataset: {}", e);
                    std::process::exit(1);
                });
                if parsed.is_empty() {
                    eprintln!("Dataset is empty");
                    std::process::exit(1);
                }
                parsed
            } else {
                vec![HashMap::new()]
            };
            
            let mut manual_secrets = HashMap::new();
            if let Some(path) = secret_file {
                if let Ok(data) = fs::read_to_string(path) {
                    if let Ok(Value::Object(obj)) = serde_json::from_str(&data) {
                        for (k, v) in obj {
                            if let Some(s) = v.as_str() {
                                manual_secrets.insert(k, s.to_string());
                            }
                        }
                    }
                }
            }
            for s in secrets {
                if let Some((k, v)) = s.split_once('=') {
                    manual_secrets.insert(k.to_string(), v.to_string());
                }
            }

            let env_model = if let Some(env_path) = env {
                let env_data = fs::read_to_string(env_path).unwrap_or_else(|e| {
                    eprintln!("Failed to read environment file: {}", e);
                    std::process::exit(1);
                });
                Some(serde_json::from_str::<Environment>(&env_data).unwrap_or_else(|e| {
                    eprintln!("Failed to parse environment JSON: {}", e);
                    std::process::exit(1);
                }))
            } else {
                None
            };
            
            let settings = AppSettings {
                insecure_ssl: *insecure,
                request_timeout: 30000,
                max_redirects: 10,
            };

            let mut results = Vec::new();
            
            let requests = parsed_coll["requests"].as_array().cloned().unwrap_or_default();
            for (iter_idx, row_vars) in dataset_rows.into_iter().enumerate() {
                for req in &requests {
                    let request_item: RequestItem = match serde_json::from_value(req.clone()) {
                        Ok(r) => r,
                        Err(e) => {
                            eprintln!("Failed to parse request from collection: {}", e);
                            exit_code = 1;
                            continue;
                        }
                    };

                    let mut test_results = Vec::new();
                    
                    let mut local_vars = manual_secrets.clone();
                    for (k, v) in row_vars.iter() {
                        local_vars.insert(k.clone(), v.clone());
                    }
                    
                    let res = pigeon_core::execute_request(&request_item, env_model.as_ref(), Some(&local_vars), Some(&settings)).await;
                
                let (status, time_ms, err_msg, resp_text) = match res {
                    Ok(r) => {
                        let mut status = r.status;
                        let mut err_msg = None;
                        if status >= 400 {
                            exit_code = 1;
                            err_msg = Some(format!("HTTP {}", status));
                        }
                        (status, r.time_ms, err_msg, r.raw_text)
                    }
                    Err(e) => {
                        exit_code = 1;
                        (0, 0, Some(e.to_string()), String::new())
                    }
                };

                if let Some(script) = request_item.test_script {
                    let env_vars_for_script = env_model.as_ref().map(|e| {
                        let mut map = HashMap::new();
                        for v in &e.variables {
                            map.insert(v.key.clone(), v.value.clone());
                        }
                        map
                    }).unwrap_or_default();

                    let node_script = format!(r#"
                        const script = {script_json};
                        const contextData = {{
                            response: {{ status: {status}, bodyText: {resp_json} }},
                            env: {env_json}
                        }};
                        const results = [];
                        const context = {{
                            response: {{
                                status: contextData.response.status,
                                json: () => JSON.parse(contextData.response.bodyText || '{{}}'),
                                text: () => contextData.response.bodyText || ''
                            }},
                            env: {{
                                get: (k) => contextData.env[k],
                                set: () => {{}}
                            }},
                            test: (name, fn) => {{
                                try {{ fn(); results.push({{ name, passed: true }}); }}
                                catch (e) {{ results.push({{ name, passed: false, error: e.message }}); }}
                            }},
                            expect: (val) => ({{
                                toEqual: (expected) => {{ if (val !== expected) throw new Error(`Expected ${{expected}} but got ${{val}}`); }}
                            }})
                        }};
                        try {{
                            const fn = new Function('pigeon', script);
                            fn(context);
                            console.log(JSON.stringify(results));
                        }} catch (e) {{
                            console.log(JSON.stringify([{{ name: 'Script Execution', passed: false, error: e.message }}]));
                        }}
                    "#, 
                    script_json = serde_json::to_string(&script).unwrap(),
                    status = status,
                    resp_json = serde_json::to_string(&resp_text).unwrap(),
                    env_json = serde_json::to_string(&env_vars_for_script).unwrap()
                    );

                    let output = Command::new("node").arg("-e").arg(&node_script).output();
                    match output {
                        Ok(out) => {
                            if let Ok(parsed) = serde_json::from_slice::<Vec<Value>>(&out.stdout) {
                                for t in parsed {
                                    let passed = t["passed"].as_bool().unwrap_or(false);
                                    if !passed { exit_code = 1; }
                                    test_results.push(TestResult {
                                        name: t["name"].as_str().unwrap_or("Test").to_string(),
                                        passed,
                                        error: t["error"].as_str().map(|s| s.to_string()),
                                    });
                                }
                            }
                        }
                        Err(_) => {
                            test_results.push(TestResult {
                                name: "Node.js Environment".to_string(),
                                passed: false,
                                error: Some("Failed to execute test script because Node.js is not installed".to_string())
                            });
                            exit_code = 1;
                        }
                    }
                }

                results.push(RequestResult {
                    iteration: iter_idx + 1,
                    name: request_item.name,
                    method: request_item.method,
                    url: request_item.url, // Original un-resolved url for display, or resolved if we can extract it. We'll use un-resolved for now.
                    status,
                    time_ms,
                    error: err_msg,
                    tests: test_results,
                });
            }
        }

            if reporter == "json" {
                let json_output = results.iter().map(|r| {
                    json!({
                        "iteration": r.iteration,
                        "name": r.name,
                        "method": r.method,
                        "url": r.url,
                        "status": r.status,
                        "time_ms": r.time_ms,
                        "error": r.error,
                        "tests": r.tests.iter().map(|t| json!({
                            "name": t.name,
                            "passed": t.passed,
                            "error": t.error
                        })).collect::<Vec<_>>()
                    })
                }).collect::<Vec<_>>();
                println!("{}", serde_json::to_string_pretty(&json_output).unwrap());
            } else if reporter == "junit" {
                println!(r#"<?xml version="1.0" encoding="UTF-8"?>"#);
                println!(r#"<testsuites>"#);
                println!(r#"  <testsuite name="Pigeon Collection">"#);
                for r in &results {
                    println!(r#"    <testcase classname="{}" name="Iter {} - {}" time="{}">"#, escape_xml(&r.method), r.iteration, escape_xml(&r.name), r.time_ms as f64 / 1000.0);
                    if let Some(err) = &r.error {
                        println!(r#"      <failure message="HTTP Error">{}</failure>"#, escape_xml(err));
                    }
                    for t in &r.tests {
                        if !t.passed {
                            println!(r#"      <failure message="Test Failed">Test '{}' failed: {}</failure>"#, escape_xml(&t.name), escape_xml(t.error.as_deref().unwrap_or("")));
                        }
                    }
                    println!(r#"    </testcase>"#);
                }
                println!(r#"  </testsuite>"#);
                println!(r#"</testsuites>"#);
            } else {
                for r in &results {
                    let iter_label = if r.iteration > 1 || results.last().map(|x| x.iteration).unwrap_or(1) > 1 {
                        format!("[Iter {}] ", r.iteration)
                    } else {
                        String::new()
                    };
                    
                    if r.status >= 200 && r.status < 400 && r.error.is_none() {
                        println!("- {}{}[{}] {} {} ... {} OK ({}ms)", iter_label, r.method, r.name, r.url, r.status, r.time_ms, "");
                    } else {
                        println!("- {}{}[{}] {} {} ... ERROR: {} ({}ms)", iter_label, r.method, r.name, r.url, r.error.as_deref().unwrap_or(&r.status.to_string()), r.time_ms, "");
                    }
                    for t in &r.tests {
                        if t.passed {
                            println!("  ✓ {}", t.name);
                        } else {
                            println!("  ✗ {} ({})", t.name, t.error.as_deref().unwrap_or(""));
                        }
                    }
                }
            }
        }
    }
    
    std::process::exit(exit_code);
}
