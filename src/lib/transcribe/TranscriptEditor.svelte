<script lang="ts">
    import {Duration} from 'luxon';
    import type {TranscriptBlock} from './generate_transcript';

    type Props = {
        transcript: TranscriptBlock[];
    };
    let {transcript}: Props = $props();

    const format_time = (second: number) => {
        return Duration.fromMillis(second * 1000).toFormat('m:ss');
    };
</script>

<div class="flex flex-col">
    {#each transcript as block, index (index)}
        <div class="border-b border-bg-1 py-4 last:border-0">
            {#if index === 0 || transcript[index - 1].speaker !== block.speaker}
                <p class="mb-2 text-sm font-bold">
                    Speaker {block.speaker + 1}
                    <span class="text-xs text-fg-2">{format_time(block.start)}</span>
                </p>
            {/if}
            <p class="font-serif">{block.text}</p>
        </div>
    {/each}
</div>
