
/// Accumulates f32 samples from one source.
/// Resamples to TARGET_RATE on demand via linear interpolation.
#[derive(Default)]
pub struct AudioBuffer {
    samples: Vec<f32>,   // raw samples as received
    sample_rate: u32,
    channels: u16,
}

impl AudioBuffer {
    pub fn push(&mut self, data: &[f32], sample_rate: u32, channels: u16) {
        // First push sets the format
        if self.sample_rate == 0 {
            self.sample_rate = sample_rate;
            self.channels = channels;
        }
        self.samples.extend_from_slice(data);
    }

    /// Returns samples resampled to TARGET_RATE, preserving channel count.
    /// Output layout: interleaved, same channel count as input.
    pub fn resampled_frames(&self, target_rate: u32) -> Vec<Vec<f32>> {
        if self.sample_rate == 0 || self.channels == 0 {
            return vec![];
        }
        let ch = self.channels as usize;
        let src_frames: Vec<Vec<f32>> = self.samples
            .chunks_exact(ch)
            .map(|c| c.to_vec())
            .collect();

        if self.sample_rate == target_rate {
            return src_frames;
        }

        // Linear interpolation resample
        let ratio = self.sample_rate as f64 / target_rate as f64;
        let out_len = (src_frames.len() as f64 / ratio) as usize;
        let mut out = Vec::with_capacity(out_len);
        for i in 0..out_len {
            let pos = i as f64 * ratio;
            let idx = pos as usize;
            let frac = (pos - idx as f64) as f32;
            let a = src_frames.get(idx).cloned().unwrap_or_else(|| vec![0.0; ch]);
            let b = src_frames.get(idx + 1).cloned().unwrap_or_else(|| vec![0.0; ch]);
            let frame: Vec<f32> = a.iter().zip(b.iter())
                .map(|(&x, &y)| x + frac * (y - x))
                .collect();
            out.push(frame);
        }
        out
    }
}