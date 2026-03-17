use std::{fs::File, io::BufWriter, path::PathBuf};

/// Writes a mono/multi-channel PCM 16-bit WAV.
/// `frames` is a Vec of frames; each frame is a Vec of per-channel f32 samples in [-1.0, 1.0].
pub fn write_wav(path: &PathBuf, frames: &[Vec<f32>], sample_rate: u32) -> std::io::Result<()> {
    if frames.is_empty() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "No audio data to write",
        ));
    }

    let channels = frames[0].len() as u16;
    let bytes_per_sample: u32 = 2; // 16-bit = 2 bytes
    let data_bytes = frames.len() * channels as usize * bytes_per_sample as usize;

    let mut f = BufWriter::new(File::create(path)?);

    // RIFF header
    f.write_all(b"RIFF")?;
    f.write_all(&((36 + data_bytes) as u32).to_le_bytes())?;
    f.write_all(b"WAVE")?;

    // fmt chunk — PCM integer
    f.write_all(b"fmt ")?;
    f.write_all(&16u32.to_le_bytes())?;                                          // chunk size
    f.write_all(&1u16.to_le_bytes())?;                                           // format: PCM (1)
    f.write_all(&channels.to_le_bytes())?;
    f.write_all(&sample_rate.to_le_bytes())?;
    f.write_all(&(sample_rate * channels as u32 * bytes_per_sample).to_le_bytes())?; // byte rate
    f.write_all(&(channels * bytes_per_sample as u16).to_le_bytes())?;           // block align
    f.write_all(&16u16.to_le_bytes())?;                                          // bits per sample

    // data chunk
    f.write_all(b"data")?;
    f.write_all(&(data_bytes as u32).to_le_bytes())?;
    for frame in frames {
        for &s in frame {
            let pcm = (s.clamp(-1.0, 1.0) * 32767.0) as i16;
            f.write_all(&pcm.to_le_bytes())?;
        }
    }

    use std::io::Write;
    f.flush()
}