<script lang="ts">
    import {tick} from 'svelte';
    import {format_timestamp, type TranscriptBlock} from './generate_transcript';
    import {get_meeting_context} from '$lib/meeting/meeting_context.svelte';
    import ProgressCircle from '$lib/widgets/ProgressCircle.svelte';

    type Props = {
        transcript: TranscriptBlock[];
        query?: string;
    };
    let {transcript, query = ''}: Props = $props();

    const normalize = (text: string) =>
        text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

    /**
     * Split `text` into plain/matching segments for the current query. Accent- and
     * case-insensitive; NFD normalization can change string length, so matching is done
     * per character to keep indices aligned with the original text.
     */
    const highlight = (text: string, query: string) => {
        const needle = normalize(query.trim());
        if (!needle) return [{text, match: false}];
        let folded = '';
        const map: number[] = [];
        for (let i = 0; i < text.length; i++) {
            const part = normalize(text[i]);
            for (const _ of part) map.push(i);
            folded += part;
        }
        const segments: {text: string; match: boolean}[] = [];
        let last = 0;
        let from = 0;
        while (true) {
            const at = folded.indexOf(needle, from);
            if (at === -1) break;
            const start = map[at];
            const end = map[at + needle.length - 1] + 1;
            if (start >= last) {
                if (start > last) segments.push({text: text.slice(last, start), match: false});
                segments.push({text: text.slice(start, end), match: true});
                last = end;
            }
            from = at + needle.length;
        }
        if (last < text.length) segments.push({text: text.slice(last), match: false});
        return segments;
    };

    const match_count = $derived(
        query.trim()
            ? transcript.reduce(
                  (sum, block) => sum + highlight(block.text, query).filter((s) => s.match).length,
                  0,
              )
            : 0,
    );

    // While searching, only keep the blocks containing a match.
    const visible = $derived(
        transcript
            .map((block, index) => ({block, index}))
            .filter(
                ({block}) => !query.trim() || highlight(block.text, query).some((s) => s.match),
            ),
    );

    let container: HTMLElement | undefined = $state();
    $effect(() => {
        if (!query.trim()) return;
        // wait for the highlighted DOM to update, then bring the first match into view
        tick().then(() => container?.querySelector('mark')?.scrollIntoView({block: 'center'}));
    });

    const meeting = get_meeting_context();
</script>

<div class="flex h-full flex-col px-2" bind:this={container}>
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
        {#if query.trim()}
            <span class="font-mono text-xs text-fg-2">
                {match_count} résultat{match_count > 1 ? 's' : ''}
            </span>
        {/if}
    </div>
    {#each visible as { block, index }, position (index)}
        <div class="border-b border-bg-1 p-4 last:border-0">
            {#if position === 0 || visible[position - 1].block.speaker !== block.speaker}
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
            <p class="font-serif">
                {#each highlight(block.text, query) as segment}{#if segment.match}<mark
                            class="rounded-sm bg-primary/30 text-inherit">{segment.text}</mark
                        >{:else}{segment.text}{/if}{/each}
            </p>
        </div>
    {/each}
</div>
