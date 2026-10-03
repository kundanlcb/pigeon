use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PigeonError {
    pub code: String,
    pub message: String,
    pub remediation: Option<String>,
}

impl PigeonError {
    pub fn new(code: &str, message: &str, remediation: Option<&str>) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            remediation: remediation.map(|s| s.to_string()),
        }
    }

    pub fn auth(message: &str) -> Self {
        Self::new("AUTH_FAILURE", message, None)
    }

    pub fn network(message: &str) -> Self {
        Self::new("NETWORK_FAILURE", message, None)
    }

    pub fn validation(message: &str) -> Self {
        Self::new("VALIDATION_FAILURE", message, None)
    }

    pub fn script(message: &str) -> Self {
        Self::new("SCRIPT_FAILURE", message, None)
    }

    pub fn keychain(message: &str, remediation: Option<&str>) -> Self {
        Self::new("KEYCHAIN_FAILURE", message, remediation)
    }
}

impl std::fmt::Display for PigeonError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)?;
        if let Some(r) = &self.remediation {
            write!(f, "\nHint: {}", r)?;
        }
        Ok(())
    }
}

impl std::error::Error for PigeonError {}

// Automatically implement Into<String> for easy Tauri returning if needed,
// but returning the struct directly is better since we serialize it!
// We can use Result<T, PigeonError> in commands.
