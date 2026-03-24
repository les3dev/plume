use crate::{
    audio::audio_buffer::AudioBuffer,
    capture_state::{CaptureState, SafeStream},
};
use audio_capture::AudioCapture;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::Arc;
use tauri::{Emitter, State};

#[tauri::command]
pub fn start_capture(state: State<CaptureState>) -> Result<(), String> {
    if state.sys_engine.lock().unwrap().is_some() {
        return Err("Already capturing".into());
    }

    *state.sys_buf.lock().unwrap() = AudioBuffer::default();
    *state.mic_buf.lock().unwrap() = AudioBuffer::default();

    // ── System Audio ──
    let sys_buf = Arc::clone(&state.sys_buf);
    let mut engine = AudioCapture::new();

    let app_handle = state.app_handle.lock().unwrap().clone();
    if let Some(handle) = app_handle {
        engine.set_error_callback(move |error| {
            eprintln!("[AudioCapture] Stream stopped: {}", error);
            let _ = handle.emit("audio-capture-error", &error);
        });
    }

    engine
        .start_capture(move |samples, _frames, sample_rate, channels| {
            sys_buf
                .lock()
                .unwrap()
                .push(samples, sample_rate as u32, channels as u16);
        })
        .map_err(|e| e.to_string())?;
    *state.sys_engine.lock().unwrap() = Some(engine);

    // ── Mic Audio ──
    let host = cpal::default_host();
    let mic_device = host
        .default_input_device()
        .ok_or("No default input device")?;
    let config = mic_device
        .default_input_config()
        .map_err(|e| e.to_string())?;

    let mic_buf = Arc::clone(&state.mic_buf);
    let mic_rate = config.sample_rate().0;
    let mic_ch = config.channels() as u16;

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => mic_device.build_input_stream(
            &config.into(),
            move |data: &[f32], _| {
                mic_buf.lock().unwrap().push(data, mic_rate, mic_ch);
            },
            |e| eprintln!("{e}"),
            None,
        ),
        // ... (Include your I16 and I32 logic here similarly)
        _ => return Err("Unsupported format".into()),
    }
    .map_err(|e| e.to_string())?;

    stream.play().map_err(|e| e.to_string())?;
    *state.mic_stream.lock().unwrap() = Some(SafeStream(stream));

    Ok(())
}
