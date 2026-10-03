use keyring::Entry;

fn map_keyring_error(e: keyring::Error) -> String {
    let msg = e.to_string().to_lowercase();
    if msg.contains("denied") || msg.contains("cancel") || msg.contains("not allowed") || msg.contains("rejected") {
        return "KEYCHAIN_ACCESS_DENIED".to_string();
    }
    if msg.contains("no storage") || msg.contains("not running") || msg.contains("bus") || msg.contains("could not connect") {
        return "KEYCHAIN_UNAVAILABLE".to_string();
    }
    format!("KEYCHAIN_ERROR: {}", e)
}

fn get_entry(scope: &str, key: &str) -> Result<Entry, String> {
    Entry::new("pigeon", &format!("{scope}:{key}")).map_err(map_keyring_error)
}

#[tauri::command]
pub fn set_secret(scope: String, key: String, value: String) -> Result<(), String> {
    let entry = get_entry(&scope, &key)?;
    entry.set_password(&value).map_err(map_keyring_error)
}

#[tauri::command]
pub fn get_secret(scope: String, key: String) -> Result<Option<String>, String> {
    let entry = get_entry(&scope, &key)?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(map_keyring_error(e)),
    }
}

#[tauri::command]
pub fn delete_secret(scope: String, key: String) -> Result<(), String> {
    let entry = get_entry(&scope, &key)?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(map_keyring_error(e)),
    }
}
