<script lang="ts">
    import { get_upload_context } from '$lib/upload/upload_context.svelte'
    const upload = get_upload_context()

    const getSegments = () => {
        if (!upload.transcript) return []

        const words = upload.transcript.results.channels[0].alternatives[0].words
        const segments = []

        for (const word of words) {
            const lastSegment = segments[segments.length - 1]

            if (lastSegment && lastSegment.speaker === word.speaker) {
                lastSegment.text += " " + word.punctuated_word
            } else {
                segments.push({ speaker: word.speaker, text: word.punctuated_word })
            }
        }
        return segments
    }

    const segments = $derived(getSegments())
</script>

{#if upload.error}
    <p class="text-red-400">Erreur : {upload.error}</p>

{:else if upload.transcript}
    <div class="flex flex-col">
        {#each segments as segment, i}
            <div class="border-b border-bg-1 py-4 last:border-0">

                {#if i === 0 || segments[i - 1].speaker !== segment.speaker}
                    <p class="mb-2 text-sm font-bold">Speaker {segment.speaker + 1}</p>
                {/if}

                <p>{segment.text}</p>
            </div>
        {/each}
    </div>

{:else}
    <p class="text-fg-2">Transcription en cours...</p>
{/if}