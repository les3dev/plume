use crate::audio::audio_buffer::AudioBuffer;
use crate::AudioCapture;
use cpal::Stream;
use std::sync::{Arc, Mutex}; // Adjust based on where AudioCapture is defined

pub struct SafeStream(pub Stream);
unsafe impl Send for SafeStream {}
unsafe impl Sync for SafeStream {}

#[derive(Default)]
pub struct CaptureState {
    pub sys_engine: Mutex<Option<AudioCapture>>,
    pub sys_buf: Arc<Mutex<AudioBuffer>>,
    pub mic_stream: Mutex<Option<SafeStream>>,
    pub mic_buf: Arc<Mutex<AudioBuffer>>,
}

pub const TARGET_RATE: u32 = 48_000;
