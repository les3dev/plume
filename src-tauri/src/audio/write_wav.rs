use std::{fs::File, io::BufWriter, path::PathBuf};

/// Writes a multi-channel f32 WAV.
/// `frames` is a Vec of frames; each frame is a Vec of per-channel samples.
/// All frames must have the same length (= total output channels).
pub fn write_wav(path: &PathBuf, frames: &[Vec<f32>], sample_rate: u32) -> std::io::Result<()> {
    if frames.is_empty() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "No audio data to write",
        ));
    }
    let channels = frames[0].len() as u16;
    let mut f = BufWriter::new(File::create(path)?);
    let data_bytes = frames.len() * channels as usize * 4; // f32 = 4 bytes

    // RIFF header
    f.write_all(b"RIFF")?;
    f.write_all(&((36 + data_bytes) as u32).to_le_bytes())?;
    f.write_all(b"WAVE")?;
    // fmt chunk — IEEE float
    f.write_all(b"fmt ")?;
    f.write_all(&16u32.to_le_bytes())?; // chunk size
    f.write_all(&3u16.to_le_bytes())?; // PCM float
    f.write_all(&channels.to_le_bytes())?;
    f.write_all(&sample_rate.to_le_bytes())?;
    f.write_all(&(sample_rate * channels as u32 * 4).to_le_bytes())?; // byte rate
    f.write_all(&(channels * 4).to_le_bytes())?; // block align
    f.write_all(&32u16.to_le_bytes())?; // bits per sample
                                        // data chunk
    f.write_all(b"data")?;
    f.write_all(&(data_bytes as u32).to_le_bytes())?;
    for frame in frames {
        for &s in frame {
            f.write_all(&s.to_le_bytes())?;
        }
    }

    use std::io::Write;
    f.flush()
}
