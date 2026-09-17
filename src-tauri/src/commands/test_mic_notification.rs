use crate::mic_watcher;
use tauri::AppHandle;

/// Manually fires the same native notification the CoreAudio watcher shows
/// when a third-party app activates the microphone - lets the UI exercise
/// the real notification pipeline without needing another app to open the
/// mic first.
#[tauri::command]
pub fn test_mic_notification(app: AppHandle) {
    mic_watcher::trigger_activity_notification(app);
}
