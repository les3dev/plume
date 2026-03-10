// build.rs
// Compiles the Swift package and tells Cargo where to find the .dylib.

use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    eprintln!(">>> build.rs running, OUT_DIR={}", env::var("OUT_DIR").unwrap_or("NOT SET".into()));

    // ── Locate the Swift package ──────────────────────────────────────────────
    // Assumes the Swift package lives one directory up from this Rust crate.
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());

    // src-tauri/audio-capture → src-tauri/ → project root → AudioCapture/
    let swift_pkg_dir = manifest_dir
        .parent().unwrap()  // src-tauri/
        .parent().unwrap()  // project root
        .join("AudioCapture");

    // ── Build the Swift package ───────────────────────────────────────────────
    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    let swift_config = if profile == "release" { "release" } else { "debug" };

    let status = Command::new("swift")
        .args(["build", "-c", swift_config])
        .current_dir(&swift_pkg_dir)
        .status()
        .expect("Failed to run `swift build`. Is Xcode / Swift installed?");

    assert!(status.success(), "Swift build failed");

    // ── Tell Cargo where the .dylib is ───────────────────────────────────────
    let arch = if cfg!(target_arch = "aarch64") {
        "arm64-apple-macosx"
    } else {
        "x86_64-apple-macosx"
    };

    let lib_dir = swift_pkg_dir
        .join(".build")
        .join(arch)
        .join(swift_config);

    println!("cargo:rustc-link-search=native={}", lib_dir.display());
    println!("cargo:rustc-link-lib=dylib=AudioCapture");

    println!("cargo:rustc-link-lib=framework=ScreenCaptureKit");
    println!("cargo:rustc-link-lib=framework=AVFoundation");
    println!("cargo:rustc-link-lib=framework=CoreAudio");
    println!("cargo:rustc-link-lib=framework=CoreMedia");

    // ── Copy the dylib next to the Cargo output binary ───────────────────────
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

    // OUT_DIR is .../target/<profile>/build/<crate>-<hash>/out
    // The binary lives at    .../target/<profile>/
    // So we go up 3 levels:  out → <crate>-<hash> → build → target/<profile>
    let target_dir = out_dir
        .parent().unwrap() // <crate>-<hash>
        .parent().unwrap() // build
        .parent().unwrap(); // target/<profile>  (e.g. target/debug)

    eprintln!(">>> target_dir resolved to: {}", target_dir.display());

    let src = lib_dir.join("libAudioCapture.dylib");
    let dst = target_dir.join("libAudioCapture.dylib");

    eprintln!(">>> Copying dylib: {} → {}", src.display(), dst.display());

    std::fs::copy(&src, &dst)
        .unwrap_or_else(|e| panic!("Failed to copy libAudioCapture.dylib to {}: {}", dst.display(), e));

    eprintln!(">>> dst exists after copy: {}", dst.exists());

    // Fix the dylib's own install name so dyld resolves it via @rpath correctly
    let status = Command::new("install_name_tool")
        .args(["-id", "@rpath/libAudioCapture.dylib", dst.to_str().unwrap()])
        .status()
        .expect("Failed to run install_name_tool");

    assert!(status.success(), "install_name_tool failed");

    // Embed @executable_path rpath so the binary finds the dylib next to itself,
    // plus an absolute fallback pointing at target/<profile> for `cargo run` / tauri dev.
    println!("cargo:rustc-link-search=native={}", target_dir.display());
    println!("cargo:rustc-link-arg=-Wl,-rpath,@executable_path");
    println!("cargo:rustc-link-arg=-Wl,-rpath,{}", target_dir.display());

    // Re-run if Swift sources change
    let swift_src = swift_pkg_dir.join("Sources/AudioCapture");
    println!("cargo:rerun-if-changed={}", swift_src.join("AudioCapture.swift").display());
    println!("cargo:rerun-if-changed={}", swift_src.join("AudioCaptureC.swift").display());
    println!("cargo:rerun-if-changed={}", swift_src.join("AudioCaptureC.h").display());
}
