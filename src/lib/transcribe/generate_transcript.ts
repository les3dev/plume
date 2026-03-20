import {catch_error} from '$lib/helpers/catch_error';
import {readFile, BaseDirectory} from '@tauri-apps/plugin-fs';

interface DeepgramListenResponse {
    metadata: {
        transaction_key: string;
        request_id: string;
        sha256: string;
        created: string; // ISO 8601 datetime
        duration: number; // seconds
        channels: number;
        models: string[];
        model_info: Record<
            string,
            {
                name: string;
                version: string;
                arch: string;
            }
        >;
    };
    results: {
        channels: Array<{
            alternatives: Array<{
                transcript: string;
                confidence: number; // 0–1
                words: Array<{
                    word: string;
                    start: number; // seconds
                    end: number;
                    confidence: number;
                    punctuated_word?: string;
                    speaker?: number; // if diarization enabled
                    speaker_confidence?: number;
                }>;
                paragraphs?: {
                    transcript: string;
                    paragraphs: Array<{
                        sentences: Array<{
                            text: string;
                            start: number;
                            end: number;
                        }>;
                        start: number;
                        end: number;
                        num_words: number;
                        speaker?: number;
                    }>;
                };
            }>;
            detected_language?: string; // if language detection enabled
            language_confidence?: number;
        }>;
        utterances?: Array<{
            // if utterances enabled
            start: number;
            end: number;
            confidence: number;
            channel: number;
            transcript: string;
            words: Array<{
                word: string;
                start: number;
                end: number;
                confidence: number;
                speaker?: number;
            }>;
            speaker?: number;
            id: string;
        }>;
        summary?: {
            // if summarization enabled
            short: string;
            result: string;
        };
        topics?: {
            // if topic detection enabled
            segments: Array<{
                text: string;
                start_word: number;
                end_word: number;
                topics: Array<{topic: string; confidence: number}>;
            }>;
        };
        intents?: {
            // if intent recognition enabled
            segments: Array<{
                text: string;
                start_word: number;
                end_word: number;
                intents: Array<{intent: string; confidence: number}>;
            }>;
        };
        sentiments?: {
            // if sentiment analysis enabled
            segments: Array<{
                text: string;
                start_word: number;
                end_word: number;
                sentiment: 'positive' | 'negative' | 'neutral';
                sentiment_score: number;
            }>;
            average: {
                sentiment: 'positive' | 'negative' | 'neutral';
                sentiment_score: number;
            };
        };
    };
}

export type TranscriptBlock = {
    speaker: number;
    text: string;
    start: number;
};

export const generate_transcript = async (path: string, api_key: string) => {
    const audio_bytes = await catch_error(() => {
        if (path.includes('capture.wav')) {
            return readFile('capture.wav', {baseDir: BaseDirectory.AppData});
        }
        return readFile(path);
    });
    if (audio_bytes instanceof Error) {
        return audio_bytes;
    }
    const params = new URLSearchParams({
        model: 'nova-3',
        smart_format: 'true',
        language: 'multi',
        punctuate: 'true',
        utterances: 'true',
        diarize: 'true',
    });

    const response = await catch_error(() =>
        fetch(`https://api.deepgram.com/v1/listen?${params}`, {
            method: 'POST',
            headers: {
                Authorization: `Token ${api_key}`,
                'Content-Type': 'audio/wav',
            },
            body: audio_bytes.buffer as ArrayBuffer,
        }),
    );
    if (response instanceof Error) {
        return response;
    }
    const data = await catch_error(async () => (await response.json()) as DeepgramListenResponse);
    if (data instanceof Error) {
        return data;
    }
    const channels = data.results.channels;
    const best_channel = channels.reduce((best: any, current: any) => {
        return current.alternatives[0].words.length > best.alternatives[0].words.length
            ? current
            : best;
    });

    const words = best_channel.alternatives[0].words;
    const blocks: TranscriptBlock[] = [];
    for (const word of words) {
        const last = blocks[blocks.length - 1];
        if (last && last.speaker === word.speaker) {
            last.text += ' ' + word.punctuated_word;
        } else {
            blocks.push({
                speaker: word.speaker ?? -1,
                text: word.punctuated_word ?? '',
                start: word.start,
            });
        }
    }
    return blocks;
};
