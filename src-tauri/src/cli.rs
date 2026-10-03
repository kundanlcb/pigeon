use clap::{Parser, Subcommand};
use std::fs;
use std::collections::HashMap;

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
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match &cli.command {
        Commands::Run { collection, env, insecure } => {
            println!("Loading collection from: {}", collection);
            let coll_data = fs::read_to_string(collection)?;
            let parsed_coll: serde_json::Value = serde_json::from_str(&coll_data)?;
            
            println!("Collection: {}", parsed_coll["name"].as_str().unwrap_or("Unknown"));
            
            let mut env_vars = HashMap::new();
            if let Some(env_path) = env {
                println!("Loading environment from: {}", env_path);
                let env_data = fs::read_to_string(env_path)?;
                let parsed_env: serde_json::Value = serde_json::from_str(&env_data)?;
                if let Some(vars) = parsed_env["variables"].as_array() {
                    for var in vars {
                        if let (Some(key), Some(value)) = (var["key"].as_str(), var["value"].as_str()) {
                            env_vars.insert(key.to_string(), value.to_string());
                        }
                    }
                }
                println!("Environment loaded.");
            }
            
            let requests = parsed_coll["requests"].as_array();
            if let Some(reqs) = requests {
                println!("Found {} requests. Running sequentially...", reqs.len());
                let client = app_lib::http::build_client(*insecure)?;
                
                for req in reqs {
                    let method = req["method"].as_str().unwrap_or("GET");
                    let mut url = req["url"].as_str().unwrap_or("").to_string();
                    let name = req["name"].as_str().unwrap_or("Unnamed Request");
                    
                    // Basic env replacement for URL
                    for (k, v) in &env_vars {
                        let pat = format!("{{{{{}}}}}", k);
                        url = url.replace(&pat, v);
                    }
                    
                    if url.is_empty() {
                        println!("- [{}] {} skipped (empty URL)", method, name);
                        continue;
                    }
                    
                    let mut headers_map = HashMap::new();
                    if let Some(headers_obj) = req["headers"].as_object() {
                        for (k, v) in headers_obj {
                            if let Some(val_str) = v.as_str() {
                                let mut final_val = val_str.to_string();
                                for (ek, ev) in &env_vars {
                                    let pat = format!("{{{{{}}}}}", ek);
                                    final_val = final_val.replace(&pat, ev);
                                }
                                headers_map.insert(k.clone(), final_val);
                            }
                        }
                    }
                    
                    let mut body = None;
                    if let Some(b) = req["body"].as_str() {
                        let mut final_body = b.to_string();
                        for (k, v) in &env_vars {
                            let pat = format!("{{{{{}}}}}", k);
                            final_body = final_body.replace(&pat, v);
                        }
                        body = Some(final_body);
                    }
                    
                    print!("- [{}] {} {} ... ", method, name, url);
                    use std::io::Write;
                    std::io::stdout().flush()?;
                    
                    let req_start = std::time::Instant::now();
                    let request = app_lib::http::build_request(&client, method, &url, &headers_map, body.as_ref())?;
                    let res = client.execute(request).await;
                    let elapsed = req_start.elapsed().as_millis();
                    
                    match res {
                        Ok(r) => {
                            println!("{} ({}ms)", r.status(), elapsed);
                        }
                        Err(e) => {
                            println!("ERROR: {} ({}ms)", e, elapsed);
                        }
                    }
                }
            } else {
                println!("No requests found in collection.");
            }
            
            println!("Run complete.");
        }
    }
    
    Ok(())
}
