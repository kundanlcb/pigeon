use keyring::Entry;

fn get_entry(scope: &str, key: &str) -> Result<Entry, String> {
    Entry::new("pigeon", &format!("{scope}:{key}")).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_secret(scope: String, key: String, value: String) -> Result<(), String> {
    let entry = get_entry(&scope, &key)?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_secret(scope: String, key: String) -> Result<Option<String>, String> {
    let entry = get_entry(&scope, &key)?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_secret(scope: String, key: String) -> Result<(), String> {
    let entry = get_entry(&scope, &key)?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted or doesn't exist
        Err(e) => Err(e.to_string()),
    }
}
