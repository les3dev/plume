use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use crate::capture_state::{CaptureState, TARGET_RATE};
use crate::audio::write_wav::write_wav;

#[tauri::command]
pub fn stop_capture(state: State<CaptureState>, app: AppHandle) -> Result<PathBuf, String> {
    {
        let mut guard = state.sys_engine.lock().unwrap();
        if let Some(engine) = guard.as_mut() {
            engine.stop_capture().map_err(|e| e.to_string())?;
            *guard = None;
        } else {
            return Err("Not capturing".into());
        }
    }

    if let Some(stream) = state.mic_stream.lock().unwrap().take() {
        drop(stream.0);
    }

    let sys_frames = state.sys_buf.lock().unwrap().resampled_frames(TARGET_RATE);
    let mic_frames = state.mic_buf.lock().unwrap().resampled_frames(TARGET_RATE);

    let sys_ch = sys_frames.get(0).map_or(0, |f| f.len());
    let mic_ch = mic_frames.get(0).map_or(0, |f| f.len());

    let total_frames = sys_frames.len().max(mic_frames.len());
    let combined: Vec<Vec<f32>> = (0..total_frames).map(|i| {
        let s = sys_frames.get(i).cloned().unwrap_or(vec![0.0; sys_ch]);
        let m = mic_frames.get(i).cloned().unwrap_or(vec![0.0; mic_ch]);
        s.into_iter().chain(m).collect()
    }).collect();

    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("capture.wav");
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    write_wav(&path, &combined, TARGET_RATE).map_err(|e| e.to_string())?;

    Ok(path)
}