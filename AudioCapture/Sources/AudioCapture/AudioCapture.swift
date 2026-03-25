import Foundation
@preconcurrency import ScreenCaptureKit
import AVFoundation
import CoreAudio

// MARK: - C-compatible callback types
public typealias AudioDataCallback = @convention(c) (
    UnsafePointer<Float>?,
    UInt32,
    Double,
    UInt32
) -> Void

public typealias AudioErrorCallback = @convention(c) (
    UnsafePointer<CChar>?
) -> Void

// MARK: - Capture Engine

@objc public class AudioCaptureEngine: NSObject, @unchecked Sendable {

    private var stream: SCStream?
    private var streamOutput: AudioStreamOutput?
    private var isCapturing = false
    private var callback: AudioDataCallback?
    private var errorCallback: AudioErrorCallback?
    private let stateQueue = DispatchQueue(label: "com.plume.audiocapture.state")
    private var stopping = false
    private var _captureStartTime: Date?

    // Reconnect state
    private var reconnectTask: Task<Void, Never>?
    private let maxReconnectAttempts = 5
    private let reconnectDelaySeconds: Double = 2.0

    @objc public override init() {
        super.init()
    }

    // MARK: - Public API

    @objc public func startCapture(
        callback: @escaping AudioDataCallback,
        completion: @escaping (String?) -> Void
    ) {
        stateQueue.async { [weak self] in
            guard let self else { return }

            if self.isCapturing {
                completion("Already capturing")
                return
            }
            if self.stopping {
                completion("Stop in progress")
                return
            }

            self.callback = callback

            Task.detached(priority: .userInitiated) { [weak self] in
                guard let self else { return }
                if let error = await self.buildAndStartStream() {
                    self.stateQueue.sync { self.callback = nil }
                    completion(error)
                } else {
                    completion(nil)
                }
            }
        }
    }

    @objc public func stopCapture(completion: @escaping (String?) -> Void) {
        stateQueue.async { [weak self] in
            guard let self else { return }

            // Cancel any in-progress reconnect first
            self.reconnectTask?.cancel()
            self.reconnectTask = nil

            guard self.isCapturing, let stream = self.stream else {
                completion("Not currently capturing")
                return
            }

            self.isCapturing = false
            self.stopping = true
            let capturedStream = stream

            Task.detached(priority: .userInitiated) { [weak self] in
                do {
                    try await capturedStream.stopCapture()
                } catch {
                    print("[AudioCapture] Error stopping stream: \(error)")
                }
                self?.stateQueue.async {
                    self?.stream = nil
                    self?.streamOutput = nil
                    self?.callback = nil
                    self?.stopping = false
                }
                completion(nil)
            }
        }
    }

    @objc public var capturing: Bool {
        stateQueue.sync { isCapturing }
    }

    @objc public func setErrorCallback(_ callback: @escaping AudioErrorCallback) {
        stateQueue.async { [weak self] in
            self?.errorCallback = callback
        }
    }

    // MARK: - Internal

    /// Builds a fresh SCStream and starts it. Returns an error string or nil on success.
    private func buildAndStartStream() async -> String? {
        do {
            let available = try await SCShareableContent.excludingDesktopWindows(
                false, onScreenWindowsOnly: false
            )
            guard let display = available.displays.first else {
                return "No display found"
            }

            let filter = SCContentFilter(
                display: display,
                excludingApplications: [],
                exceptingWindows: []
            )

            let config = SCStreamConfiguration()
            config.capturesAudio = true
            config.excludesCurrentProcessAudio = false
            config.sampleRate = 48000
            config.channelCount = 2
            config.width = 2
            config.height = 2
            config.minimumFrameInterval = CMTime(value: 1, timescale: 1)

            let capturedCallback: AudioDataCallback = stateQueue.sync { self.callback! }
            let output = AudioStreamOutput(callback: capturedCallback, engine: self)
            let stream = SCStream(filter: filter, configuration: config, delegate: output)

            try stream.addStreamOutput(
                output,
                type: .audio,
                sampleHandlerQueue: .global(qos: .userInteractive)
            )

            // ScreenCaptureKit is a screen capture API at its core. Even when only
            // capturing audio, it tracks both audio and video stream activity internally.
            // Registering a screen output handler — even though we discard every frame —
            // prevents SCKit from considering the stream stalled and tearing it down.
            try stream.addStreamOutput(
                output,
                type: .screen,
                sampleHandlerQueue: .global(qos: .background)
            )

            try await stream.startCapture()

            stateQueue.sync {
                self.streamOutput = output
                self.stream = stream
                self.isCapturing = true
                self._captureStartTime = Date()
            }

            return nil
        } catch {
            return error.localizedDescription
        }
    }

    /// Called by AudioStreamOutput when SCKit kills the stream unexpectedly.
    /// Attempts to transparently reconnect so Rust/Tauri never sees the interruption.
    /// Only forwards an error to the callback if all reconnect attempts fail.
    func handleStreamError(_ message: String) {
        // Reset state synchronously so startCapture is valid again immediately
        stateQueue.sync {
            self.stream = nil
            self.streamOutput = nil
            self.isCapturing = false
            self.stopping = false
            self._captureStartTime = nil
        }

        print("[AudioCapture] Stream interrupted: \(message). Attempting reconnect...")

        reconnectTask = Task.detached(priority: .userInitiated) { [weak self] in
            guard let self else { return }

            for attempt in 1...self.maxReconnectAttempts {
                // Bail if stopCapture() was called while we were retrying
                if Task.isCancelled { return }

                // Back off between attempts
                if attempt > 1 {
                    try? await Task.sleep(nanoseconds: UInt64(self.reconnectDelaySeconds * Double(attempt) * 1_000_000_000))
                } else {
                    // Short initial delay to let the system settle
                    try? await Task.sleep(nanoseconds: 500_000_000)
                }

                if Task.isCancelled { return }

                // Check we still have a callback (i.e. caller hasn't explicitly stopped)
                let hasCallback = self.stateQueue.sync { self.callback != nil }
                guard hasCallback else { return }

                print("[AudioCapture] Reconnect attempt \(attempt)/\(self.maxReconnectAttempts)...")

                if let error = await self.buildAndStartStream() {
                    print("[AudioCapture] Reconnect attempt \(attempt) failed: \(error)")
                    continue
                }

                print("[AudioCapture] Reconnected successfully on attempt \(attempt)")
                return
            }

            // All attempts failed — notify the frontend
            print("[AudioCapture] All reconnect attempts failed, notifying error callback")
            self.notifyError("Stream interrupted and could not reconnect: \(message)")
        }
    }

    func notifyError(_ message: String) {
        let capturedCallback = errorCallback
        let capturedMessage = strdup(message)
        DispatchQueue.global(qos: .userInitiated).async {
            capturedCallback?(UnsafePointer(capturedMessage))
        }
    }
}

// MARK: - Stream Output Delegate

private class AudioStreamOutput: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {

    private let callback: AudioDataCallback
    private weak var engine: AudioCaptureEngine?

    init(callback: AudioDataCallback, engine: AudioCaptureEngine) {
        self.callback = callback
        self.engine = engine
    }

    // Video frames are immediately discarded — registered only to keep SCKit
    // from considering the stream stalled (see buildAndStartStream comment).
    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of type: SCStreamOutputType
    ) {
        guard type == .audio else { return }
        guard sampleBuffer.isValid else { return }

        guard let formatDesc = sampleBuffer.formatDescription,
              let asbd = formatDesc.audioStreamBasicDescription else { return }

        let sampleRate = asbd.mSampleRate
        let channelCount = asbd.mChannelsPerFrame
        let frameCount = UInt32(sampleBuffer.numSamples)

        guard frameCount > 0, channelCount > 0 else { return }

        let baseSize = MemoryLayout<AudioBufferList>.offset(of: \AudioBufferList.mBuffers)!
        let bufferSize = MemoryLayout<AudioBuffer>.stride * Int(channelCount)
        let audioBufferListSize = baseSize + bufferSize

        let audioBufferListPtr = UnsafeMutableRawPointer.allocate(
            byteCount: audioBufferListSize,
            alignment: MemoryLayout<AudioBufferList>.alignment
        )
        defer { audioBufferListPtr.deallocate() }

        let typedPtr = audioBufferListPtr.bindMemory(to: AudioBufferList.self, capacity: 1)
        var blockBufferOut: CMBlockBuffer?

        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            bufferListSizeNeededOut: nil,
            bufferListOut: typedPtr,
            bufferListSize: audioBufferListSize,
            blockBufferAllocator: nil,
            blockBufferMemoryAllocator: nil,
            flags: kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment,
            blockBufferOut: &blockBufferOut
        )

        guard status == noErr else { return }

        let numBuffers = Int(typedPtr.pointee.mNumberBuffers)
        guard numBuffers > 0 else { return }

        var interleaved = [Float](repeating: 0, count: Int(frameCount) * numBuffers)

        withUnsafePointer(to: &typedPtr.pointee.mBuffers) { mBuffersPtr in
            let buffers = UnsafeBufferPointer<AudioBuffer>(start: mBuffersPtr, count: numBuffers)
            for frame in 0..<Int(frameCount) {
                for ch in 0..<numBuffers {
                    guard let dataPtr = buffers[ch].mData else { continue }
                    let channelData = dataPtr.bindMemory(to: Float.self, capacity: Int(frameCount))
                    interleaved[frame * numBuffers + ch] = channelData[frame]
                }
            }
        }

        interleaved.withUnsafeBufferPointer { ptr in
            callback(ptr.baseAddress, frameCount, sampleRate, UInt32(numBuffers))
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("[AudioCapture] Stream stopped with error: \(error.localizedDescription)")
        engine?.handleStreamError(error.localizedDescription)
    }
}