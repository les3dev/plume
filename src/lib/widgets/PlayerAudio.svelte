<script lang="ts">
    import PauseIcon from '$lib/icons/PauseIcon.svelte';
    import PlayIcon from '$lib/icons/PlayIcon.svelte';
    import {Duration} from 'luxon';

    type Props = {
        src: string | undefined;
    };

    let {src}: Props = $props();
    let audio_element = $state<HTMLAudioElement>();
    let current_time = $state(0);
    let duration = $state(0);
    let volume = $state(1);
    let is_playing = $state(false);

    const format_time = (time: number) => {
        return Duration.fromMillis(time * 1000).toFormat('m:ss');
    };
    const toggle_play = async () => {
        if (!audio_element) return;
        if (audio_element.paused) {
            try {
                await audio_element.play();
                is_playing = true;
            } catch (err) {
                console.error('Error de lecture iOS:', err);
            }
        } else {
            audio_element.pause();
            is_playing = false;
        }
    };

    const handle_seek = (e: Event) => {
        if (!audio_element) return;
        audio_element.currentTime = (Number((e.target as HTMLInputElement).value) / 100) * duration;
    };

    const set_volume = (e: Event) => {
        if (!audio_element) return;
        volume = Number((e.target as HTMLInputElement).value);
        audio_element.volume = volume;
    };
    let progress = $derived(duration > 0 ? (current_time / duration) * 100 : 0);
</script>
<audio
    bind:this={audio_element}
    {src}
    ontimeupdate={() => current_time = audio_element?.currentTime ?? 0}
    onloadedmetadata={() => duration = audio_element?.duration ?? 0}
    onended={() => is_playing = false}
>
</audio>
<div class="flex items-center gap-3">
    <button class="btn ghost icon" onclick={toggle_play}>
        {#if is_playing}
            <PauseIcon />
        {:else}
            <PlayIcon />
        {/if}
    </button>

    <span class="text-sm text-fg-2">{format_time(current_time)}</span>

    <div class="relative flex-1 rounded-xl bg-bg-2 p-0.5">
        <div class="group/progress relative h-3 rounded-xl">
            <input
                type="range"
                min="0"
                max="100"
                value={progress}
                oninput={handle_seek}
                class="absolute z-20 w-full cursor-pointer opacity-0"
                style="height: 44px; top: 50%; transform: translateY(-50%)"
            />
            <div
                class="absolute h-full rounded-lg bg-primary"
                style="width: {progress}%"
            ></div>
            <div
                class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                style="left: {progress}%"
            ></div>
        </div>
    </div>

    <span class="text-sm text-fg-2">{format_time(duration)}</span>

    <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        oninput={set_volume}
        class="w-20"
    />
</div>
