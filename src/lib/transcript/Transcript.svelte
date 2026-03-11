<script lang="ts">
    import { get_upload_context } from '$lib/upload/upload_context.svelte'
    const upload = get_upload_context()

    const getSegments = () => {
        if (!upload.transcript) return []
        const words = upload.transcript.results.channels[0].alternatives[0].words
        const segments: { speaker: number; text: string }[] = []
        let current: { speaker: number; text: string } | null = null

        for (const word of words) {
            if (!current || current.speaker !== word.speaker) {
                current = { speaker: word.speaker, text: word.punctuated_word }
                segments.push(current)
            } else {
                current.text += " " + word.punctuated_word
            }
        }
        return segments
    }

    const segments = $derived(getSegments())
    const uniqueSpeakers = $derived([...new Set(segments.map(s => s.speaker))])
    let speakerNames = $state<Record<number, string>>({})

    $effect(() => {
        uniqueSpeakers.forEach(speaker => {
            if (!(speaker in speakerNames)) {
                speakerNames[speaker] = `Intervenant ${speaker + 1}`
            }
        })
    })
</script>

{#if upload.error}
    <p class="text-red-400">Erreur : {upload.error}</p>
{:else if upload.transcript}
    <div class="mb-6 flex gap-3">
        {#each uniqueSpeakers as speaker}
            <input class="input" bind:value={speakerNames[speaker]} />
        {/each}
    </div>

    <div class="flex flex-col">
        {#each segments as segment, i}
            <div class="border-b border-bg-1 py-4 last:border-0">
                {#if i === 0 || segments[i - 1].speaker !== segment.speaker}
                    <p class="mb-2 text-sm font-bold">{speakerNames[segment.speaker]}</p>
                {/if}
                <p class="">{segment.text}</p>
            </div>
        {/each}
    </div>
{:else}
    <p class="text-fg-2">Transcription en cours...</p>
{/if}