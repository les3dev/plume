<script lang="ts">
    import {format_timestamp, type TranscriptBlock} from './generate_transcript';
    import {get_meeting_context} from '$lib/meeting/meeting_context.svelte';
    import ProgressCircle from '$lib/widgets/ProgressCircle.svelte';

    type Props = {
        transcript: TranscriptBlock[];
    };
    let {transcript}: Props = $props();

    const meeting = get_meeting_context();
</script>

<div class="flex h-full flex-col px-2">
    <div
        class="sticky top-0 z-1 flex flex-wrap items-center gap-x-6 gap-y-3 bg-bg/85 px-4 pt-2 pb-4 backdrop-blur-sm"
    >
        <div class="flex items-center gap-2.5 rounded-card border border-fg-3 px-3 py-1.5">
            <span
                class="size-2 shrink-0 rounded-full"
                class:bg-success={!meeting.is_saving_transcript}
                class:bg-fg-2={meeting.is_saving_transcript}
                class:animate-pulse={meeting.is_saving_transcript}
                title={meeting.is_saving_transcript ? 'Enregistrement…' : 'Enregistré'}
            ></span>
            <div class="flex flex-col">
                <span class="text-sm text-fg-1">Durée totale</span>
                <span class="font-mono text-xs text-fg-2">{meeting.total_duration}</span>
            </div>
        </div>
        {#each meeting.speaking_time_by_speaker as speaker}
            <div class="flex max-w-56 min-w-0 items-center gap-2.5">
                <div class="shrink-0 text-[0.75rem] font-semibold">
                    <ProgressCircle
                        value={speaker.percentage / 100}
                        thickness={0.13}
                        --size="2.2rem"
                        --color="var(--color-primary)"
                        --bg="var(--color-fg-3)"
                    />
                </div>
                <div class="flex min-w-0 flex-col">
                    <span class="truncate text-sm text-fg-1" title={speaker.name}>
                        {speaker.name}
                    </span>
                    <span class="font-mono text-xs text-fg-2">
                        {format_timestamp(speaker.seconds)}
                    </span>
                </div>
            </div>
        {/each}
    </div>
    {#each transcript as block, index (index)}
        <div class="border-b border-bg-1 p-4 last:border-0">
            {#if index === 0 || transcript[index - 1].speaker !== block.speaker}
                <p class="mb-2">
                    <span class="me-2 text-sm text-fg-2">{format_timestamp(block.start)}</span>
                    <input
                        class="h-fit! rounded-none! border-none! bg-transparent! px-0! font-bold!"
                        type="text"
                        bind:value={
                            () => block.speaker,
                            (newValue) => meeting.rename_speaker(block.speaker, newValue)
                        }
                    />
                </p>
            {/if}
            <p class="font-serif">{block.text}</p>
        </div>
    {/each}
</div>
