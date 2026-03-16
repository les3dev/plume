use std::path::Path;
use std::process::Command;

fn main() {
    // 1. Point to where the Swift lib actually lives
    let dylib_path = "target/release/libAudioCapture.dylib";

    if Path::new(dylib_path).exists() {
        // 2. Run your install_name_tool on the file in-place in target/
        Command::new("install_name_tool")
            .args(["-id", "@rpath/libAudioCapture.dylib", dylib_path])
            .status()
            .expect("install_name_tool failed");

        // 3. Tell Cargo to watch the SOURCE of the lib, not the copy destination
        println!("cargo:rerun-if-changed={}", dylib_path);

        // 4. Tell Cargo to look in target/release for the library during linking
        println!("cargo:rustc-link-search=native=target/release");
    }

    println!("cargo:rustc-link-arg=-Wl,-rpath,@executable_path/../Resources");

    tauri_build::build()
}
