use crate::{
    audio::audio_buffer::AudioBuffer,
    audio::mix::mix_and_write,
    capture_state::{CaptureState, SafeStream, DUMP_INTERVAL_SECS, TARGET_RATE},
};
use audio_capture::AudioCapture;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, State};

#[tauri::command]
pub fn start_capture(state: State<CaptureState>, folder_path: String) -> Result<(), String> {
    if state.sys_engine.lock().unwrap().is_some() {
        return Err("Already capturing".into());
    }

    *state.sys_buf.lock().unwrap() = AudioBuffer::default();
    *state.mic_buf.lock().unwrap() = AudioBuffer::default();
    *state.unexpected_stop.lock().unwrap() = false;

    // ── System Audio ──
    let sys_buf = Arc::clone(&state.sys_buf);
    let mut engine = AudioCapture::new();

    let app_handle = state.app_handle.lock().unwrap().clone();
    let unexpected_stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let flag_for_callback = Arc::clone(&unexpected_stop_flag);

    if let Some(handle) = app_handle {
        engine.set_error_callback(move |error| {
            eprintln!("[AudioCapture] Stream stopped: {}", error);
            flag_for_callback.store(true, std::sync::atomic::Ordering::SeqCst);
            let _ = handle.emit("audio-capture-save", &error);
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

    let dump_sys_buf = Arc::clone(&state.sys_buf);
    let dump_mic_buf = Arc::clone(&state.mic_buf);
    let dump_path = PathBuf::from(folder_path).join("capture.wav");

    let dump_task = tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(DUMP_INTERVAL_SECS));
        interval.tick().await; // first tick fires immediately, skip it

        loop {
            interval.tick().await;
            let sys_buf = Arc::clone(&dump_sys_buf);
            let mic_buf = Arc::clone(&dump_mic_buf);
            let path = dump_path.clone();
            let _ = tokio::task::spawn_blocking(move || {
                mix_and_write(&sys_buf, &mic_buf, &path, TARGET_RATE)
            })
            .await;
        }
    });
    *state.dump_task.lock().unwrap() = Some(dump_task);

    Ok(())
}
