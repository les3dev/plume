# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Plume is a macOS desktop app (Tauri 2 + SvelteKit 5) that records meetings (system audio + microphone), transcribes them via Deepgram, and generates AI summaries/emails/reports via OpenRouter. System audio capture uses a native Swift package (ScreenCaptureKit) linked into the Rust backend through a hand-written C FFI layer.

## Commands

Frontend (run from repo root):
- `pnpm dev` — Vite dev server only (no native window; use `pnpm tauri dev` for the full app)
- `pnpm tauri dev` — run the full Tauri app (builds the Swift dylib + Rust backend + frontend)
- `pnpm tauri build` — production build/bundle
- `pnpm check` — svelte-kit sync + svelte-check (type checking)
- `pnpm lint` — prettier `--check .`
- `pnpm format` — prettier `--write .`
- `pnpm release <version>` — bumps `package.json` version, commits, tags `v<version>`, and pushes (must be on `main`, clean tree, up to date with `origin/main`); the pushed tag triggers `.github/workflows/release.yml` which builds and publishes the Tauri app for `aarch64-apple-darwin` and `x86_64-apple-darwin`

Rust backend (`src-tauri/`):
- `cargo build` / `cargo check` from `src-tauri/` — note the `audio-capture` crate's `build.rs` invokes `swift build` on the `AudioCapture/` package and links the resulting dylib, so Xcode/Swift toolchain must be installed even for a pure Rust build
- No Rust or Swift test suite exists in this repo currently

Swift package (`AudioCapture/`):
- `./build.sh` — builds the release dylib and copies it to `src-tauri/target/release/` (mirrors what `build.rs` does for debug/release automatically; useful for manually refreshing the dylib)
- `./test.sh` / `test_capture.swift` — standalone manual test harness for the capture engine, independent of the Tauri app

There is no automated test runner wired up for any of the three languages in this repo — verify changes by running the app (`pnpm tauri dev`) and exercising the relevant flow.

## Architecture

Three layers, macOS-only, glued together at build time:

```
AudioCapture/ (Swift, ScreenCaptureKit)
   ↓ compiled to libAudioCapture.dylib by src-tauri/audio-capture/build.rs
src-tauri/audio-capture/ (Rust crate: raw FFI + safe wrapper around the dylib)
   ↓ used by
src-tauri/src/ (Tauri backend: commands, capture state, WAV writing)
   ↓ tauri::invoke + events
src/ (SvelteKit 5 frontend, runes-based state, Tauri plugins for fs/store/http)
```

### Audio capture pipeline

- `AudioCapture/Sources/AudioCapture/` — Swift/ScreenCaptureKit code that captures system audio and exposes a C ABI (`AudioCaptureC.h`/`.swift`) with callback-based delivery.
- `src-tauri/audio-capture/src/lib.rs` — raw `extern "C"` bindings to `libAudioCapture.dylib`, plus a safe `AudioCapture` wrapper. Callbacks cross the Rust/Swift boundary via a leaked-boxed-closure + `AtomicUsize` pointer stored in statics (`CURRENT_CALLBACK`/`CURRENT_ERROR_CALLBACK`) because Swift invokes the trampoline from its own audio thread, not the thread that called `start_capture` — `thread_local!` does not work here.
- `src-tauri/src/capture_state.rs` — Tauri-managed `CaptureState`: holds the system-audio engine, mic `cpal::Stream`, two independent `AudioBuffer`s (system + mic), an `unexpected_stop` flag, and the `dump_task` handle (see below). Also defines `TARGET_RATE` (16 kHz) and `DUMP_INTERVAL_SECS` (30s).
- `src-tauri/src/audio/mix.rs` — `mix_and_write`: resamples both buffers to `TARGET_RATE`, mixes them down to mono by averaging, and writes `capture.wav` via `src-tauri/src/audio/write_wav.rs`. Shared by the periodic dump and the final write on stop, so both always produce the file the same way.
- `src-tauri/src/commands/start_capture.rs` / `stop_capture.rs` — Tauri commands. `start_capture` starts both the Swift-backed system capture and a `cpal` mic input stream in parallel, buffering into two `AudioBuffer`s, and also spawns a background task (stored as `CaptureState.dump_task`) that calls `mix_and_write` every `DUMP_INTERVAL_SECS` to overwrite `capture.wav` with everything captured so far — so the file survives a crash instead of only being written at stop. `stop_capture` aborts that task, then does one final `mix_and_write`.
- `start_capture` is a **sync** command, so background work inside it must be spawned with `tauri::async_runtime::spawn`, not `tokio::spawn` — at that point there is no guarantee a Tokio reactor is active on the current thread, and `tokio::spawn` panics with "there is no reactor running". `stop_capture` is `async fn` and already runs inside Tauri's runtime, so `tokio::task::spawn_blocking` works fine there.
- Unexpected stream stops (e.g. permission revoked mid-capture) are surfaced from Swift → Rust via the error callback and re-emitted to the frontend as the `audio-capture-save` Tauri event.
- Build linkage: `src-tauri/audio-capture/build.rs` shells out to `swift build`, copies `libAudioCapture.dylib` next to the Cargo target dir, and fixes up install names/rpaths so the dylib resolves both under `cargo run`/`tauri dev` and in a bundled app. `tauri.conf.json` also bundles `target/release/libAudioCapture.dylib` as an app resource for release builds.
- `src-tauri/entitlements.plist` disables the app sandbox and grants audio-input + unsigned-executable-memory entitlements (required for ScreenCaptureKit + the dylib load). `src-tauri/capabilities/*.json` is the Tauri v2 permission manifest — broad filesystem (`$HOME/**`), HTTP (Deepgram/OpenRouter only, see `connect-src` CSP in `tauri.conf.json`), store, dialog, and notification permissions.

### Frontend state (Svelte 5 runes + Tauri store)

State is organized as Svelte context classes using `$state`/`$derived` runes, not stores. Each is created once in `src/routes/+layout.svelte` via a `set_*_context()` call and read elsewhere via `get_*_context()`:

- `settings_context.svelte.ts` — API keys (OpenRouter, Deepgram), selected AI model, save path, mail client, color scheme. Persisted to `settings.json` via the Tauri store plugin.
- `prompt_context.svelte.ts` — user-defined prompt templates (title/instructions/model), persisted to `prompts.json`. Seeded with French default prompts (Email, Compte Rendu, Résumé) on first run.
- `meetings_context.svelte.ts` — creates a new meeting folder (`<save_path>/<yyyy-MM-dd_HHmm> <title>/`).
- `meeting_context.svelte.ts` — the active meeting: loads/writes `capture.wav`, `transcript.txt`, and one `<prompt.title>.txt` file per generated AI output from/to that folder. Drives transcription (`generate_transcript`) and AI generation (`generate_summary`), tracks per-speaker names and speaking-time percentages, and holds the multi-tab AI-generation UI state.

`StoreContext` (`src/lib/helpers/StoreContext.ts`) is the shared base class wrapping `@tauri-apps/plugin-store` — both `settings_context` and `prompt_context` extend it. Each meeting's data (audio, transcript, AI outputs) lives as plain files in its own timestamped folder under `settings.save_path` rather than in a store/DB — `meeting_context` is the source of truth for that file layout.

### External services

- **Deepgram** (`src/lib/transcribe/generate_transcript.ts`) — nova-3 model, diarization + utterances enabled, called directly from the frontend with the user's API key. Response words are merged into speaker-grouped `TranscriptBlock`s; `parse_transcript_text`/inverse serialization round-trips through the `Speaker N: text` plain-text format stored in `transcript.txt`.
- **OpenRouter** (`src/lib/prompt/generate_summary.ts`, `src/lib/openrouter/openrouter.ts`) — via `@openrouter/ai-sdk-provider` + Vercel `ai` SDK's `streamText`, streamed token-by-token into the active AI tab.

### Routing

SvelteKit with `adapter-static` in SPA mode (Tauri has no Node server) — see `svelte.config.js`. Routes: `/` (meeting list), `/meeting/[name]` (meeting detail, transcript/AI tabs), `/meeting/[name]/edit`, `/settings`. `[name]` is the URL-encoded meeting folder name.

### i18n

`@les3dev/i18n` (internal package) provides `create_i18n_context`; translations live in `src/lib/i18n/translations/{en,fr}.ts`. Locale is currently hardcoded to `'en'` in `+layout.svelte` (`set_i18n_context(() => 'en')`) even though a lot of in-app UI strings and Rust-side tray menu strings are still hardcoded French — check both translation files and inline strings when changing user-facing text.

## Conventions

- Formatting is enforced by Prettier (`.prettierrc`): 4-space indent, single quotes, no bracket spacing, trailing commas, 100-char width, Tailwind class sorting via `prettier-plugin-tailwindcss`. Run `pnpm format` before committing; `pnpm lint` only checks.
- Svelte component/state files that use runes outside `.svelte` files use the `*.svelte.ts` suffix (required by Svelte 5), e.g. `meeting_context.svelte.ts`.
- Context modules follow a fixed pattern: a class with `$state` fields, a module-scoped `Symbol()` key, and paired `set_x_context()`/`get_x_context()` exports.
