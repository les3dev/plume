use std::ffi::CStr;
use std::os::raw::{c_char, c_float};
use std::sync::atomic::{AtomicUsize, Ordering};

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

// ── Global callback storage ───────────────────────────────────────────────────
// thread_local! does NOT work here — Swift calls the trampoline from its own
// audio thread, not the thread that called start_capture.

static CURRENT_CALLBACK: AtomicUsize = AtomicUsize::new(0);

// ── Safe wrapper ─────────────────────────────────────────────────────────────

pub struct AudioCapture {
    handle: RawHandle,
}

unsafe impl Send for AudioCapture {}
unsafe impl Sync for AudioCapture {}

impl AudioCapture {
    pub fn new() -> Self {
        let handle = unsafe { audio_capture_create() };
        assert!(!handle.is_null(), "audio_capture_create returned null");
        Self { handle }
    }

    /// Start capturing system audio.
    ///
    /// NOTE: The Swift side is async — this call returns as soon as the capture
    /// *request* is sent. Audio will start flowing shortly after (within ~100ms)
    /// once ScreenCaptureKit grants permission and starts the stream.
    pub fn start_capture<F>(&mut self, callback: F) -> Result<(), CaptureError>
    where
        F: Fn(&[f32], u32, f64, u32) + Send + 'static,
    {
        // Store the old pointer and drop it if there was one
        let boxed: Box<dyn Fn(&[f32], u32, f64, u32) + Send + 'static> = Box::new(callback);
        let raw = Box::into_raw(Box::new(boxed)) as usize;

        let old = CURRENT_CALLBACK.swap(raw, Ordering::SeqCst);
        if old != 0 {
            unsafe {
                drop(Box::from_raw(
                    old as *mut Box<dyn Fn(&[f32], u32, f64, u32) + Send + 'static>,
                ));
            }
        }

        let err = unsafe { audio_capture_start(self.handle, trampoline) };
        check_error(err)
    }

    pub fn stop_capture(&mut self) -> Result<(), CaptureError> {
        let err = unsafe { audio_capture_stop(self.handle) };

        // Reclaim the leaked closure after stopping
        let ptr = CURRENT_CALLBACK.swap(0, Ordering::SeqCst);
        if ptr != 0 {
            unsafe {
                drop(Box::from_raw(
                    ptr as *mut Box<dyn Fn(&[f32], u32, f64, u32) + Send + 'static>,
                ));
            }
        }

        check_error(err)
    }

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
        if self.is_capturing() {
            let _ = self.stop_capture();
        }
        unsafe { audio_capture_destroy(self.handle) };
    }
}

// ── Trampoline ───────────────────────────────────────────────────────────────

unsafe extern "C" fn trampoline(
    samples: *const c_float,
    frame_count: u32,
    sample_rate: f64,
    channel_count: u32,
) {
    let ptr = CURRENT_CALLBACK.load(Ordering::SeqCst);
    if ptr == 0 {
        return;
    }
    let cb = &*(ptr as *const Box<dyn Fn(&[f32], u32, f64, u32) + Send + 'static>);
    let slice = std::slice::from_raw_parts(samples, (frame_count * channel_count) as usize);
    cb(slice, frame_count, sample_rate, channel_count);
}