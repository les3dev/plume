<script lang="ts">
    import {catch_error} from '$lib/helpers/catch_error';
    import MicIcon from '$lib/icons/MicIcon.svelte';
    import StopIcon from '$lib/icons/StopIcon.svelte';
    import {convertFileSrc, invoke} from '@tauri-apps/api/core';
    import {reactive_timer} from '$lib/helpers/reactive_timer.svelte';

    type Props = {
        /**
         * Called automatically when the recording stops
         * @param audio_path The path of the saved save file, will be overwritten with the next recording.
         */
        onfinish: (audio_path: string) => void;
        onstart: () => void;
    };
    let {onfinish, onstart}: Props = $props();

    let audio_path = $state<string>();
    let error_message = $state<string>();
    let is_capturing = $state(false);
    let timer = reactive_timer();

    const toggle_capture = async () => {
        if (!is_capturing) {
            const error = await catch_error(() => invoke('start_capture'));
            if (error instanceof Error) {
                error_message = error.message;
                return;
            }
            timer.start();
            is_capturing = true;
            onstart();
        } else {
            timer.stop();
            const current_path = await catch_error(() => invoke<string>('stop_capture'));
            if (current_path instanceof Error) {
                error_message = current_path.message;
                is_capturing = false;
                return;
            }
            const asset_path = catch_error(() => convertFileSrc(current_path));
            if (asset_path instanceof Error) {
                error_message = asset_path.message;
                is_capturing = false;
                return;
            }
            audio_path = asset_path;
            onfinish(audio_path);
            is_capturing = false;
        }
    };
</script>

<div class="flex flex-col items-center gap-10">
    <button
        class="capture-btn relative grid h-30 w-30 cursor-pointer place-items-center rounded-full text-bg hover:scale-120 active:scale-110"
        class:is-capturing={is_capturing}
        onclick={toggle_capture}
        title={is_capturing ? 'Stop capture' : 'Start capture'}
    >
        <div class="ring" aria-hidden="true"></div>
        <div class="ring" style:animation-delay="0.5s" aria-hidden="true"></div>
        <div class="ring" style:animation-delay="1s" aria-hidden="true"></div>

        <span class="icon icon-mic"><MicIcon --size="2.5rem" /></span>
        <span class="icon icon-stop"><StopIcon --size="2.5rem" /></span>
    </button>

    {#if is_capturing}
        <div class="font-mono text-3xl font-bold mt-4">{timer.value}</div>
    {/if}
</div>

{#if error_message !== undefined}
    <div class="text-error">{error_message}</div>
{/if}

<style>
    .capture-btn {
        background-color: var(--color-primary);
        transition:
            background-color 0.5s ease,
            scale 0.3s ease;
    }

    .capture-btn.is-capturing {
        background-color: var(--color-error);
    }

    /* Icons */
    .icon {
        position: absolute;
        display: grid;
        place-items: center;
        transition:
            opacity 0.3s ease,
            scale 0.3s ease;
        font-size: 8rem;
    }

    .icon-mic {
        opacity: 1;
        scale: 1;
    }
    .icon-stop {
        opacity: 0;
        scale: 0.6;
    }

    .is-capturing .icon-mic {
        opacity: 0;
        scale: 0.6;
    }
    .is-capturing .icon-stop {
        opacity: 1;
        scale: 1;
    }

    /* Rings */
    .ring {
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: 9999px;
        opacity: 0;
        background-color: var(--color-primary);
        transition: background-color 0.4s ease;
    }

    .is-capturing .ring {
        background-color: var(--color-error);
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0% {
            opacity: 0.4;
            scale: 1;
        }
        60% {
            opacity: 0;
            scale: 1.6;
        }
        100% {
            opacity: 0;
            scale: 1.6;
        }
    }
</style>
