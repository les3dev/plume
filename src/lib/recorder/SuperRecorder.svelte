<script lang="ts">
    import {catch_error} from '$lib/helpers/catch_error';
    import MicIcon from '$lib/icons/MicIcon.svelte';
    import StopIcon from '$lib/icons/StopIcon.svelte';
    import {convertFileSrc, invoke} from '@tauri-apps/api/core';
    import {emit, listen, type UnlistenFn} from '@tauri-apps/api/event';
    import {reactive_timer} from '$lib/helpers/reactive_timer.svelte';
    import ProgressCircle from '$lib/widgets/ProgressCircle.svelte';
    import {onDestroy} from 'svelte';

    type Props = {
        /**
         * Called automatically when the recording stops
         * @param raw_path The raw filesystem path of the saved audio file, for use with fs operations.
         * @param asset_path The asset URL of the saved audio file, for use with audio playback.
         * @param start_time The start time of the recording.
         * @param duration The duration of the recording.
         */
        onfinish: (
            raw_path: string,
            asset_path: string,
            start_time: Date,
            duration: string,
        ) => void;
        onstart: () => void;
    };
    let {onfinish, onstart}: Props = $props();

    let error_message = $state<string>();
    let capture_state = $state<'initial' | 'capturing' | 'saving'>('initial');
    let timer = reactive_timer();

    let unlisten_save: UnlistenFn | undefined;

    const save_capture = async (error_msg?: string) => {
        timer.stop();
        capture_state = 'saving';
        const current_path = await catch_error(() => invoke<string>('stop_capture'));
        capture_state = 'initial';
        await emit('recording-started');
        if (current_path instanceof Error) {
            error_message = error_msg
                ? `Capture interrupted: ${error_msg}, save failed: ${current_path.message}`
                : current_path.message;
            await emit('recording-stopped');
            return;
        }
        const asset_path = catch_error(() => convertFileSrc(current_path));
        if (asset_path instanceof Error) {
            error_message = error_msg
                ? `Capture interrupted: ${error_msg}, convert failed: ${asset_path.message}`
                : asset_path.message;
            await emit('recording-stopped');
            return;
        }
        if (error_msg) {
            error_message = `Capture interrupted: ${error_msg}`;
            await emit('recording-stopped');
            return;
        }
        if (timer.start_time) {
            onfinish(current_path, asset_path, timer.start_time, timer.value);
            await emit('recording-stopped');
        }
    };

    const setup_error_listener = async () => {
        unlisten_save = await listen<string>('audio-capture-save', async (event) => {
            const error_msg = event.payload;
            error_message = `Capture interrupted: ${error_msg}`;
            await save_capture(error_msg);
        });
    };

    setup_error_listener();

    onDestroy(() => {
        unlisten_save?.();
    });

    const toggle_capture = async () => {
        if (capture_state === 'initial') {
            const error = await catch_error(() => invoke('start_capture'));
            if (error instanceof Error) {
                error_message = error.message;
                return;
            }
            timer.start();
            capture_state = 'capturing';
            onstart();
            await emit('recording-started');
        } else if (capture_state === 'capturing') {
            await save_capture();
        }
    };

    $effect(() => {
        const unlisten_start = listen('tray-start-recording', () => {
            if (capture_state === 'initial') toggle_capture();
        });

        const unlisten_stop = listen('tray-stop-recording', () => {
            if (capture_state === 'capturing') toggle_capture();
        });

        return async () => {
            (await unlisten_start)();
            (await unlisten_stop)();
        };
    });
</script>

<div class="flex flex-col items-center gap-10">
    {#if capture_state === 'saving'}
        <div class="flex grow flex-col items-center justify-center gap-4">
            <ProgressCircle --color="var(--color-primary)" show_value={false} infinite={true} />
            <div>Generating audio file…</div>
        </div>
    {:else}
        <button
            class="capture-btn relative grid h-30 w-30 cursor-pointer place-items-center rounded-full text-bg hover:scale-120 active:scale-110"
            class:is-capturing={capture_state === 'capturing'}
            onclick={toggle_capture}
            title={capture_state === 'capturing' ? 'Stop capture' : 'Start capture'}
        >
            <div class="ring" aria-hidden="true"></div>
            <div class="ring" style:animation-delay="0.5s" aria-hidden="true"></div>
            <div class="ring" style:animation-delay="1s" aria-hidden="true"></div>

            <span class="icon icon-mic"><MicIcon --size="2.5rem" /></span>
            <span class="icon icon-stop"><StopIcon --size="2.5rem" /></span>
        </button>
    {/if}

    {#if capture_state === 'capturing'}
        <div class="mt-4 font-mono text-3xl font-bold">{timer.value}</div>
    {/if}
</div>

{#if error_message !== undefined}
    <div class="p-4 text-center text-error">{error_message}</div>
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
