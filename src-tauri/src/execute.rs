use pigeon_core::models::{RequestItem, Environment, AppSettings, RequestExecutionResult};
use pigeon_core::execute_request as core_execute_request;
use std::collections::HashMap;

#[tauri::command]
pub async fn execute_request(
    request: RequestItem,
    environment: Option<Environment>,
    local_vars: Option<HashMap<String, String>>,
    settings: Option<AppSettings>,
) -> Result<RequestExecutionResult, String> {
    core_execute_request(&request, environment.as_ref(), local_vars.as_ref(), settings.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn parse_dataset(
    content: String,
    is_csv: bool,
) -> Result<Vec<HashMap<String, String>>, String> {
    pigeon_core::dataset_parser::parse_dataset(&content, is_csv)
}
