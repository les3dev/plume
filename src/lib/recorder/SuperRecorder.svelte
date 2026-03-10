<script lang="ts">
    import {invoke} from "@tauri-apps/api/core";
    let audio_path = $state<string>();
</script>

<div class="flex gap-4 p-4">
    <button class="btn" onclick={async () => await invoke("start_capture")}>Start capture</button>
    <button
        class="btn"
        onclick={async () => {
            audio_path = await invoke("stop_capture");
        }}>Stop capture</button
    >
</div>

<div class="pt-4">
    {#if audio_path !== undefined}
        <div>path = {audio_path}</div>
        <audio controls src={audio_path}>
            <track kind="captions" />
        </audio>
    {/if}
</div>
