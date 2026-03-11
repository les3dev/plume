<script lang="ts">
    import {startRecording, stopRecording} from "tauri-plugin-mic-recorder-api";
    import {convertFileSrc} from "@tauri-apps/api/core";
    import {catch_error} from "$lib/helpers/catch_error";
	import PlayIcon from "$lib/icons/PlayIcon.svelte";
	import PauseIcon from "$lib/icons/PauseIcon.svelte";

    type Props = {
        hidden?: boolean,
        audio_ready?: (path:string) => void
    } 
    let {audio_ready, hidden = false} : Props = $props()

    let is_recording = $state(false);
    let error_message = $state<string>();
    let current_path = $state<string>();

    const toggle_recording = async () => {
        if (is_recording) {
            const audio_path = await catch_error(() => stopRecording());
            console.log("audio_path", audio_path)
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
            audio_ready?.(audio_path)  
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
{#if !hidden}
    <div class="p-8 rounded-2xl">
        <button class="btn py-8! rounded-full!" onclick={toggle_recording}>
            {#if is_recording}
            <PauseIcon/>  Stop recording 
            {:else}
            <PlayIcon/>  Start recording 
            {/if}
        </button>
        {#if error_message !== undefined}
            <div class="text-error">{error_message}</div>
        {/if}
        {#if current_path !== undefined}
            <audio controls src={current_path}>
                <track kind="captions" />
            </audio>
        {/if}
    </div>
{/if}
