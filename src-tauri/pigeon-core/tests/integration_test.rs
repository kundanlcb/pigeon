use pigeon_core::models::{RequestItem, Environment, EnvironmentVariable, Auth, AppSettings, RequestExecutionResult};
use std::collections::HashMap;

#[tokio::test]
async fn test_request_building_parity() {
    // This test ensures that when executed through pigeon_core, 
    // the request logic (used by both CLI and GUI) behaves consistently.
    
    let mut headers = HashMap::new();
    headers.insert("X-Custom".to_string(), "Value {{my_var}}".to_string());

    let request = RequestItem {
        id: "req-1".to_string(),
        name: "Test OAuth".to_string(),
        folder_id: None,
        order: Some(0),
        method: "GET".to_string(),
        url: "https://api.example.com/data?user={{user_id}}".to_string(),
        headers,
        disabled_headers: Some(vec![]),
        disabled_params: Some(vec![]),
        body: None,
        auth: Some(Auth {
            r#type: "bearer".to_string(),
            bearer_token: Some("token-{{token_var}}".to_string()),
            bearer_token_in_keychain: Some(false),
            bearer_token_keychain_ref: None,
            basic_username: None,
            basic_password: None,
            basic_password_in_keychain: None,
            basic_password_keychain_ref: None,
            api_key_key: None,
            api_key_value: None,
            api_key_value_in_keychain: None,
            api_key_value_keychain_ref: None,
            api_key_in: None,
            token_url: None,
            client_id: None,
            client_secret: None,
            client_secret_in_keychain: None,
            client_secret_keychain_ref: None,
            scope: None,
        }),
        authorization_header_in_keychain: Some(false),
        authorization_header_keychain_ref: None,
        pre_request_script: None,
        test_script: None,
    };

    let env = Environment {
        id: "env-1".to_string(),
        name: "Test Env".to_string(),
        variables: vec![
            EnvironmentVariable {
                id: "var-1".to_string(),
                key: "user_id".to_string(),
                value: "123".to_string(),
                enabled: true,
                secret: Some(false),
                secret_stored: Some(false),
            },
            EnvironmentVariable {
                id: "var-2".to_string(),
                key: "token_var".to_string(),
                value: "abc".to_string(),
                enabled: true,
                secret: Some(false),
                secret_stored: Some(false),
            }
        ],
    };

    let mut local_vars = HashMap::new();
    local_vars.insert("my_var".to_string(), "xyz".to_string());

    let settings = AppSettings {
        insecure_ssl: true,
        request_timeout: 5000,
        max_redirects: 5,
    };

    // Note: To fully verify byte-identical HTTP requests without hitting the network, 
    // we would use the `request_builder` directly.
    let client = reqwest::Client::new();
    let req_builder = pigeon_core::request_builder::build_request(&client, &request, Some(&env), Some(&local_vars)).await.unwrap();
    
    let req = req_builder.build().unwrap();

    assert_eq!(req.url().as_str(), "https://api.example.com/data?user=123");
    assert_eq!(req.headers().get("X-Custom").unwrap().to_str().unwrap(), "Value xyz");
    assert_eq!(req.headers().get("Authorization").unwrap().to_str().unwrap(), "Bearer token-abc");
}

#[tokio::test]
async fn test_timing_plausibility_and_variation() {
    let req1 = RequestItem {
        id: "req-1".to_string(),
        name: "Test Timing 1".to_string(),
        folder_id: None,
        order: None,
        method: "GET".to_string(),
        url: "https://example.com/".to_string(),
        headers: HashMap::new(),
        disabled_headers: None,
        disabled_params: None,
        body: None,
        auth: None,
        authorization_header_in_keychain: None,
        authorization_header_keychain_ref: None,
        pre_request_script: None,
        test_script: None,
    };
    
    // First request to a remote server
    let res1 = pigeon_core::execute_request(&req1, None, None, None).await.unwrap();
    
    // Check invariants
    let d1 = res1.dns_time_ms.unwrap_or(0);
    let c1 = res1.connect_time_ms.unwrap_or(0);
    let t1 = res1.ttfb_time_ms.unwrap_or(0);
    
    assert!(c1 >= d1, "Connect time (which includes DNS phase in underlying reqwest architecture) should be >= DNS time");
    assert!(t1 >= c1, "TTFB should be >= Connect time");
    assert!(res1.time_ms >= t1, "Total time should be >= TTFB");
    
    // Another request to a different host to prove they vary
    let mut req2 = req1.clone();
    req2.url = "https://1.1.1.1/".to_string(); // IP address avoids DNS!
    let res2 = pigeon_core::execute_request(&req2, None, None, None).await.unwrap();
    
    let d2 = res2.dns_time_ms.unwrap_or(0);
    let c2 = res2.connect_time_ms.unwrap_or(0);
    let t2 = res2.ttfb_time_ms.unwrap_or(0);
    
    assert!(c2 >= d2);
    assert!(t2 >= c2);
    assert!(res2.time_ms >= t2);
    
    // DNS time for IP address should be close to 0 (or much faster than example.com)
    // Connect time and TTFB should be genuinely different from the first request
    assert!(d1 != d2 || c1 != c2 || t1 != t2, "Timing values should vary across different network calls");
}
