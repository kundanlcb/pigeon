use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum CoreError {
    Keychain(String),
    Network(String),
    Config(String),
    Auth(String),
    Other(String),
}

impl std::fmt::Display for CoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CoreError::Keychain(msg) => write!(f, "Keychain Error: {}", msg),
            CoreError::Network(msg) => write!(f, "Network Error: {}", msg),
            CoreError::Config(msg) => write!(f, "Config Error: {}", msg),
            CoreError::Auth(msg) => write!(f, "Auth Error: {}", msg),
            CoreError::Other(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for CoreError {}
