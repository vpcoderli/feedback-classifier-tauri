use tauri::State;
use std::time::Duration;
use tauri_plugin_dialog::DialogExt;

use crate::sidecar::SidecarState;

#[tauri::command]
pub async fn get_port(state: State<'_, SidecarState>) -> Result<u16, String> {
    for _ in 0..50 {
        if let Some(port) = *state.port.lock().unwrap() {
            return Ok(port);
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Err("Sidecar not ready after 5 seconds".to_string())
}

#[tauri::command]
pub async fn save_dialog(app: tauri::AppHandle, default_name: String) -> Result<Option<String>, String> {
    let path = app.dialog()
        .file()
        .set_file_name(&default_name)
        .blocking_save_file();

    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("读取失败: {}", e))
}

#[tauri::command]
pub async fn write_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &bytes).map_err(|e| format!("写入失败: {}", e))
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle, state: State<'_, SidecarState>) {
    crate::sidecar::kill(&state);
    app.exit(0);
}
