mod audio;
mod capture_state;
mod commands;

use tauri::Manager;
use tauri_plugin_positioner::{WindowExt, Position};
use audio_capture::AudioCapture;
use crate::{capture_state::CaptureState, commands::start_capture::start_capture, commands::stop_capture::stop_capture};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CaptureState::default())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![start_capture, stop_capture])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.move_window(Position::RightCenter)?; // or TopRight, BottomRight
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}