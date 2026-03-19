/// Accumulates f32 samples from one source.
/// Resamples to TARGET_RATE on demand via linear interpolation.
#[derive(Default)]
pub struct AudioBuffer {
    samples: Vec<f32>,
    sample_rate: u32,
    channels: u16,
}

impl AudioBuffer {
    pub fn push(&mut self, data: &[f32], sample_rate: u32, channels: u16) {
        if self.sample_rate == 0 {
            self.sample_rate = sample_rate;
            self.channels = channels;
        }
        self.samples.extend_from_slice(data);
    }

    pub fn resampled_frames(&self, target_rate: u32) -> Vec<Vec<f32>> {
        if self.sample_rate == 0 || self.channels == 0 {
            return vec![];
        }
        let ch = self.channels as usize;

        if self.sample_rate == target_rate {
            return self.samples.chunks_exact(ch).map(|c| c.to_vec()).collect();
        }

        let ratio = self.sample_rate as f64 / target_rate as f64;
        let src_len = self.samples.len() / ch;
        let out_len = (src_len as f64 / ratio) as usize;
        let mut out = Vec::with_capacity(out_len * ch);
        let zero_frame = vec![0.0f32; ch];

        let mut i = 0;
        while i < out_len {
            let pos = i as f64 * ratio;
            let idx = pos as usize;
            let frac = (pos - idx as f64) as f32;

            let src_idx = idx * ch;
            let next_src_idx = (idx + 1) * ch;

            let (a_start, _) = if idx < src_len {
                (src_idx, src_idx + ch)
            } else {
                (0, 0)
            };
            let (b_start, _) = if idx + 1 < src_len {
                (next_src_idx, next_src_idx + ch)
            } else {
                (0, 0)
            };

            let has_a = idx < src_len;
            let has_b = idx + 1 < src_len;

            for c in 0..ch {
                let a = if has_a {
                    unsafe { *self.samples.get_unchecked(a_start + c) }
                } else {
                    0.0
                };
                let b = if has_b {
                    unsafe { *self.samples.get_unchecked(b_start + c) }
                } else {
                    if has_a {
                        a
                    } else {
                        unsafe { *zero_frame.get_unchecked(c) }
                    }
                };
                out.push(a + frac * (b - a));
            }
            i += 1;
        }
        out.chunks(ch).map(|c| c.to_vec()).collect()
    }
}
