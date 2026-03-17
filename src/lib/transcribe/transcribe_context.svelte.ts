import {getContext, setContext} from 'svelte';
import {open} from '@tauri-apps/plugin-dialog';
import {readFile} from '@tauri-apps/plugin-fs';
import {get_settings_context} from '$lib/settings/settings_context.svelte';
import {fetch} from '@tauri-apps/plugin-http';

class TranscribeContext {
    file_name = $state<string>();
    audio_bytes = $state<Uint8Array>();
    transcript = $state<any>();
    error = $state<string>();

    constructor(private settings: ReturnType<typeof get_settings_context>) {}

    transcribe = async () => {
        if (!this.audio_bytes) return;

        // Directement audio_bytes, déjà mono f32 depuis Rust
        const params = new URLSearchParams({
            model: 'nova-3',
            smart_format: 'true',
            language: 'multi',
            punctuate: 'true',
            utterances: 'true',
            diarize: 'true',
        });

        try {
            const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
                method: 'POST',
                headers: {
                    Authorization: `Token ${this.settings.deepgram_key}`,
                    'Content-Type': 'audio/wav',
                },
                body: this.audio_bytes.buffer as ArrayBuffer,
            });
            const data = await response.json();
            if (data.err_code) {
                this.error = data.err_msg;
                return;
            }
            this.transcript = data;
        } catch (error) {
            this.error = String(error);
        }
    };

    transcribe_from_path = async (path: string) => {
        // recorder retourne un fichier waves
        this.audio_bytes = await readFile(path);
        await this.transcribe();
    };
}

const key = Symbol();
export const get_transcribe_context = () => getContext<TranscribeContext>(key);
export const set_transcribe_context = () => {
    const settings = get_settings_context();
    return setContext(key, new TranscribeContext(settings));
};
