use crate::audio::write_wav::write_wav;
use audio_capture::CaptureError;
use crate::capture_state::{CaptureState, TARGET_RATE};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub async fn stop_capture(
    state: State<'_, CaptureState>,
    app: AppHandle,
) -> Result<PathBuf, String> {
    {
        let mut guard = state.sys_engine.lock().unwrap();
        if let Some(engine) = guard.as_mut() {
            engine.stop_capture().map_err(|e: CaptureError| e.to_string())?;
            *guard = None;
        } else {
            return Err("Not capturing".into());

        }
        *guard = None;
    }

    let mic_stream = state.mic_stream.lock().unwrap().take();

    drop(mic_stream.map(|s| s.0));

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

        let total_frames = sys_frames.len().max(mic_frames.len());
        if total_frames == 0 {
            return Err("No audio data captured".into());
        }
        // Uncomment to test loading state
        // std::thread::sleep(std::time::Duration::from_secs(5));

        let mut mono_samples = Vec::with_capacity(total_frames);
        for i in 0..total_frames {
            let sys_mono = sys_frames
                .get(i)
                .map(|f| f.iter().sum::<f32>() / f.len() as f32)
                .unwrap_or(0.0);
            let mic_mono = mic_frames
                .get(i)
                .map(|f| f.iter().sum::<f32>() / f.len() as f32)
                .unwrap_or(0.0);
            mono_samples.push((sys_mono + mic_mono) * 0.5);
        }

        let mono_frames: Vec<Vec<f32>> = mono_samples.into_iter().map(|s| vec![s]).collect();

        std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
        write_wav(&path, &mono_frames, TARGET_RATE).map_err(|e| e.to_string())?;
        Ok(path)
    })
    .await
    .map_err(|e| e.to_string())?
}