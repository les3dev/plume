<script lang="ts">
    import {catch_error} from "$lib/helpers/catch_error";
    import {convertFileSrc, invoke} from "@tauri-apps/api/core";
    let audio_path = $state<string>();

    let error_message = $state<string>();
    let is_capturing = $state(false);
    const start_capture = async () => {
        const error = await catch_error(() => invoke("start_capture"));
        if (error instanceof Error) {
            error_message = error.message;
            return;
        }
        is_capturing = true;
    };

    const end_capture = async () => {
        const current_path = await catch_error(() => invoke<string>("stop_capture"));
        if (current_path instanceof Error) {
            error_message = current_path.message;
            is_capturing = false;
            return;
        }
        const asset_path = catch_error(() => convertFileSrc(current_path));
        if (asset_path instanceof Error) {
            error_message = error_message;
            is_capturing = false;
            return;
        }
        audio_path = asset_path;
        is_capturing = false;
    };
</script>

<div class="p-4 border border-bg-1 rounded-2xl flex flex-col gap-4">
    <div class="flex gap-4">
        <button class="btn" disabled={is_capturing} onclick={start_capture}>Start capture</button>
        <button class="btn" disabled={!is_capturing} onclick={end_capture}>Stop capture</button>
    </div>

    {#if error_message !== undefined}
        <div class="text-error">{error_message}</div>
    {/if}

    {#if audio_path !== undefined}
        <audio controls src={audio_path}>
            <track kind="captions" />
        </audio>
    {/if}
</div>
