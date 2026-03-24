swift build -c release

# Copy to target/release for Tauri build
mkdir -p ../src-tauri/target/release
cp .build/release/libAudioCapture.dylib ../src-tauri/target/release/