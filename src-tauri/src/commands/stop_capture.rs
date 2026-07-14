use crate::audio::mix::mix_and_write;
use crate::capture_state::{CaptureState, TARGET_RATE};
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub async fn stop_capture(
    state: State<'_, CaptureState>,
    folder_path: String,
) -> Result<PathBuf, String> {
    {
        let mut guard = state.sys_engine.lock().unwrap();
        if let Some(engine) = guard.as_mut() {
            engine.stop_capture().map_err(|e| e.to_string())?;
        } else {
            return Err("Not capturing".into());
        }
        *guard = None;
    }

    if let Some(dump_task) = state.dump_task.lock().unwrap().take() {
        dump_task.abort();
    }

    let mic_stream = state.mic_stream.lock().unwrap().take();
    drop(mic_stream.map(|s| s.0));

    let sys_buf = state.sys_buf.clone();
    let mic_buf = state.mic_buf.clone();
    let path = PathBuf::from(folder_path).join("capture.wav");

    tokio::task::spawn_blocking(move || {
        mix_and_write(&sys_buf, &mic_buf, &path, TARGET_RATE)?;
        Ok(path)
    })
    .await
    .map_err(|e| e.to_string())?
}