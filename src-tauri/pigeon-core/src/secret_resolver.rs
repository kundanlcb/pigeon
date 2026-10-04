use keyring::Entry;
use crate::error::CoreError;

pub fn map_keyring_error(e: keyring::Error) -> CoreError {
    let msg = e.to_string().to_lowercase();
    if msg.contains("denied") || msg.contains("cancel") || msg.contains("not allowed") || msg.contains("rejected") {
        return CoreError::Keychain("Keychain access was denied by the user or OS. Please grant Pigeon permission to access the keychain.".to_string());
    }
    if msg.contains("no storage") || msg.contains("not running") || msg.contains("bus") || msg.contains("could not connect") {
        return CoreError::Keychain("The system keychain service is unavailable. Ensure your OS keychain or secret service is running (e.g., gnome-keyring, kdewallet).".to_string());
    }
    CoreError::Keychain(format!("Failed to interact with keychain: {}", e))
}

fn get_entry(scope: &str, key: &str) -> Result<Entry, CoreError> {
    Entry::new("pigeon", &format!("{}:{}", scope, key)).map_err(map_keyring_error)
}

pub fn get_secret(scope: &str, key: &str) -> Result<Option<String>, CoreError> {
    let entry = get_entry(scope, key)?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(map_keyring_error(e)),
    }
}

pub fn set_secret(scope: &str, key: &str, value: &str) -> Result<(), CoreError> {
    let entry = get_entry(scope, key)?;
    entry.set_password(value).map_err(map_keyring_error)
}

#[cfg(test)]
mod tests {
    // Tests for keychain might fail in CI if there's no keyring, so typically we mock or skip.
}
