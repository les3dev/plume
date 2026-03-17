use crate::audio::write_wav::write_wav;
use crate::capture_state::{CaptureState, TARGET_RATE};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub async fn stop_capture(
    state: State<'_, CaptureState>,
    app: AppHandle,
) -> Result<PathBuf, String> {
    // --- Arrêt des engines (sync, rapide) ---
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

    // --- Resampling + mixdown sur un thread dédié ---
    let sys_buf = state.sys_buf.clone();
    let mic_buf = state.mic_buf.clone();
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("capture.wav");

    tokio::task::spawn_blocking(move || {
        let sys_frames = sys_buf.lock().unwrap().resampled_frames(TARGET_RATE);
        let mic_frames = mic_buf.lock().unwrap().resampled_frames(TARGET_RATE);

        // Derive channel counts BEFORE the loop, with a safe minimum of 1
        // so fallback padding is never an empty vec
        let sys_ch = sys_frames.first().map_or(1, |f| f.len().max(1));
        let mic_ch = mic_frames.first().map_or(1, |f| f.len().max(1));

        let total_frames = sys_frames.len().max(mic_frames.len());

        // Mono-mix each source independently, then average the two sources.
        // This gives sys and mic equal weight regardless of their channel counts.
        let mono_frames: Vec<Vec<f32>> = (0..total_frames)
            .map(|i| {
                let s = sys_frames.get(i).cloned().unwrap_or_else(|| vec![0.0; sys_ch]);
                let m = mic_frames.get(i).cloned().unwrap_or_else(|| vec![0.0; mic_ch]);

                let sys_mono = s.iter().sum::<f32>() / s.len() as f32;
                let mic_mono = m.iter().sum::<f32>() / m.len() as f32;

                vec![(sys_mono + mic_mono) * 0.5]
            })
            .collect();

        std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
        write_wav(&path, &mono_frames, TARGET_RATE).map_err(|e| e.to_string())?;
        Ok(path)
    })
    .await
    .map_err(|e| e.to_string())?
}