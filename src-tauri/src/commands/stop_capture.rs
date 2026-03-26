use crate::audio::write_wav::write_wav;
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

    let mic_stream = state.mic_stream.lock().unwrap().take();
    drop(mic_stream.map(|s| s.0));

    let sys_buf = state.sys_buf.clone();
    let mic_buf = state.mic_buf.clone();
    let path = PathBuf::from(folder_path).join("capture.wav");

    tokio::task::spawn_blocking(move || {
        let sys_frames = sys_buf.lock().unwrap().resampled_frames(TARGET_RATE);
        let mic_frames = mic_buf.lock().unwrap().resampled_frames(TARGET_RATE);

        let total_frames = sys_frames.len().max(mic_frames.len());
        if total_frames == 0 {
            return Err("No audio data captured".into());
        }

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