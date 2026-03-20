import {reactive_timer} from '$lib/helpers/reactive_timer.svelte';
import {generate_summary} from '$lib/prompt/generate_summary';
import type {Prompt} from '$lib/prompt/prompt_context.svelte';
import {get_settings_context} from '$lib/settings/settings_context.svelte';
import {generate_transcript, type TranscriptBlock} from '$lib/transcribe/generate_transcript';
import {setContext, getContext} from 'svelte';

class MeetingContext {
    #settings = get_settings_context();

    meeting_name = $state('Nouvelle réunion');
    audio_path = $state<string>();
    transcript = $state<TranscriptBlock[] | Error>([]);
    start_recording_time = $state<Date>();
    recording_duration = $state<string>();
    transcript_timer = reactive_timer();

    tab_type = $state<'transcript' | 'ai'>('transcript');
    ai_tabs = $state<{id: string; ai_generation: string}[]>([]);
    selected_ai_tab = $state(0);
    is_generating = $state(false);

    transcript_text = $derived(
        this.transcript instanceof Error
            ? ''
            : this.transcript.map((s) => `Speaker ${s.speaker + 1}: ${s.text}`).join('\n\n'),
    );

    start_transcript = async (raw_path: string, asset_path: string) => {
        this.transcript_timer.start();
        this.audio_path = asset_path;
        if (this.#settings.deepgram_key) {
            this.transcript = await generate_transcript(raw_path, this.#settings.deepgram_key);
        }
        this.transcript_timer.stop();
    };

    generate = async (prompt: Prompt) => {
        if (
            this.ai_tabs.some((t) => t.id === prompt.id) ||
            this.is_generating ||
            !this.transcript_text
        )
            return;
        this.is_generating = true;
        this.ai_tabs.push({id: prompt.id, ai_generation: ''});
        this.selected_ai_tab = this.ai_tabs.length - 1;
        this.tab_type = 'ai';
        this.ai_tabs[this.selected_ai_tab].ai_generation = await generate_summary(
            prompt.prompt,
            this.transcript_text,
            this.#settings.openrouter_key,
            this.#settings.model,
            this.start_recording_time,
            this.recording_duration,
        );
        this.is_generating = false;
    };

    reset = () => {
        this.audio_path = undefined;
        this.transcript = [];
        this.ai_tabs = [];
        this.selected_ai_tab = 0;
        this.is_generating = false;
        this.meeting_name = 'Nouvelle réunion';
    };
}

const key = Symbol();
export const set_meeting_context = () => setContext(key, new MeetingContext());
export const get_meeting_context = () => getContext<MeetingContext>(key);
