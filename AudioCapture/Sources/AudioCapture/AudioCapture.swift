import Foundation
import ScreenCaptureKit
import AVFoundation
import CoreAudio

// MARK: - C-compatible callback type
// Called from Rust with: audio data pointer, frame count, sample rate, channel count
public typealias AudioDataCallback = @convention(c) (
    UnsafePointer<Float>?,  // interleaved float samples
    UInt32,                  // frame count
    Double,                  // sample rate
    UInt32                   // channel count
) -> Void

// MARK: - Capture Engine

@objc public class AudioCaptureEngine: NSObject {

    private var stream: SCStream?
    private var streamOutput: AudioStreamOutput?
    private var isCapturing = false
    private var callback: AudioDataCallback?
    private let stateLock = NSLock()

    @objc public override init() {
        super.init()
    }

    /// Start capturing system audio (all apps, no microphone).
    /// - Parameters:
    ///   - callback: C function pointer called for each audio buffer.
    ///   - completion: Called with nil on success, or an error message on failure.
    @objc public func startCapture(
        callback: @escaping AudioDataCallback,
        completion: @escaping (String?) -> Void
    ) {
        stateLock.lock()
        guard !isCapturing else {
            stateLock.unlock()
            completion("Already capturing")
            return
        }

        self.callback = callback
        stateLock.unlock()

        Task.detached(priority: .userInitiated) {
            do {
                let available = try await SCShareableContent.excludingDesktopWindows(
                    false, onScreenWindowsOnly: false
                )

                guard let display = available.displays.first else {
                    completion("No display found")  // ← No MainActor
                    return
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

                let output = AudioStreamOutput(callback: callback, engine: self)
                let stream = SCStream(filter: filter, configuration: config, delegate: output)
                try stream.addStreamOutput(
                    output,
                    type: .audio,
                    sampleHandlerQueue: .global(qos: .userInteractive)
                )
                try await stream.startCapture()

                // Update state on a background queue instead of MainActor
                DispatchQueue.global(qos: .userInitiated).async {
                    self.stateLock.lock()
                    self.streamOutput = output
                    self.stream = stream
                    self.isCapturing = true
                    self.stateLock.unlock()
                    completion(nil)  // ← No MainActor
                }

            } catch {
                completion(error.localizedDescription)  // ← No MainActor
            }
        }
    }

    /// Stop capturing system audio.
    @objc public func stopCapture(completion: @escaping (String?) -> Void) {
        stateLock.lock()
        guard isCapturing, let stream = stream else {
            stateLock.unlock()
            completion("Not currently capturing")
            return
        }

        // Clear state immediately to prevent double-stop
        self.stream = nil
        self.streamOutput = nil
        self.isCapturing = false
        self.callback = nil
        stateLock.unlock()

        Task.detached(priority: .userInitiated) {
            do {
                try await stream.stopCapture()
                completion(nil)
            } catch {
                // Stream may have already stopped - this is not an error
                let errorMessage = error.localizedDescription.lowercased()
                if errorMessage.contains("already stopped") || errorMessage.contains("does not exist") {
                    completion(nil)
                } else {
                    completion(error.localizedDescription)
                }
            }
        }
    }

    @objc public var capturing: Bool {
        stateLock.lock()
        defer { stateLock.unlock() }
        return isCapturing
    }

    func resetState() {
        stateLock.lock()
        self.stream = nil
        self.streamOutput = nil
        self.isCapturing = false
        self.callback = nil
        stateLock.unlock()
    }
}

// MARK: - Stream Output Delegate

private class AudioStreamOutput: NSObject, SCStreamOutput, SCStreamDelegate {

    private let callback: AudioDataCallback
    private weak var engine: AudioCaptureEngine?

    init(callback: @escaping AudioDataCallback, engine: AudioCaptureEngine) {
        self.callback = callback
        self.engine = engine
    }

    // Called by ScreenCaptureKit for every audio buffer
    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of type: SCStreamOutputType
    ) {
        guard type == .audio else { return }
        guard sampleBuffer.isValid else { return }

        // Extract format description
        guard let formatDesc = sampleBuffer.formatDescription,
              let asbd = formatDesc.audioStreamBasicDescription else { return }

        let sampleRate = asbd.mSampleRate
        let channelCount = asbd.mChannelsPerFrame
        let frameCount = UInt32(sampleBuffer.numSamples)

        guard frameCount > 0, channelCount > 0 else { return }

        // Calculate the correct size for AudioBufferList with `channelCount` buffers.
        // The default MemoryLayout<AudioBufferList>.size only fits 1 AudioBuffer —
        // using it for 2+ channels causes memory corruption and app hangs.
        let baseSize = MemoryLayout<AudioBufferList>.offset(of: \AudioBufferList.mBuffers)!
        let bufferSize = MemoryLayout<AudioBuffer>.stride * Int(channelCount)
        let audioBufferListSize = baseSize + bufferSize

        // Allocate on the heap with the correct size
        let audioBufferListPtr = UnsafeMutableRawPointer.allocate(
            byteCount: audioBufferListSize,
            alignment: MemoryLayout<AudioBufferList>.alignment
        )
        defer { audioBufferListPtr.deallocate() }

        let typedPtr = audioBufferListPtr.bindMemory(
            to: AudioBufferList.self,
            capacity: 1
        )

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

        // Access the buffers safely — non-interleaved: one AudioBuffer per channel
        let numBuffers = Int(typedPtr.pointee.mNumberBuffers)
        guard numBuffers > 0 else { return }

        // Convert non-interleaved (planar) Float32 → interleaved Float32
        let totalSamples = Int(frameCount) * numBuffers
        var interleaved = [Float](repeating: 0, count: totalSamples)

        // Use withUnsafePointer to keep the pointer valid for the full scope
        withUnsafePointer(to: &typedPtr.pointee.mBuffers) { mBuffersPtr in
            let buffers = UnsafeBufferPointer<AudioBuffer>(
                start: mBuffersPtr,
                count: numBuffers
            )
            for frame in 0..<Int(frameCount) {
                for ch in 0..<numBuffers {
                    guard let dataPtr = buffers[ch].mData else { continue }
                    let channelData = dataPtr.bindMemory(
                        to: Float.self,
                        capacity: Int(frameCount)
                    )
                    interleaved[frame * numBuffers + ch] = channelData[frame]
                }
            }
        }

        interleaved.withUnsafeBufferPointer { ptr in
            callback(ptr.baseAddress, frameCount, sampleRate, UInt32(numBuffers))
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("[AudioCapture] Stream stopped with error: \(error)")
        // Reset state when stream stops unexpectedly
        engine?.resetState()
    }
}