import {browser} from '$app/environment';
import {reactive_timer} from '$lib/helpers/reactive_timer.svelte';
import {StoreContext} from '$lib/helpers/StoreContext';
import {generate_summary} from '$lib/prompt/generate_summary';
import type {Prompt} from '$lib/prompt/prompt_context.svelte';
import {get_settings_context} from '$lib/settings/settings_context.svelte';
import {
    generate_transcript,
    parse_transcript_text,
    type TranscriptBlock,
} from '$lib/transcribe/generate_transcript';
import {convertFileSrc} from '@tauri-apps/api/core';
import {exists, readTextFile, writeTextFile} from '@tauri-apps/plugin-fs';
import {setContext, getContext} from 'svelte';
import {notify} from '$lib/helpers/notify';

interface Meeting {
    name: string;
    audio_raw_path: string;
    audio_asset_path: string;
    transcript: TranscriptBlock[];
    start_recording_time: string;
    recording_duration: string;
}
const store_path = 'meeting.json';

class MeetingContext extends StoreContext {
    #settings = get_settings_context();

    meeting_name = $state('Nouvelle réunion');
    audio_raw_path = $state<string>();
    audio_asset_path = $state<string>();
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

    constructor() {
        super(store_path);
        if (browser) this.load_store();
    }

    load_store = async () => {
        const stored_meeting = await this.get_from_store<Meeting>('meeting');
        if (stored_meeting) {
            this.meeting_name = stored_meeting.name;
            this.audio_raw_path = stored_meeting.audio_raw_path;
            this.audio_asset_path = stored_meeting.audio_asset_path;
            this.transcript = stored_meeting.transcript;
            this.start_recording_time = new Date(stored_meeting.start_recording_time);
            this.recording_duration = stored_meeting.recording_duration;
        }
    };

    load_meeting = async (folder_name: string, prompts: Prompt[]) => {
        const parts = folder_name.split(' ');
        const title = parts.slice(1).join(' ');
        const prompt_files = prompts

        this.meeting_name = title;
        this.audio_raw_path = undefined;
        this.audio_asset_path = undefined;
        this.transcript = [];
        this.ai_tabs = [];
        this.selected_ai_tab = 0;
        this.tab_type = 'transcript';
        this.is_generating = false;

        if (!this.#settings.save_path) return;
        const folder_path = `${this.#settings.save_path}/${folder_name}`;

        const audio_path = `${folder_path}/capture.wav`;
        const audio_exists = await exists(audio_path);
        if (audio_exists) {
            this.audio_raw_path = audio_path;
            this.audio_asset_path = convertFileSrc(audio_path);
        }

        const transcript_path = `${folder_path}/transcript.txt`;
        const transcript_exists = await exists(transcript_path);
        if (transcript_exists) {
            const text = await readTextFile(transcript_path);
            this.transcript = parse_transcript_text(text);
        }

        for (const prompt of prompt_files) {
            const prompt_path = `${folder_path}/${prompt.title}.txt`;
            const prompt_exists = await exists(prompt_path);
            if (prompt_exists) {
                const text = await readTextFile(prompt_path);
                this.ai_tabs.push({id: prompt.id, ai_generation: text});
            }
        }
    };

    save_meeting = async () => {
        if (
            !this.start_recording_time ||
            this.transcript instanceof Error ||
            !this.recording_duration ||
            !this.audio_raw_path ||
            !this.audio_asset_path
        ) {
            return;
        }
        await this.set_to_store<Meeting>('meeting', {
            name: this.meeting_name,
            audio_raw_path: this.audio_raw_path,
            audio_asset_path: this.audio_asset_path,
            transcript: this.transcript,
            start_recording_time: this.start_recording_time.toISOString(),
            recording_duration: this.recording_duration,
        });

        await this.save_store();
    };

    start_transcript = async (raw_path: string, asset_path: string, folder_path: string) => {
        console.log('début de transcription', raw_path, asset_path);
        this.transcript_timer.start();
        this.audio_raw_path = raw_path;
        this.audio_asset_path = asset_path;
        if (this.#settings.deepgram_key) {
            this.transcript = await generate_transcript(raw_path, this.#settings.deepgram_key);
            console.log('transcript resultat', this.transcript);
            if (!(this.transcript instanceof Error) && this.transcript.length > 0) {
                await writeTextFile(`${folder_path}/transcript.txt`, this.transcript_text);
            }
        }
        this.transcript_timer.stop();
        await notify(`Transcription de "${this.meeting_name}" terminée !`);

        await this.save_meeting();
    };

    generate = async (prompt: Prompt, folder_path: string) => {
        if (
            this.ai_tabs.some((t) => t.id === prompt.id) ||
            this.is_generating ||
            !this.transcript_text
        )
            return;

        this.is_generating = true;

        this.ai_tabs.push({id: prompt.id, ai_generation: ''});
        const tab_index = this.ai_tabs.length - 1;
        this.selected_ai_tab = tab_index;
        this.tab_type = 'ai';

        const model = prompt.model ?? this.#settings.model;

        await generate_summary(
            prompt.prompt,
            this.transcript_text,
            this.#settings.openrouter_key,
            model,
            this.start_recording_time,
            this.recording_duration,
            (delta) => {
                this.ai_tabs[tab_index].ai_generation += delta;
            },
        );
        this.is_generating = false;
        if (this.ai_tabs[tab_index].ai_generation) {
            await writeTextFile(
                `${folder_path}/${prompt.title}.txt`,
                this.ai_tabs[tab_index].ai_generation,
            );
        }
        await notify(`"${prompt.title}" généré avec succès !`);
        await this.save_meeting();
    };

    reset = async () => {
        this.audio_raw_path = undefined;
        this.audio_asset_path = undefined;
        this.transcript = [];
        this.ai_tabs = [];
        this.selected_ai_tab = 0;
        this.is_generating = false;
        this.meeting_name = 'Nouvelle réunion';
        await this.set_to_store('meeting', null);
        await this.save_store();
    };
}

const key = Symbol();
export const set_meeting_context = () => setContext(key, new MeetingContext());
export const get_meeting_context = () => getContext<MeetingContext>(key);
