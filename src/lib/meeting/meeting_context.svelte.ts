import {reactive_timer} from '$lib/helpers/reactive_timer.svelte';
import {get_settings_context} from '$lib/settings/settings_context.svelte';
import {
    default_speaker_name,
    generate_transcript,
    parse_transcript_text,
    serialize_transcript,
    type TranscriptBlock,
} from '$lib/transcribe/generate_transcript';
import {identify_speakers as run_speaker_identification} from '$lib/transcribe/identify_speakers';
import {convertFileSrc} from '@tauri-apps/api/core';
import {exists, readDir, readTextFile, rename, writeTextFile} from '@tauri-apps/plugin-fs';
import {setContext, getContext} from 'svelte';
import {notify} from '$lib/helpers/notify';
import {catch_error} from '$lib/helpers/catch_error';

class MeetingContext {
    #settings = get_settings_context();

    meeting_name = $state('Nouvelle réunion');
    audio_raw_path = $state<string>();
    audio_asset_path = $state<string>();
    transcript = $state<TranscriptBlock[] | Error>([]);
    has_transcript_file = $state(false);
    start_recording_time = $state<Date>();
    recording_duration = $state<string>();
    transcript_timer = reactive_timer();

    folder_name = $state('');

    is_identifying_speakers = $state(false);
    is_saving_transcript = $state(false);
    #save_timer: ReturnType<typeof setTimeout> | undefined;
    #rename_timer: ReturnType<typeof setTimeout> | undefined;
    /** Set by the page so it can navigate once the debounced folder rename actually happens. */
    on_meeting_renamed?: (new_folder_name: string) => void;
    /** Set by the page so it can navigate away if the folder was removed from outside the app. */
    on_meeting_deleted?: () => void;

    transcript_text = $derived(
        this.transcript instanceof Error ? '' : serialize_transcript(this.transcript),
    );

    /** Persist the transcript to disk after a short debounce (e.g. on speaker rename). */
    #save_transcript_soon = () => {
        if (!this.#settings.save_path) return;
        this.is_saving_transcript = true;
        clearTimeout(this.#save_timer);
        const folder_path = `${this.#settings.save_path}/${this.folder_name}`;
        this.#save_timer = setTimeout(async () => {
            await writeTextFile(`${folder_path}/transcript.txt`, this.transcript_text);
            this.is_saving_transcript = false;
        }, 1000);
    };

    /**
     * Update the meeting title immediately (like a speaker rename), then rename its folder on
     * disk after a short debounce, keeping the date prefix intact.
     */
    rename_meeting = (new_title: string) => {
        this.meeting_name = new_title;
        if (!this.#settings.save_path) return;

        clearTimeout(this.#rename_timer);
        this.#rename_timer = setTimeout(async () => {
            const title = new_title.trim();
            const current_title = this.folder_name.split(' ').slice(1).join(' ');
            if (!title || title === current_title) return;

            const date_part = this.folder_name.split(' ')[0];
            const new_folder_name = `${date_part} ${title}`;
            const old_path = `${this.#settings.save_path}/${this.folder_name}`;
            const new_path = `${this.#settings.save_path}/${new_folder_name}`;

            const error = await catch_error(() => rename(old_path, new_path));
            if (error instanceof Error) {
                console.error('Failed to rename meeting folder', error);
                return;
            }

            this.folder_name = new_folder_name;
            this.on_meeting_renamed?.(new_folder_name);
        }, 1000);
    };

    /**
     * If the folder currently open no longer exists on disk, either follow it (renamed from
     * outside the app, e.g. via Finder - look for a sibling folder that kept the same date
     * prefix, the same way `rename_meeting` does for an in-app rename) or, if it's genuinely
     * gone, let the page navigate away via `on_meeting_deleted`.
     */
    resolve_external_rename = async (folder_name: string) => {
        const save_path = this.#settings.save_path;
        if (!save_path || folder_name !== this.folder_name) return;

        const folder_path = `${save_path}/${folder_name}`;
        if (await exists(folder_path)) return;

        const date_part = folder_name.split(' ')[0];
        const entries = await catch_error(() => readDir(save_path));
        if (entries instanceof Error) return;

        const candidates = entries.filter(
            (entry) => entry.isDirectory && entry.name.split(' ')[0] === date_part,
        );
        if (candidates.length === 1) {
            this.on_meeting_renamed?.(candidates[0].name);
        } else {
            this.on_meeting_deleted?.();
        }
    };

    /** Rename a speaker across every block that currently uses `old_name`. */
    rename_speaker = (old_name: string, new_name: string) => {
        if (this.transcript instanceof Error || old_name === new_name) return;
        for (const block of this.transcript) {
            if (block.speaker === old_name) block.speaker = new_name;
        }
        this.#save_transcript_soon();
    };

    speaking_time_by_speaker = $derived.by(() => {
        if (this.transcript instanceof Error || this.transcript.length === 0) {
            return [];
        }

        const speaker_time: Record<string, number> = {};
        for (let i = 0; i < this.transcript.length; i++) {
            const block = this.transcript[i];
            // A reloaded transcript has no `end` (only block starts are persisted), so
            // approximate it with the start of the next speaker turn.
            const end = block.end ?? this.transcript[i + 1]?.start ?? block.start;
            speaker_time[block.speaker] =
                (speaker_time[block.speaker] || 0) + Math.max(0, end - block.start);
        }

        const total_speaking_time = Object.values(speaker_time).reduce(
            (sum, time) => sum + time,
            0,
        );
        if (total_speaking_time === 0) return [];

        // Round to whole percentages while keeping the total at exactly 100
        // (largest-remainder method), instead of rounding each entry independently.
        const entries = Object.entries(speaker_time).map(([name, time]) => {
            const exact_percentage = (time / total_speaking_time) * 100;
            return {
                name,
                percentage: Math.floor(exact_percentage),
                remainder: exact_percentage - Math.floor(exact_percentage),
            };
        });
        let leftover = 100 - entries.reduce((sum, entry) => sum + entry.percentage, 0);
        for (const entry of [...entries].sort((a, b) => b.remainder - a.remainder)) {
            if (leftover <= 0) break;
            entry.percentage += 1;
            leftover -= 1;
        }

        return entries
            .map(({name, percentage}) => ({name, percentage}))
            .sort((a, b) => b.percentage - a.percentage);
    });

    load_meeting = async (folder_name: string) => {
        this.folder_name = folder_name;
        const parts = folder_name.split(' ');
        const title = parts.slice(1).join(' ');

        this.meeting_name = title;
        this.audio_raw_path = undefined;
        this.audio_asset_path = undefined;
        this.transcript = [];

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
        this.has_transcript_file = transcript_exists;
        if (transcript_exists) {
            const text = await readTextFile(transcript_path);
            this.transcript = parse_transcript_text(text);
        }
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
    };

    identify_speakers = async (folder_path: string) => {
        if (
            this.transcript instanceof Error ||
            this.transcript.length === 0 ||
            !this.#settings.openrouter_key ||
            this.is_identifying_speakers
        )
            return;

        this.is_identifying_speakers = true;
        const labels = await run_speaker_identification(
            this.transcript_text,
            this.#settings.openrouter_key,
            this.#settings.speaker_identification_model,
        );
        console.log('Speaker identification result:', labels);
        if (labels instanceof Error) {
            console.error('Speaker identification failed', labels);
        } else if (!(this.transcript instanceof Error)) {
            let has_new_label = false;
            for (const [speaker, label] of Object.entries(labels)) {
                // Only rename speakers still on their default "Speaker N" placeholder,
                // so a name the user (or a previous run) already assigned is never lost.
                const default_name = default_speaker_name(parseInt(speaker));
                for (const block of this.transcript) {
                    if (block.speaker === default_name) {
                        block.speaker = label;
                        has_new_label = true;
                    }
                }
            }
            if (has_new_label) {
                await writeTextFile(`${folder_path}/transcript.txt`, this.transcript_text);
            }
        }
        this.is_identifying_speakers = false;
    };

    reset = async () => {
        this.audio_raw_path = undefined;
        this.audio_asset_path = undefined;
        this.transcript = [];
        this.has_transcript_file = false;
        this.meeting_name = 'Nouvelle réunion';
    };
}

const key = Symbol();
export const set_meeting_context = () => setContext(key, new MeetingContext());
export const get_meeting_context = () => getContext<MeetingContext>(key);
