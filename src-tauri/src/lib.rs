// mod audio;
// mod capture_state;
// mod commands;

// use crate::{
//     capture_state::CaptureState, commands::start_capture::start_capture,
//     commands::stop_capture::stop_capture,
// };
// use audio_capture::AudioCapture;
// use tauri::Manager;
// use tauri_plugin_positioner::{Position, WindowExt};

// #[cfg_attr(mobile, tauri::mobile_entry_point)]
// pub fn run() {
//     tauri::Builder::default()
//         .plugin(tauri_plugin_shell::init())
//         .manage(CaptureState::default())
//         .plugin(tauri_plugin_positioner::init())
//         .plugin(tauri_plugin_http::init())
//         .plugin(tauri_plugin_fs::init())
//         .plugin(tauri_plugin_dialog::init())
//         .plugin(tauri_plugin_store::Builder::new().build())
//         .plugin(tauri_plugin_opener::init())
//         .invoke_handler(tauri::generate_handler![start_capture, stop_capture])
//         .setup(|app| {
//             let window = app.get_webview_window("main").unwrap();
//             window.move_window(Position::RightCenter)?; // or TopRight, BottomRight
//             Ok(())
//         })
//         .run(tauri::generate_context!())
//         .expect("error while running tauri application");
// }

mod audio;
mod capture_state;
mod commands;

use crate::{
    capture_state::CaptureState, commands::start_capture::start_capture,
    commands::stop_capture::stop_capture,
};
use audio_capture::AudioCapture;
use tauri::{
    // MouseButtonState = permet de distinguer appui (Down) et relâchement (Up)
    // TrayIconEvent = les différents événements possibles sur l'icône (clic, survol...)
    tray::{MouseButtonState, TrayIconEvent},
    Manager, // Permet d'accéder aux fenêtres depuis n'importe où dans l'app
};
use tauri_plugin_positioner::{Position, WindowExt}; // Position = les positions prédéfinies (TrayCenter, TopRight...)
                                                     // WindowExt = ajoute la méthode move_window() aux fenêtres
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // tauri::Builder::default() = point de départ pour configurer l'app
    // En Rust, on "chaîne" les méthodes avec des "." à la ligne, c'est du method chaining
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())      // Permet d'exécuter des commandes shell
        .plugin(tauri_plugin_positioner::init()) // Active le positionnement intelligent des fenêtres
        .plugin(tauri_plugin_http::init())       // Permet les requêtes HTTP (Deepgram, OpenRouter...)
        .plugin(tauri_plugin_fs::init())         // Permet l'accès au système de fichiers
        .plugin(tauri_plugin_dialog::init())     // Permet d'ouvrir des boîtes de dialogue
        .plugin(tauri_plugin_store::Builder::new().build()) // Stockage persistant clé/valeur
        .plugin(tauri_plugin_opener::init())     // Permet d'ouvrir des fichiers/URLs externes
        .invoke_handler(tauri::generate_handler![start_capture, stop_capture])
        .setup(|app| {
            // Set up CaptureState with app handle for error callbacks
            let mut state = CaptureState::default();
            state.app_handle = Mutex::new(Some(app.handle().clone()));
            app.manage(state);

            // "setup" = code exécuté UNE SEULE FOIS au démarrage, avant que l'app soit visible
            // "|app|" = closure qui reçoit l'application en paramètre

            // On récupère la fenêtre nommée "main" (définie dans tauri.conf.json)
            // unwrap() = "je suis sûr que ça existe, sinon fais planter le programme"
            let window = app.get_webview_window("main").unwrap();

            // On cache la fenêtre au démarrage
            // L'utilisateur l'ouvrira en cliquant sur l'icône dans la barre menu
            window.hide().unwrap();

            // On récupère l'icône tray déjà créée automatiquement par tauri.conf.json
            // tray_by_id("main") = l'ID par défaut assigné par Tauri au tray défini dans la config
            // "if let Some(tray)" = si le tray existe, on le récupère dans "tray"
            if let Some(tray) = app.tray_by_id("main") {

                // On définit le comportement au clic sur cette icône existante
                // "|tray, event|" = closure qui reçoit l'icône et l'événement déclencheur
                tray.on_tray_icon_event(|tray, event| {

                    // ⚠️ DOIT ÊTRE EN PREMIER
                    // Enregistre la position actuelle de l'icône tray dans le plugin positioner
                    // Sans ça, Position::TrayCenter ne sait pas où est l'icône → plantage
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                    // "&event" = on passe une référence à event (on le "prête" sans le consommer)
                    // En Rust, passer une valeur sans "&" la "consomme" et elle n'est plus utilisable

                    // "if let" = pattern matching : on vérifie si event correspond à ce pattern
                    // TrayIconEvent::Click = c'est un clic (pas un survol ou autre)
                    // button_state: MouseButtonState::Up = uniquement au RELÂCHEMENT du clic
                    // Sans ce filtre, l'événement se déclenche 2 fois :
                    //   → une fois à l'appui (Down) : ouvre la fenêtre
                    //   → une fois au relâchement (Up) : referme la fenêtre immédiatement
                    // ".." = "on ignore les autres champs du Click qu'on ne veut pas vérifier"
                    if let TrayIconEvent::Click { button_state: MouseButtonState::Up, .. } = event {

                        // app_handle() = récupère une référence à l'app depuis l'icône tray
                        let app = tray.app_handle();

                        // "if let Some(window)" = si la fenêtre existe, on la récupère dans "window"
                        // get_webview_window retourne un Option<Window> (soit Some(fenêtre) soit None)
                        // En Rust, on ne peut pas accéder directement à un Option sans vérifier
                        if let Some(window) = app.get_webview_window("main") {

                            // Toggle show/hide selon l'état actuel de la fenêtre
                            // unwrap_or(false) = si is_visible() échoue, on suppose qu'elle est cachée
                            if window.is_visible().unwrap_or(false) {
                                // Fenêtre visible → on la cache
                                window.hide().unwrap();
                            } else {
                                // Fenêtre cachée → on la montre
                                window.show().unwrap();

                                // Met la fenêtre au premier plan et lui donne le focus clavier
                                window.set_focus().unwrap();

                                // Déplace la fenêtre juste sous l'icône tray
                                // Position::TrayCenter = centré horizontalement sous l'icône
                                window.move_window(Position::TrayCenter).unwrap();
                            }
                        }
                    }
                });
            }

            // Ok(()) = tout s'est bien passé, on retourne un succès
            // En Rust, la dernière expression d'une fonction est sa valeur de retour
            // "()" = "unit type", l'équivalent de void en JS
            Ok(())
        })
        .run(tauri::generate_context!()) // Lance l'app avec la config de tauri.conf.json
        .expect("error while running tauri application"); // Plante avec un message si l'app crashe
}