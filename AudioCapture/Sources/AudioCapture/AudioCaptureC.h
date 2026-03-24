// AudioCaptureC.h
// C interface for the AudioCapture Swift library.
// Include this header in your Rust build.rs or bindgen invocation.

#pragma once
#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/// Opaque handle to the AudioCaptureEngine Swift object.
typedef void* AudioCaptureHandle;

/// Audio data callback — called on a high-priority background thread.
/// @param samples   Interleaved Float32 PCM samples (frameCount * channelCount floats).
/// @param frameCount   Number of audio frames in this buffer.
/// @param sampleRate   Sample rate in Hz (typically 48000).
/// @param channelCount Number of channels (typically 2).
typedef void (*AudioDataCallback)(
    const float* samples,
    uint32_t     frameCount,
    double       sampleRate,
    uint32_t     channelCount
);

/// Error callback — called when the audio stream is unexpectedly stopped by the system.
/// Common reasons: system interruptions, privacy changes, resource constraints.
/// @param error Null-terminated error message string. Caller must free() this string.
typedef void (*AudioErrorCallback)(const char* error);

/// Create a new capture engine. Must be freed with audio_capture_destroy().
AudioCaptureHandle audio_capture_create(void);

/// Free a capture engine previously created with audio_capture_create().
void audio_capture_destroy(AudioCaptureHandle handle);

/// Start capturing system audio (all apps, no microphone).
/// Blocks until the stream has started (or failed).
/// @return NULL on success, or a malloc'd C string with the error message.
///         Caller must free() the returned string on error.
const char* audio_capture_start(AudioCaptureHandle handle, AudioDataCallback callback);

/// Stop capturing system audio.
/// Blocks until the stream has stopped (or failed).
/// @return NULL on success, or a malloc'd C string with the error message.
///         Caller must free() the returned string on error.
const char* audio_capture_stop(AudioCaptureHandle handle);

/// Returns true if the engine is currently capturing.
bool audio_capture_is_capturing(AudioCaptureHandle handle);

/// Free an error string returned by audio_capture_start or audio_capture_stop.
void audio_capture_free_error(const char* error);

/// Set a callback to be invoked when the audio stream is unexpectedly stopped.
/// This should be set before calling audio_capture_start().
void audio_capture_set_error_callback(AudioCaptureHandle handle, AudioErrorCallback callback);

#ifdef __cplusplus
}
#endif
