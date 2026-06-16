use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

pub struct SidecarState {
    pub port: Mutex<Option<u16>>,
    pub child: Mutex<Option<CommandChild>>,
}

pub fn spawn(app: &AppHandle) {
    let data_dir = app.path().app_data_dir()
        .unwrap()
        .to_string_lossy()
        .to_string();

    let shell = app.shell();
    let sidecar = match shell.sidecar("feedback-server") {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to create sidecar command: {}", e);
            return;
        }
    };

    let (mut rx, child) = match sidecar
        .env("PORT", "0")
        .env("DATA_DIR", &data_dir)
        .spawn() {
        Ok(pair) => pair,
        Err(e) => {
            eprintln!("Failed to spawn sidecar: {}", e);
            return;
        }
    };

    let state = app.state::<SidecarState>();
    *state.child.lock().unwrap() = Some(child);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Stdout(line) = event {
                let s = String::from_utf8_lossy(&line);
                if let Some(port_str) = s.trim().strip_prefix("LISTENING:") {
                    if let Ok(port) = port_str.trim().parse::<u16>() {
                        let state = app_handle.state::<SidecarState>();
                        *state.port.lock().unwrap() = Some(port);
                        println!("Sidecar listening on port {}", port);
                        break;
                    }
                }
            }
        }
    });
}

pub fn kill(state: &SidecarState) {
    if let Some(child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
    }
}
