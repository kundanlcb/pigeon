use std::process::Command;
use tauri::command;

#[command]
pub fn git_command(args: Vec<String>, cwd: String) -> Result<String, String> {
    let output = Command::new("git")
        .env("GIT_TERMINAL_PROMPT", "0")
        .args(&args)
        .current_dir(cwd)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).into_owned())
    }
}
