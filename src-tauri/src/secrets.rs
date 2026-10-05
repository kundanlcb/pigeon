use keyring::Entry;
use crate::error::PigeonError;

fn map_keyring_error(e: keyring::Error) -> PigeonError {
    let msg = e.to_string().to_lowercase();
    if msg.contains("denied") || msg.contains("cancel") || msg.contains("not allowed") || msg.contains("rejected") {
        return PigeonError::keychain("Keychain access was denied by the user or OS.", Some("Please grant Pigeon permission to access the keychain."));
    }
    if msg.contains("no storage") || msg.contains("not running") || msg.contains("bus") || msg.contains("could not connect") {
        return PigeonError::keychain("The system keychain service is unavailable.", Some("Ensure your OS keychain or secret service is running (e.g., gnome-keyring, kdewallet)."));
    }
    PigeonError::keychain(&format!("Failed to interact with keychain: {}", e), None)
}

fn get_entry(scope: &str, key: &str) -> Result<Entry, PigeonError> {
    let lookup = format!("{scope}:{key}");
    println!("[Keychain] Looking up: pigeon / {}", lookup);
    Entry::new("pigeon", &lookup).map_err(map_keyring_error)
}

#[tauri::command]
pub fn set_secret(scope: String, key: String, value: String) -> Result<(), PigeonError> {
    let entry = get_entry(&scope, &key)?;
    entry.set_password(&value).map_err(map_keyring_error)
}

#[tauri::command]
pub fn get_secret(scope: String, key: String) -> Result<Option<String>, PigeonError> {
    let entry = get_entry(&scope, &key)?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(map_keyring_error(e)),
    }
}

#[tauri::command]
pub fn delete_secret(scope: String, key: String) -> Result<(), PigeonError> {
    let entry = get_entry(&scope, &key)?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(map_keyring_error(e)),
    }
}
