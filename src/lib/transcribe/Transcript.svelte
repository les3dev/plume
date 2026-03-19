<script lang="ts">
    import {Duration} from 'luxon';
    import type {DeepgramListenResponse} from './generate_transcript';

    export type SpeechBlock = {
        speaker: number;
        text: string;
        start: number;
    };
    type Props = {
        transcript: DeepgramListenResponse;
    };
    let {transcript}: Props = $props();

    const blocks = $derived.by(() => {
        const channels = transcript.results.channels;
        const best_channel = channels.reduce((best: any, current: any) => {
            return current.alternatives[0].words.length > best.alternatives[0].words.length
                ? current
                : best;
        });

        const words = best_channel.alternatives[0].words;
        const speech_blocks: SpeechBlock[] = [];
        for (const word of words) {
            const last = speech_blocks[speech_blocks.length - 1];
            if (last && last.speaker === word.speaker) {
                last.text += ' ' + word.punctuated_word;
            } else {
                speech_blocks.push({
                    speaker: word.speaker ?? -1,
                    text: word.punctuated_word ?? '',
                    start: word.start,
                });
            }
        }
        return speech_blocks;
    });

    const format_time = (second: number) => {
        return Duration.fromMillis(second * 1000).toFormat('m:ss');
    };
</script>

<div class="flex flex-col">
    {#each blocks as block, index (index)}
        <div class="border-b border-bg-1 py-4 last:border-0">
            {#if index === 0 || blocks[index - 1].speaker !== block.speaker}
                <p class="mb-2 text-sm font-bold">
                    Speaker {block.speaker + 1}
                    <span class="text-xs text-fg-2">{format_time(block.start)}</span>
                </p>
            {/if}
            <p class="font-serif">{block.text}</p>
        </div>
    {/each}
</div>
