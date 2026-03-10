use std::process::Command;

fn main() {
    let dylib_src = "target/release/libAudioCapture.dylib";
    let dylib_dst = "libs/libAudioCapture.dylib";

    // Only copy if source exists (i.e. after the Swift lib has been built)
    if std::path::Path::new(dylib_src).exists() {
        std::fs::create_dir_all("libs").unwrap();
        std::fs::copy(dylib_src, dylib_dst).unwrap();

        // Fix the install name so dyld can find it via @rpath
        Command::new("install_name_tool")
            .args(["-id", "@rpath/libAudioCapture.dylib", dylib_dst])
            .status()
            .expect("install_name_tool failed");

        println!("cargo:rerun-if-changed=target/release/libAudioCapture.dylib");
    }

    println!("cargo:rustc-link-arg=-Wl,-rpath,@executable_path/../Resources");
    println!("cargo:rustc-link-search=native=libs");
    tauri_build::build()
}
