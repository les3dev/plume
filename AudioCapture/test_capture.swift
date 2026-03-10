import Foundation
import AVFoundation

// Simple WAV file writer that directly writes float32 PCM samples
final class WavWriter {
    private let fileHandle: FileHandle
    private var dataByteCount: UInt32 = 0
    let sampleRate: UInt32
    let channelCount: UInt32

    init?(url: URL, sampleRate: UInt32, channelCount: UInt32) {
        self.sampleRate = sampleRate
        self.channelCount = channelCount

        // Create the file
        FileManager.default.createFile(atPath: url.path, contents: nil)
        guard let fh = try? FileHandle(forWritingTo: url) else { return nil }
        self.fileHandle = fh

        // Write placeholder header (we'll fill it in on close)
        writeHeader()
    }

    func write(samples: UnsafePointer<Float>, count: Int) {
        var data = Data(count: count * 4)
        data.withUnsafeMutableBytes { ptr in
            let floats = ptr.bindMemory(to: Float.self)
            for i in 0..<count {
                floats[i] = samples[i]
            }
        }
        fileHandle.write(data)
        dataByteCount += UInt32(count * 4)
    }

    func close() {
        // Seek back and rewrite the header with correct sizes
        fileHandle.seek(toFileOffset: 0)
        writeHeader()
        fileHandle.closeFile()
    }

    private func writeHeader() {
        let byteRate = sampleRate * channelCount * 4  // float32 = 4 bytes
        let blockAlign = channelCount * 4
        var header = Data()

        func append(_ string: String) {
            header.append(contentsOf: string.utf8)
        }
        func appendUInt32LE(_ value: UInt32) {
            var v = value.littleEndian
            withUnsafeBytes(of: &v) { header.append(contentsOf: $0) }
        }
        func appendUInt16LE(_ value: UInt16) {
            var v = value.littleEndian
            withUnsafeBytes(of: &v) { header.append(contentsOf: $0) }
        }

        append("RIFF")
        appendUInt32LE(36 + dataByteCount)   // file size - 8
        append("WAVE")
        append("fmt ")
        appendUInt32LE(18)                    // chunk size (18 for IEEE float)
        appendUInt16LE(3)                     // audio format: 3 = IEEE float
        appendUInt16LE(UInt16(channelCount))
        appendUInt32LE(sampleRate)
        appendUInt32LE(byteRate)
        appendUInt16LE(UInt16(blockAlign))
        appendUInt16LE(32)                    // bits per sample
        appendUInt16LE(0)                     // extension size
        append("data")
        appendUInt32LE(dataByteCount)

        fileHandle.write(header)
    }
}

// Context passed through the C callback via unmanaged pointer
final class CaptureContext {
    let writer: WavWriter
    var framesCaptured = 0

    init(writer: WavWriter) {
        self.writer = writer
    }
}

@main
struct TestCapture {
    static func main() {
        let engine = AudioCaptureEngine()
        let startSemaphore = DispatchSemaphore(value: 0)
        let stopSemaphore = DispatchSemaphore(value: 0)

        let outputURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("test_output.wav")

        guard let writer = WavWriter(url: outputURL, sampleRate: 48000, channelCount: 2) else {
            print("❌ Could not create WAV file")
            exit(1)
        }

        print("📁 Writing to: \(outputURL.path)")

        let context = CaptureContext(writer: writer)
        captureContextPtr = Unmanaged.passRetained(context).toOpaque()

        engine.startCapture(callback: { samples, frameCount, rate, channels in
            guard let ptr = captureContextPtr,
                  let samples = samples else { return }

            let ctx = Unmanaged<CaptureContext>.fromOpaque(ptr).takeUnretainedValue()
            let totalSamples = Int(frameCount) * Int(channels)

            ctx.writer.write(samples: samples, count: totalSamples)
            ctx.framesCaptured += Int(frameCount)

            if ctx.framesCaptured % 48000 == 0 {
                print("⏺ Recorded \(ctx.framesCaptured / 48000)s...")
            }
        }) { error in
            if let error = error {
                print("❌ Start error: \(error)")
                exit(1)
            } else {
                print("✅ Capture started! Recording 10 seconds...")
                startSemaphore.signal()
            }
        }

        DispatchQueue.global().async {
            startSemaphore.wait()
            Thread.sleep(forTimeInterval: 10)

            engine.stopCapture { error in
                if let ptr = captureContextPtr {
                    let ctx = Unmanaged<CaptureContext>.fromOpaque(ptr).takeRetainedValue()
                    ctx.writer.close()
                    captureContextPtr = nil
                }

                if let error = error {
                    print("❌ Stop error: \(error)")
                } else {
                    print("✅ Stopped cleanly")
                    print("🎵 Saved to: \(outputURL.path)")
                    print("   Open with: open \(outputURL.path)")
                }
                stopSemaphore.signal()
            }

            stopSemaphore.wait()
            exit(0)
        }

        RunLoop.main.run()
    }
}

var captureContextPtr: UnsafeMutableRawPointer? = nil