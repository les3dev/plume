<script lang="ts">
    import { get_transcribe_context } from "$lib/transcribe/transcribe_context.svelte";
    import { Duration } from "luxon";

    export type SpeechBlock = {
    speaker: number;
    text: string;
    start: number;
    }
    type Props = {
        speech_block_ready?: (blocks: SpeechBlock[]) => void;
    };
    let {speech_block_ready}: Props = $props();

    $effect(() => {
        speech_block_ready?.(speech_block);
    });

    const transcribe = get_transcribe_context();

    const get_speech_blocks = () => {
        if (!transcribe.transcript){
            return []
        };

        const channels = transcribe.transcript.results.channels;
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
                speech_blocks.push({speaker: word.speaker, text: word.punctuated_word, start: word.start});
            }
        }
        return speech_blocks;
    };

    const speech_block = $derived(get_speech_blocks());

    const format_time = (second:number) => {
        return Duration.fromMillis(second * 1000).toFormat('m:ss')
    }
</script>

{#if transcribe.error}
    <p class="text-red-400">Erreur : {transcribe.error}</p>
{:else if transcribe.transcript}
    <div class="flex flex-col">
        {#each speech_block as speech_b, index}
            <div class="border-b border-bg-1 py-4 last:border-0">
                {#if index === 0 || speech_block[index - 1].speaker !== speech_b.speaker}
                    <p class="mb-2 text-sm font-bold">Speaker {speech_b.speaker + 1} <span class="text-fg-2 text-xs">{format_time(speech_b.start)}</span></p>
                {/if}
                <p class="serif">{speech_b.text}</p>
            </div>
        {/each}
    </div>
{:else}
    <p class="text-fg-2 body">Transcription en cours...</p>
{/if}