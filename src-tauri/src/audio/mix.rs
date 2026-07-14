use crate::audio::audio_buffer::AudioBuffer;
use crate::audio::write_wav::write_wav;
use std::path::Path;
use std::sync::{Arc, Mutex};

/// Resamples both buffers to `target_rate`, mixes them down to mono, and writes the result to
/// `path`. Used both for the final write on stop and for the periodic in-progress dumps.
pub fn mix_and_write(
    sys_buf: &Arc<Mutex<AudioBuffer>>,
    mic_buf: &Arc<Mutex<AudioBuffer>>,
    path: &Path,
    target_rate: u32,
) -> Result<(), String> {
    let sys_frames = sys_buf.lock().unwrap().resampled_frames(target_rate);
    let mic_frames = mic_buf.lock().unwrap().resampled_frames(target_rate);

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
    write_wav(&path.to_path_buf(), &mono_frames, target_rate).map_err(|e| e.to_string())?;
    Ok(())
}
