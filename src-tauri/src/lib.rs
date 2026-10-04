pub mod error;
mod secrets;
mod git;
pub mod load_test;
pub mod http;
mod execute;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_http::init())
        .manage(load_test::LoadTestState::default())
        .invoke_handler(tauri::generate_handler![
            secrets::set_secret,
            secrets::get_secret,
            secrets::delete_secret,
            git::git_command,
            load_test::start_load_test,
            load_test::stop_load_test,
            execute::execute_request,
            execute::parse_dataset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
