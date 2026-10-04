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
