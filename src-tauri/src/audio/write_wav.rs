use std::{fs::File, io::BufWriter, path::PathBuf};

pub fn write_wav(path: &PathBuf, frames: &[Vec<f32>], sample_rate: u32) -> std::io::Result<()> {
    if frames.is_empty() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "No audio data to write",
        ));
    }

    let channels = frames[0].len() as u16;
    let bytes_per_sample: u32 = 2;
    let total_frames = frames.len();
    let data_bytes = total_frames * channels as usize * bytes_per_sample as usize;

    let mut f = BufWriter::new(File::create(path)?);

    f.write_all(b"RIFF")?;
    f.write_all(&((36 + data_bytes) as u32).to_le_bytes())?;
    f.write_all(b"WAVE")?;

    f.write_all(b"fmt ")?;
    f.write_all(&16u32.to_le_bytes())?;
    f.write_all(&1u16.to_le_bytes())?;
    f.write_all(&channels.to_le_bytes())?;
    f.write_all(&sample_rate.to_le_bytes())?;
    f.write_all(&(sample_rate * channels as u32 * bytes_per_sample).to_le_bytes())?;
    f.write_all(&(channels * bytes_per_sample as u16).to_le_bytes())?;
    f.write_all(&16u16.to_le_bytes())?;

    f.write_all(b"data")?;
    f.write_all(&(data_bytes as u32).to_le_bytes())?;

    let mut pcm_buf = vec![0i16; total_frames * channels as usize];
    for (i, frame) in frames.iter().enumerate() {
        for (j, &s) in frame.iter().enumerate() {
            pcm_buf[i * channels as usize + j] = (s.clamp(-1.0, 1.0) * 32767.0) as i16;
        }
    }

    for &sample in &pcm_buf {
        f.write_all(&sample.to_le_bytes())?;
    }

    use std::io::Write;
    f.flush()
}
