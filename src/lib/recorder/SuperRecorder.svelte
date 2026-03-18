<script lang="ts">
    import {catch_error} from '$lib/helpers/catch_error';
    import {reactive_now} from '$lib/helpers/reactive_now.svelte';
    import MicIcon from '$lib/icons/MicIcon.svelte';
    import StopIcon from '$lib/icons/StopIcon.svelte';
    import {convertFileSrc, invoke} from '@tauri-apps/api/core';
    import {SvelteDate} from 'svelte/reactivity';
    import {Duration} from 'luxon';

    type Props = {
        /**
         * Called automatically when the recording stops
         * @param audio_path The path of the saved save file, will be overwritten with the next recording.
         */
        onfinish: (audio_path: string) => void;
        onstart: () => void
    };
    let {onfinish, onstart}: Props = $props();

    let audio_path = $state<string>();
    let error_message = $state<string>();
    let is_capturing = $state(false);
    let start_time = $state<SvelteDate>();
    const now = reactive_now({scale: 1, interval: 1000});
    const elapsed = $derived(
        Duration.fromMillis(Math.max(0, now.getTime() - (start_time?.getTime() ?? now.getTime())))
            .shiftTo('hours', 'minutes', 'seconds')
            .toFormat('hh:mm:ss'),
    );

    const toggle_capture = async () => {
        if (!is_capturing) {
            const error = await catch_error(() => invoke('start_capture'));
            if (error instanceof Error) {
                error_message = error.message;
                return;
            }
            start_time = new SvelteDate();
            is_capturing = true;
            onstart()
        } else {
            start_time = undefined;
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

<div class="flex flex-col items-center gap-6">
    <button
        class="capture-btn relative grid h-40 w-40 cursor-pointer place-items-center rounded-full text-bg hover:scale-120 active:scale-110"
        class:is-capturing={is_capturing}
        onclick={toggle_capture}
        title={is_capturing ? 'Stop capture' : 'Start capture'}
    >
        <div class="ring" aria-hidden="true"></div>
        <div class="ring" style:animation-delay="0.5s" aria-hidden="true"></div>
        <div class="ring" style:animation-delay="1s" aria-hidden="true"></div>

        <span class="icon icon-mic"><MicIcon --size="3.5rem" /></span>
        <span class="icon icon-stop"><StopIcon --size="3.5rem" /></span>
    </button>

    {#if is_capturing}
        <div class="text-xl font-bold">{elapsed}</div>
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
