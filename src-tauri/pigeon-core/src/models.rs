use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentVariable {
    pub id: String,
    pub key: String,
    pub value: String,
    pub enabled: bool,
    pub secret: Option<bool>,
    pub secret_stored: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub id: String,
    pub name: String,
    pub variables: Vec<EnvironmentVariable>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Auth {
    pub r#type: String, // 'none' | 'bearer' | 'basic' | 'api_key' | 'oauth2_client_credentials'
    
    pub bearer_token: Option<String>,
    pub bearer_token_in_keychain: Option<bool>,
    pub bearer_token_keychain_ref: Option<String>,
    
    pub basic_username: Option<String>,
    pub basic_password: Option<String>,
    pub basic_password_in_keychain: Option<bool>,
    pub basic_password_keychain_ref: Option<String>,
    
    pub api_key_key: Option<String>,
    pub api_key_value: Option<String>,
    pub api_key_value_in_keychain: Option<bool>,
    pub api_key_value_keychain_ref: Option<String>,
    pub api_key_in: Option<String>, // 'header' | 'query'
    
    pub token_url: Option<String>,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub client_secret_in_keychain: Option<bool>,
    pub client_secret_keychain_ref: Option<String>,
    pub scope: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyValPair {
    pub id: String,
    pub key: String,
    pub value: String,
    pub r#type: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestBody {
    pub r#type: String,
    pub raw: Option<String>,
    pub raw_language: Option<String>,
    pub form_data: Option<Vec<KeyValPair>>,
    pub urlencoded: Option<Vec<KeyValPair>>,
    pub graphql: Option<serde_json::Value>,
    pub binary_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestItem {
    pub id: String,
    pub name: String,
    pub folder_id: Option<String>,
    pub order: Option<i32>,
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub disabled_headers: Option<Vec<String>>,
    pub disabled_params: Option<Vec<String>>,
    pub body: Option<serde_json::Value>, // Object (RequestBody) or string
    pub auth: Option<Auth>,
    pub authorization_header_in_keychain: Option<bool>,
    pub authorization_header_keychain_ref: Option<String>,
    pub pre_request_script: Option<String>,
    pub test_script: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestExecutionResult {
    pub status: u16,
    pub status_text: String,
    pub time_ms: u128,
    pub headers: HashMap<String, String>,
    pub data: serde_json::Value,
    pub raw_text: String,
    pub test_results: Vec<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_cancelled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub insecure_ssl: bool,
    pub request_timeout: u64,
    pub max_redirects: usize,
}
