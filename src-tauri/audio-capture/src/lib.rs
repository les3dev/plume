use std::ffi::CStr;
use std::os::raw::{c_char, c_float};

// ── Raw FFI bindings ─────────────────────────────────────────────────────────

pub type RawHandle = *mut std::ffi::c_void;

pub type AudioDataCallback = unsafe extern "C" fn(
    samples: *const c_float,
    frame_count: u32,
    sample_rate: f64,
    channel_count: u32,
);

#[link(name = "AudioCapture", kind = "dylib")]
extern "C" {
    fn audio_capture_create() -> RawHandle;
    fn audio_capture_destroy(handle: RawHandle);
    fn audio_capture_start(handle: RawHandle, callback: AudioDataCallback) -> *const c_char;
    fn audio_capture_stop(handle: RawHandle) -> *const c_char;
    fn audio_capture_is_capturing(handle: RawHandle) -> bool;
    fn audio_capture_free_error(error: *const c_char);
}

// ── Error type ───────────────────────────────────────────────────────────────

#[derive(Debug)]
pub struct CaptureError(pub String);

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "AudioCapture error: {}", self.0)
    }
}

impl std::error::Error for CaptureError {}

fn check_error(ptr: *const c_char) -> Result<(), CaptureError> {
    if ptr.is_null() {
        return Ok(());
    }
    let msg = unsafe { CStr::from_ptr(ptr).to_string_lossy().into_owned() };
    unsafe { audio_capture_free_error(ptr) };
    Err(CaptureError(msg))
}

// ── Safe wrapper ─────────────────────────────────────────────────────────────

/// A safe, Send handle to the system-audio capture engine.
/// 
/// # Example
/// ```no_run
/// use audio_capture::AudioCapture;
///
/// let mut cap = AudioCapture::new();
/// cap.start_capture(|samples, frame_count, sample_rate, channels| {
///     println!("{frame_count} frames @ {sample_rate} Hz, {channels} ch");
/// }).unwrap();
///
/// std::thread::sleep(std::time::Duration::from_secs(5));
/// cap.stop_capture().unwrap();
/// ```
pub struct AudioCapture {
    handle: RawHandle,
}

// The Swift engine is thread-safe internally.
unsafe impl Send for AudioCapture {}
unsafe impl Sync for AudioCapture {}

impl AudioCapture {
    /// Create a new capture engine.
    pub fn new() -> Self {
        let handle = unsafe { audio_capture_create() };
        assert!(!handle.is_null(), "audio_capture_create returned null");
        Self { handle }
    }

    /// Start capturing system audio (all apps, no microphone).
    ///
    /// `callback` is invoked on a high-priority background thread for every
    /// audio buffer delivered by macOS.  Keep it fast — don't block.
    ///
    /// **Requires "Screen Recording" permission** in System Settings →
    /// Privacy & Security → Screen Recording.
    pub fn start_capture<F>(&mut self, callback: F) -> Result<(), CaptureError>
    where
        F: Fn(&[f32], u32, f64, u32) + Send + 'static,
    {
        // Box the closure and leak it so it lives for the lifetime of the
        // stream.  We reclaim it in stop_capture via a shared flag.
        let boxed: Box<dyn Fn(&[f32], u32, f64, u32) + Send + 'static> = Box::new(callback);
        let raw = Box::into_raw(Box::new(boxed));
        CURRENT_CALLBACK.with(|c| unsafe { *c.get() = raw as usize });

        let err = unsafe { audio_capture_start(self.handle, trampoline) };
        check_error(err)
    }

    /// Stop capturing system audio.
    pub fn stop_capture(&mut self) -> Result<(), CaptureError> {
        let err = unsafe { audio_capture_stop(self.handle) };
        // Reclaim the leaked closure
        CURRENT_CALLBACK.with(|c| unsafe {
            let ptr = *c.get();
            if ptr != 0 {
                drop(Box::from_raw(
                    ptr as *mut Box<dyn Fn(&[f32], u32, f64, u32) + Send + 'static>,
                ));
                *c.get() = 0;
            }
        });
        check_error(err)
    }

    /// Returns `true` if currently capturing.
    pub fn is_capturing(&self) -> bool {
        unsafe { audio_capture_is_capturing(self.handle) }
    }
}

impl Default for AudioCapture {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for AudioCapture {
    fn drop(&mut self) {
        // If still capturing, attempt a graceful stop
        if self.is_capturing() {
            let _ = self.stop_capture();
        }
        unsafe { audio_capture_destroy(self.handle) };
    }
}

// ── Trampoline ───────────────────────────────────────────────────────────────
// A single extern "C" function that bridges the C callback to our Rust closure.

use std::cell::UnsafeCell;

thread_local! {
    // Stores the raw pointer to the current Box<Box<dyn Fn(...)>>.
    // Using thread_local is safe here because the Swift runtime calls the
    // callback always from the same dedicated audio thread.
    static CURRENT_CALLBACK: UnsafeCell<usize> = UnsafeCell::new(0);
}

unsafe extern "C" fn trampoline(
    samples: *const c_float,
    frame_count: u32,
    sample_rate: f64,
    channel_count: u32,
) {
    CURRENT_CALLBACK.with(|c| {
        let ptr = *c.get();
        if ptr == 0 {
            return;
        }
        let cb = &*(ptr as *const Box<dyn Fn(&[f32], u32, f64, u32) + Send + 'static>);
        let slice = std::slice::from_raw_parts(samples, (frame_count * channel_count) as usize);
        cb(slice, frame_count, sample_rate, channel_count);
    });
}

// ── Convenience: write captured audio to a WAV file ──────────────────────────

#[cfg(feature = "wav")]
pub mod wav {
    //! Optional helper: accumulate captured audio and write a WAV file.
    //! Enable with `features = ["wav"]` in your Cargo.toml.

    use std::io::{BufWriter, Write};
    use std::path::Path;
    use std::fs::File;
    use std::sync::{Arc, Mutex};

    pub struct WavRecorder {
        samples: Arc<Mutex<Vec<f32>>>,
        sample_rate: Arc<Mutex<u32>>,
        channels: Arc<Mutex<u16>>,
    }

    impl WavRecorder {
        pub fn new() -> Self {
            Self {
                samples: Arc::new(Mutex::new(Vec::new())),
                sample_rate: Arc::new(Mutex::new(48000)),
                channels: Arc::new(Mutex::new(2)),
            }
        }

        /// Returns a closure suitable for `AudioCapture::start_capture`.
        pub fn callback(&self) -> impl Fn(&[f32], u32, f64, u32) + Send + 'static {
            let samples = Arc::clone(&self.samples);
            let sr = Arc::clone(&self.sample_rate);
            let ch = Arc::clone(&self.channels);
            move |data, _frames, sample_rate, channels| {
                *sr.lock().unwrap() = sample_rate as u32;
                *ch.lock().unwrap() = channels as u16;
                samples.lock().unwrap().extend_from_slice(data);
            }
        }

        /// Flush accumulated samples to a 32-bit float WAV file.
        pub fn save(&self, path: impl AsRef<Path>) -> std::io::Result<()> {
            let samples = self.samples.lock().unwrap();
            let sample_rate = *self.sample_rate.lock().unwrap();
            let channels = *self.channels.lock().unwrap();

            let mut f = BufWriter::new(File::create(path)?);

            let data_bytes = samples.len() * 4;
            let total = 36 + data_bytes;

            // RIFF header
            f.write_all(b"RIFF")?;
            f.write_all(&(total as u32).to_le_bytes())?;
            f.write_all(b"WAVE")?;

            // fmt chunk (PCM float, type 3)
            f.write_all(b"fmt ")?;
            f.write_all(&16u32.to_le_bytes())?;
            f.write_all(&3u16.to_le_bytes())?; // IEEE float
            f.write_all(&channels.to_le_bytes())?;
            f.write_all(&sample_rate.to_le_bytes())?;
            f.write_all(&(sample_rate * channels as u32 * 4).to_le_bytes())?;
            f.write_all(&(channels * 4).to_le_bytes())?;
            f.write_all(&32u16.to_le_bytes())?;

            // data chunk
            f.write_all(b"data")?;
            f.write_all(&(data_bytes as u32).to_le_bytes())?;
            for &s in samples.iter() {
                f.write_all(&s.to_le_bytes())?;
            }

            Ok(())
        }
    }
}