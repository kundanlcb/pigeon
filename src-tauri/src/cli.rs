use clap::{Parser, Subcommand};
use std::fs;
use std::collections::HashMap;
use serde_json::{Value, json};
use std::process::Command;

#[derive(Parser)]
#[command(author, version, about = "Pigeon CLI", long_about = None)]
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
        
        /// Reporter format (text, json, junit)
        #[arg(long, default_value = "text")]
        reporter: String,
    },
}

#[derive(Debug)]
struct RequestResult {
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

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let mut exit_code = 0;

    match &cli.command {
        Commands::Run { collection, env, insecure, secrets, secret_file, reporter } => {
            let coll_data = fs::read_to_string(collection).unwrap_or_else(|e| {
                eprintln!("Failed to read collection file: {}", e);
                std::process::exit(1);
            });
            let parsed_coll: Value = serde_json::from_str(&coll_data).unwrap_or_else(|e| {
                eprintln!("Failed to parse collection JSON: {}", e);
                std::process::exit(1);
            });
            
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

            let mut env_vars = HashMap::new();
            let mut env_id = String::new();
            if let Some(env_path) = env {
                let env_data = fs::read_to_string(env_path).unwrap_or_else(|e| {
                    eprintln!("Failed to read environment file: {}", e);
                    std::process::exit(1);
                });
                let parsed_env: Value = serde_json::from_str(&env_data).unwrap_or_else(|e| {
                    eprintln!("Failed to parse environment JSON: {}", e);
                    std::process::exit(1);
                });
                env_id = parsed_env["id"].as_str().unwrap_or("").to_string();
                if let Some(vars) = parsed_env["variables"].as_array() {
                    for var in vars {
                        let key = var["key"].as_str().unwrap_or("");
                        let is_secret = var["secretStored"].as_bool().unwrap_or(var["secret"].as_bool().unwrap_or(false));
                        let val = if is_secret {
                            if let Some(v) = manual_secrets.get(key) {
                                v.to_string()
                            } else {
                                // Try keychain
                                match keyring::Entry::new(&env_id, key) {
                                    Ok(entry) => match entry.get_password() {
                                        Ok(pw) => pw,
                                        Err(_) => {
                                            eprintln!("Secret '{}' not found in keychain — set it or provide via --secret-override", key);
                                            std::process::exit(1);
                                        }
                                    },
                                    Err(_) => {
                                        eprintln!("Secret '{}' not found in keychain — set it or provide via --secret-override", key);
                                        std::process::exit(1);
                                    }
                                }
                            }
                        } else {
                            var["value"].as_str().unwrap_or("").to_string()
                        };
                        env_vars.insert(key.to_string(), val);
                    }
                }
            }
            
            let mut results = Vec::new();
            let client = app_lib::http::build_client(*insecure).unwrap();
            
            let requests = parsed_coll["requests"].as_array().cloned().unwrap_or_default();
            for req in requests {
                let method = req["method"].as_str().unwrap_or("GET");
                let mut url = req["url"].as_str().unwrap_or("").to_string();
                let name = req["name"].as_str().unwrap_or("Unnamed Request");
                
                for (k, v) in &env_vars {
                    url = url.replace(&format!("{{{{{}}}}}", k), v);
                }
                
                let mut headers_map = HashMap::new();
                if let Some(headers_obj) = req["headers"].as_object() {
                    for (k, v) in headers_obj {
                        if let Some(val_str) = v.as_str() {
                            let mut final_val = val_str.to_string();
                            for (ek, ev) in &env_vars {
                                final_val = final_val.replace(&format!("{{{{{}}}}}", ek), ev);
                            }
                            headers_map.insert(k.clone(), final_val);
                        }
                    }
                }
                
                let mut body = None;
                if let Some(b) = req["body"].as_str() {
                    let mut final_body = b.to_string();
                    for (k, v) in &env_vars {
                        final_body = final_body.replace(&format!("{{{{{}}}}}", k), v);
                    }
                    body = Some(final_body);
                }
                
                let req_start = std::time::Instant::now();
                let request = app_lib::http::build_request(&client, method, &url, &headers_map, body.as_ref());
                
                let mut status = 0;
                let mut time_ms = 0;
                let mut err_msg = None;
                let mut test_results = Vec::new();
                let mut resp_text = String::new();

                match request {
                    Ok(r) => {
                        match client.execute(r).await {
                            Ok(res) => {
                                status = res.status().as_u16();
                                if status >= 400 {
                                    exit_code = 1;
                                    err_msg = Some(format!("HTTP {}", status));
                                }
                                resp_text = res.text().await.unwrap_or_default();
                            }
                            Err(e) => {
                                exit_code = 1;
                                err_msg = Some(e.to_string());
                            }
                        }
                    }
                    Err(e) => {
                        exit_code = 1;
                        err_msg = Some(e);
                    }
                }
                time_ms = req_start.elapsed().as_millis();

                if let Some(script) = req["testScript"].as_str() {
                    // Quick and dirty node.js evaluation for tests
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
                    script_json = serde_json::to_string(script).unwrap(),
                    status = status,
                    resp_json = serde_json::to_string(&resp_text).unwrap(),
                    env_json = serde_json::to_string(&env_vars).unwrap()
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
                    name: name.to_string(),
                    method: method.to_string(),
                    url: url,
                    status,
                    time_ms,
                    error: err_msg,
                    tests: test_results,
                });
            }

            if reporter == "json" {
                let json_output = results.iter().map(|r| {
                    json!({
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
                    println!(r#"    <testcase classname="{}" name="{}" time="{}">"#, r.method, r.name, r.time_ms as f64 / 1000.0);
                    if let Some(err) = &r.error {
                        println!(r#"      <failure message="HTTP Error">{}</failure>"#, err);
                    }
                    for t in &r.tests {
                        if !t.passed {
                            println!(r#"      <failure message="Test Failed">Test '{}' failed: {}</failure>"#, t.name, t.error.as_deref().unwrap_or(""));
                        }
                    }
                    println!(r#"    </testcase>"#);
                }
                println!(r#"  </testsuite>"#);
                println!(r#"</testsuites>"#);
            } else {
                for r in &results {
                    if r.status >= 200 && r.status < 400 && r.error.is_none() {
                        println!("- [{}] {} {} ... {} OK ({}ms)", r.method, r.name, r.url, r.status, r.time_ms);
                    } else {
                        println!("- [{}] {} {} ... ERROR: {} ({}ms)", r.method, r.name, r.url, r.error.as_deref().unwrap_or(&r.status.to_string()), r.time_ms);
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
