<script lang="ts">
    import {Duration} from 'luxon';
    import type {TranscriptBlock} from './generate_transcript';
    import {get_meeting_context} from '$lib/meeting/meeting_context.svelte';

    type Props = {
        transcript: TranscriptBlock[];
        duration: string;
    };
    let {transcript, duration}: Props = $props();

    const meeting = get_meeting_context();

    const format_time = (second: number) => {
        return Duration.fromMillis(second * 1000).toFormat('m:ss');
    };
</script>

<div class="flex h-full flex-col px-2">
    <div class="self-end px-4 text-sm text-fg-1">
        Durée totale : {duration}
        {meeting.speaker_names.saving ? '⌛' : '✅'}
    </div>
    {#each transcript as block, index (index)}
        <div class="border-b border-bg-1 p-4 last:border-0">
            {#if index === 0 || transcript[index - 1].speaker !== block.speaker}
                <p class="mb-2">
                    <span class="me-2 text-sm text-fg-2">{format_time(block.start)}</span>
                    <input
                        class="h-fit! rounded-none! border-none! bg-transparent! px-0! font-bold!"
                        type="text"
                        bind:value={
                            () =>
                                meeting.speaker_names.data[block.speaker] ??
                                `Speaker ${block.speaker + 1}`,
                            (newValue) => {
                                meeting.speaker_names.data[block.speaker] = newValue;
                            }
                        }
                    />
                </p>
            {/if}
            <p class="font-serif">{block.text}</p>
        </div>
    {/each}
</div>
