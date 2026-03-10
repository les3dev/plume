import Foundation

// MARK: - C ABI Bridge
// These @_cdecl functions are the symbols Rust (or any C caller) links against.

@_cdecl("audio_capture_create")
public func audio_capture_create() -> UnsafeMutableRawPointer {
    let engine = AudioCaptureEngine()
    // Retain the object manually so ARC doesn't release it
    return Unmanaged.passRetained(engine).toOpaque()
}

@_cdecl("audio_capture_destroy")
public func audio_capture_destroy(_ handle: UnsafeMutableRawPointer) {
    Unmanaged<AudioCaptureEngine>.fromOpaque(handle).release()
}

@_cdecl("audio_capture_start")
public func audio_capture_start(
    _ handle: UnsafeMutableRawPointer,
    _ callback: @escaping AudioDataCallback
) -> UnsafePointer<CChar>? {
    let engine = Unmanaged<AudioCaptureEngine>.fromOpaque(handle).takeUnretainedValue()
    
    let semaphore = DispatchSemaphore(value: 0)
    var errorResult: String? = nil
    
    engine.startCapture(callback: callback) { error in
        errorResult = error
        semaphore.signal()
    }
    
    semaphore.wait()
    
    if let err = errorResult {
        // Caller is responsible for free()-ing this
        return UnsafePointer(strdup(err))
    }
    return nil
}

@_cdecl("audio_capture_stop")
public func audio_capture_stop(_ handle: UnsafeMutableRawPointer) -> UnsafePointer<CChar>? {
    let engine = Unmanaged<AudioCaptureEngine>.fromOpaque(handle).takeUnretainedValue()
    
    let semaphore = DispatchSemaphore(value: 0)
    var errorResult: String? = nil
    
    engine.stopCapture { error in
        errorResult = error
        semaphore.signal()
    }
    
    semaphore.wait()
    
    if let err = errorResult {
        return UnsafePointer(strdup(err))
    }
    return nil
}

@_cdecl("audio_capture_is_capturing")
public func audio_capture_is_capturing(_ handle: UnsafeMutableRawPointer) -> Bool {
    let engine = Unmanaged<AudioCaptureEngine>.fromOpaque(handle).takeUnretainedValue()
    return engine.capturing
}

@_cdecl("audio_capture_free_error")
public func audio_capture_free_error(_ error: UnsafePointer<CChar>?) {
    guard let e = error else { return }
    free(UnsafeMutableRawPointer(mutating: e))
}
