// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AudioCapture",
    platforms: [
        .macOS(.v13)   // ScreenCaptureKit audio requires macOS 13+
    ],
    products: [
        // Builds as a dynamic library (.dylib) so Rust can link against it at runtime
        .library(name: "AudioCapture", type: .dynamic, targets: ["AudioCapture"]),
    ],
    targets: [
        .target(
            name: "AudioCapture",
            path: "Sources/AudioCapture",
            publicHeadersPath: ".",   // exposes AudioCaptureC.h
            swiftSettings: [
                .unsafeFlags(["-parse-as-library"])
            ],
            linkerSettings: [
                .linkedFramework("ScreenCaptureKit"),
                .linkedFramework("AVFoundation"),
                .linkedFramework("CoreAudio"),
                .linkedFramework("CoreMedia"),
            ]
        ),
    ]
)
