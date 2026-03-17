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

    private mix_down_to_mono = (): Uint8Array => {
        if (!this.audio_bytes) return new Uint8Array();

        const view = new DataView(this.audio_bytes.buffer);
        const channels = view.getUint16(22, true);
        const sample_rate = view.getUint32(24, true);
        const bit_depth = view.getUint16(34, true);

        if (channels === 1) return this.audio_bytes;
        if (bit_depth !== 32) {
            console.warn('Unexpected bit depth:', bit_depth);
            return this.audio_bytes;
        }

        const data_start = 44;
        const total_samples = (this.audio_bytes.length - data_start) / 4; // f32 = 4 bytes
        const samples_per_channel = Math.floor(total_samples / channels);

        const input = new Float32Array(this.audio_bytes.buffer, data_start);
        const output = new Float32Array(samples_per_channel);

        for (let i = 0; i < samples_per_channel; i++) {
            let sum = 0;
            for (let c = 0; c < channels; c++) {
                sum += input[i * channels + c];
            }
            output[i] = sum / channels;
        }

        // Rebuild WAV header for mono f32
        const out_buffer = new ArrayBuffer(data_start + output.byteLength);
        const out_view = new DataView(out_buffer);

        // Copy original header, then patch the channel-dependent fields
        new Uint8Array(out_buffer).set(this.audio_bytes.slice(0, data_start));
        out_view.setUint16(22, 1, true); // channels = 1
        out_view.setUint32(28, sample_rate * 1 * 4, true); // byte rate
        out_view.setUint16(32, 1 * 4, true); // block align
        out_view.setUint32(40, output.byteLength, true); // data chunk size
        out_view.setUint32(4, 36 + output.byteLength, true); // RIFF chunk size
        new Uint8Array(out_buffer, data_start).set(new Uint8Array(output.buffer));

        return new Uint8Array(out_buffer);
    };

    transcribe = async () => {
        if (!this.audio_bytes) return;

        const mono = this.mix_down_to_mono();

        const params = new URLSearchParams({
            model: 'nova-3',
            detect_language: 'true',
            punctuate: 'true',
            utterances: 'true',
            diarize: 'true', // works correctly on mono
        });

        try {
            const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
                method: 'POST',
                headers: {
                    Authorization: `Token ${this.settings.deepgram_key}`,
                },
                body: new Blob([mono.buffer as ArrayBuffer], {type: 'audio/wav'}),
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
