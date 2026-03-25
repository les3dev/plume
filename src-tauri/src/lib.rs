mod audio;
mod capture_state;
mod commands;

use crate::{
    capture_state::CaptureState, commands::start_capture::start_capture,
    commands::stop_capture::stop_capture,
};
use tauri::{
    Emitter, Manager, Listener,
    menu::{Menu, MenuItem},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(CaptureState::default())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![start_capture, stop_capture])
        .setup(|app| {
            if let Some(tray) = app.tray_by_id("main") {
                // "false" sur stop = désactivé au démarrage car on n'enregistre pas encore
                let start = MenuItem::with_id(app, "start", "Commencer l'enregistrement", true, None::<&str>)?;
                let stop  = MenuItem::with_id(app, "stop",  "Arrêter l'enregistrement",   false, None::<&str>)?;
                let quit  = MenuItem::with_id(app, "quit",  "Quitter l'application",       true, None::<&str>)?;

                let menu = Menu::with_items(app, &[&start, &stop, &quit])?;
                tray.set_menu(Some(menu))?;

                tray.on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "start" => { app.emit("tray-start-recording", ()).ok(); }
                        "stop"  => { app.emit("tray-stop-recording", ()).ok(); }
                        "quit"  => { app.exit(0); }
                        _ => {}
                    }
                });

                // Clone les items pour les utiliser dans les listeners
                // En Rust on ne peut pas partager une valeur entre plusieurs closures
                // sans la cloner ou l'envelopper dans un Arc
                let start1 = start.clone();
                let stop1  = stop.clone();
                let start2 = start.clone();
                let stop2  = stop.clone();

                // Quand le frontend émet "recording-started"
                // → désactive "Commencer", active "Arrêter"
                app.listen("recording-started", move |_| {
                    start1.set_enabled(false).ok();
                    stop1.set_enabled(true).ok();
                });

                // Quand le frontend émet "recording-stopped"
                // → réactive "Commencer", désactive "Arrêter"
                app.listen("recording-stopped", move |_| {
                    start2.set_enabled(true).ok();
                    stop2.set_enabled(false).ok();
                });
            }

            let window = app.get_webview_window("main").unwrap();
            window.on_window_event(|event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}