<script lang="ts">
    import {startRecording, stopRecording} from "tauri-plugin-mic-recorder-api";
    import {convertFileSrc} from "@tauri-apps/api/core";
    import {catch_error} from "$lib/helpers/catch_error";

    let is_recording = $state(false);
    let error_message = $state<string>();
    let current_path = $state<string>();

    const toggle_recording = async () => {
        if (is_recording) {
            const audio_path = await catch_error(() => stopRecording());
            is_recording = false;
            if (audio_path instanceof Error) {
                error_message = error_message;
                return;
            }
            const asset_path = catch_error(() => convertFileSrc(audio_path));
            if (asset_path instanceof Error) {
                error_message = error_message;
                return;
            }
            current_path = asset_path;
        } else {
            const error = await catch_error(async () => startRecording());
            if (error instanceof Error) {
                error_message = error.message;
                return;
            }
            is_recording = true;
        }
    };
</script>

<div class="p-4 border border-bg-1 rounded-2xl">
    <button class="btn" onclick={toggle_recording}>{is_recording ? "Stop recording" : "Start recording"}</button>
    {#if error_message !== undefined}
        <div class="text-error">{error_message}</div>
    {/if}
    {#if current_path !== undefined}
        <audio controls src={current_path}>
            <track kind="captions" />
        </audio>
    {/if}
</div>
