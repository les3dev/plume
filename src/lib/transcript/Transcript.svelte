<script lang="ts">
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import {get_upload_context} from '$lib/upload/upload_context.svelte';

    type Props = {
        blocs_ready?: (blocs: any[]) => void;
    };
    let {blocs_ready}: Props = $props();

    $effect(() => {
        blocs_ready?.(blocs);
    });

    const upload = get_upload_context();
    // const settings = get_settings_context()

    const get_segments = () => {
        if (!upload.transcript) {
            return [];
        }

        const channels = upload.transcript.results.channels;
        const best_channel = channels.reduce((best: any, current: any) => {
            return current.alternatives[0].words.length > best.alternatives[0].words.length
                ? current
                : best;
        });

        const words = best_channel.alternatives[0].words;
        const blocs: any[] = [];
        for (const word of words) {
            const last = blocs[blocs.length - 1];
            if (last && last.speaker === word.speaker) {
                last.text += ' ' + word.punctuated_word;
            } else {
                blocs.push({speaker: word.speaker, text: word.punctuated_word});
            }
        }
        return blocs;
    };
    const blocs = $derived(get_segments());
    // let resume = $state("")
    // let chargement = $state(false)
</script>

{#if upload.error}
    <p class="text-red-400">Erreur : {upload.error}</p>
{:else if upload.transcript}
    <div class="flex flex-col">
        {#each blocs as segment, i}
            <div class="border-b border-bg-1 py-4 last:border-0">
                {#if i === 0 || blocs[i - 1].speaker !== segment.speaker}
                    <p class="mb-2 text-sm font-bold">Speaker {segment.speaker + 1}</p>
                {/if}

                <p class="serif">{segment.text}</p>
            </div>
        {/each}
    </div>
{:else}
    <p class="text-fg-2 body">Transcription en cours...</p>
{/if}
