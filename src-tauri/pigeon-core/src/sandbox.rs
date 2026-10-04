use std::time::{Duration, Instant};
use std::collections::HashMap;
use rquickjs::{Context, Runtime};
use serde_json::Value as JsonValue;
use crate::models::{RequestExecutionResult, RequestItem};

pub fn execute_test_script(
    script: &str,
    request: &RequestItem,
    result: &RequestExecutionResult,
    env_vars: &HashMap<String, String>,
) -> (Vec<JsonValue>, HashMap<String, String>) {
    let rt = Runtime::new().unwrap();
    rt.set_memory_limit(10 * 1024 * 1024); // 10MB memory cap
    rt.set_max_stack_size(1024 * 1024);    // 1MB stack cap

    let start_time = Instant::now();
    let timeout = Duration::from_millis(3000); // 3 seconds timeout
    
    // QuickJS interrupt handler
    rt.set_interrupt_handler(Some(Box::new(move || {
        start_time.elapsed() > timeout
    })));

    let ctx = Context::full(&rt).unwrap();

    let wrapper_script = r#"
        function executePigeonScript(userScript, contextDataJson) {
            let __results = [];
            let __envMutations = {};
            let contextData = JSON.parse(contextDataJson);
            function test(name, fn) {
                try {
                    fn();
                    __results.push({name: name, passed: true});
                } catch(e) {
                    __results.push({name: name, passed: false, error: e.message || String(e)});
                }
            }
            function expect(val) {
                return {
                    toEqual: function(expected) {
                        if (val !== expected) throw new Error(`Expected ${expected} but got ${val}`);
                    },
                    toBeGreaterThan: function(expected) {
                        if (val <= expected) throw new Error(`Expected ${val} to be greater than ${expected}`);
                    },
                    toBeLessThan: function(expected) {
                        if (val >= expected) throw new Error(`Expected ${val} to be less than ${expected}`);
                    },
                    toContain: function(expected) {
                        if (typeof val === 'string' || Array.isArray(val)) {
                            if (!val.includes(expected)) throw new Error(`Expected ${val} to contain ${expected}`);
                        } else {
                            throw new Error(`Expected ${val} to contain ${expected}, but it is not a string or array`);
                        }
                    }
                };
            }
            const pigeon = {
                env: {
                    get: (key) => contextData.env[key] || "",
                    set: (key, val) => {
                        contextData.env[key] = val;
                        __envMutations[key] = val;
                    }
                },
                request: contextData.request,
                response: {
                    status: contextData.response.status,
                    json: () => contextData.response.data,
                    text: () => contextData.response.rawText,
                    headers: contextData.response.headers
                }
            };
            
            try {
                const fn = new Function('pigeon', 'test', 'expect', userScript);
                fn(pigeon, test, expect);
            } catch(e) {
                __results.push({name: "Script Execution", passed: false, error: e.message || String(e)});
            }
            return JSON.stringify({ results: __results, envMutations: __envMutations });
        }
    "#;

    let res: rquickjs::Result<String> = ctx.with(|ctx| {
        ctx.eval::<(), _>(wrapper_script)?;

        let func: rquickjs::Function = ctx.globals().get("executePigeonScript")?;
        
        let context_data = serde_json::json!({
            "env": env_vars,
            "request": {
                "url": request.url,
                "method": request.method,
                "headers": request.headers,
                "body": request.body,
            },
            "response": {
                "status": result.status,
                "data": result.data,
                "rawText": result.raw_text,
                "headers": result.headers
            }
        });
        
        let context_json_str = context_data.to_string();

        let json_result: String = func.call((script, context_json_str))?;
        Ok(json_result)
    });

    match res {
        Ok(json_str) => {
            let parsed: JsonValue = serde_json::from_str(&json_str).unwrap_or_else(|_| serde_json::json!({}));
            let results = parsed.get("results").and_then(|v| v.as_array()).cloned().unwrap_or_else(|| {
                vec![serde_json::json!({
                    "name": "Script Execution",
                    "passed": false,
                    "error": "Failed to parse test results from script sandbox."
                })]
            });
            let mut mutations = HashMap::new();
            if let Some(obj) = parsed.get("envMutations").and_then(|v| v.as_object()) {
                for (k, v) in obj {
                    if let Some(s) = v.as_str() {
                        mutations.insert(k.clone(), s.to_string());
                    }
                }
            }
            (results, mutations)
        },
        Err(e) => {
            (vec![serde_json::json!({
                "name": "Script Execution",
                "passed": false,
                "error": format!("Sandbox Execution Error: {}", e)
            })], HashMap::new())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use crate::models::{RequestItem, RequestExecutionResult};

    fn dummy_request() -> RequestItem {
        RequestItem {
            id: "1".to_string(),
            name: "test".to_string(),
            folder_id: None,
            order: None,
            method: "GET".to_string(),
            url: "http://example.com".to_string(),
            headers: HashMap::new(),
            disabled_headers: None,
            disabled_params: None,
            body: None,
            auth: None,
            authorization_header_in_keychain: None,
            authorization_header_keychain_ref: None,
            pre_request_script: None,
            test_script: None,
        }
    }

    fn dummy_result() -> RequestExecutionResult {
        RequestExecutionResult {
            status: 200,
            status_text: "OK".to_string(),
            time_ms: 10,
            headers: HashMap::new(),
            data: serde_json::json!({"foo": "bar"}),
            raw_text: "{\"foo\":\"bar\"}".to_string(),
            test_results: vec![],
            env_mutations: None,
            error: None,
            is_cancelled: Some(false),
        }
    }

    #[test]
    fn test_sandbox_blocks_fs() {
        let script = r#"
            const fs = require('fs');
            fs.readFileSync('/etc/passwd');
        "#;
        let (res, _) = execute_test_script(script, &dummy_request(), &dummy_result(), &HashMap::new());
        assert_eq!(res.len(), 1);
        let err = res[0]["error"].as_str().unwrap();
        assert!(err.contains("require is not defined") || err.contains("not defined"));
    }

    #[test]
    fn test_sandbox_blocks_process_env() {
        let script = r#"
            test("process.env", () => {
                expect(typeof process).toEqual("undefined");
            });
        "#;
        let (res, _) = execute_test_script(script, &dummy_request(), &dummy_result(), &HashMap::new());
        assert_eq!(res.len(), 1);
        println!("RES: {:?}", res);
        assert_eq!(res[0]["passed"], true);
    }

    #[test]
    fn test_sandbox_blocks_child_process() {
        let script = r#"
            const cp = require('child_process');
            cp.execSync('ls');
        "#;
        let (res, _) = execute_test_script(script, &dummy_request(), &dummy_result(), &HashMap::new());
        let err = res[0]["error"].as_str().unwrap();
        assert!(err.contains("require is not defined") || err.contains("not defined"));
    }

    #[test]
    fn test_sandbox_blocks_network() {
        let script = r#"
            test("fetch", () => {
                expect(typeof fetch).toEqual("undefined");
                expect(typeof XMLHttpRequest).toEqual("undefined");
            });
        "#;
        let (res, _) = execute_test_script(script, &dummy_request(), &dummy_result(), &HashMap::new());
        println!("RES: {:?}", res);
        assert_eq!(res[0]["passed"], true);
    }

    #[test]
    fn test_sandbox_allows_intended_operations() {
        let script = r#"
            test("Response status is 200", () => {
                expect(pigeon.response.status).toEqual(200);
            });
            test("Response body has foo=bar", () => {
                expect(pigeon.response.json().foo).toEqual("bar");
            });
            test("Environment variable is accessible", () => {
                expect(pigeon.env.get("MY_VAR")).toEqual("secret123");
                pigeon.env.set("MY_VAR", "new_val");
            });
        "#;
        let mut env_vars = HashMap::new();
        env_vars.insert("MY_VAR".to_string(), "secret123".to_string());
        
        let (res, mutations) = execute_test_script(script, &dummy_request(), &dummy_result(), &env_vars);
        println!("RES: {:?}", res);
        assert_eq!(res.len(), 3);
        for t in res {
            assert_eq!(t["passed"], true);
        }
        
        let mut expected_mutations = HashMap::new();
        expected_mutations.insert("MY_VAR".to_string(), "new_val".to_string());
        assert_eq!(mutations, expected_mutations);
    }
}
