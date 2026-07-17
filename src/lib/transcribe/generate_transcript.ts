import {catch_error} from '$lib/helpers/catch_error';
import {readFile} from '@tauri-apps/plugin-fs';
import {Duration} from 'luxon';

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
    /** Display name of the speaker, e.g. the default `Speaker 1` or a custom name. */
    speaker: string;
    text: string;
    start: number;
    end?: number;
};

export const format_timestamp = (seconds: number): string => {
    const total_seconds = Math.max(0, Math.round(seconds));
    const duration = Duration.fromMillis(total_seconds * 1000);
    return duration.as('hours') >= 1 ? duration.toFormat('h:mm:ss') : duration.toFormat('mm:ss');
};

/** Default display name for a 0-indexed diarization speaker number. */
export const default_speaker_name = (speaker: number): string => `Speaker ${speaker + 1}`;

const timestamp_prefix_regex = /^(?:(\d+):)?(\d{1,2}):(\d{2})\s+/;

export const generate_transcript = async (path: string, api_key: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    const content_type = ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : null;
    if (!content_type) {
        return new Error('Unsupported audio format');
    }

    const audio_bytes = await catch_error(() => readFile(path));
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
                'Content-Type': content_type,
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
        const speaker = default_speaker_name(word.speaker ?? 0);
        const last = blocks[blocks.length - 1];
        if (last && last.speaker === speaker) {
            last.text += ' ' + word.punctuated_word;
            last.end = word.end;
        } else {
            blocks.push({
                speaker,
                text: word.punctuated_word ?? '',
                start: word.start,
                end: word.end,
            });
        }
    }
    return blocks;
};

/**
 * Serialize transcript blocks to the persisted text format. Each block is one
 * `mm:ss name: message` line (blocks separated by a blank line), where the first
 * `:` belongs to the timestamp and the next `:` starts the message.
 */
export const serialize_transcript = (blocks: TranscriptBlock[]): string =>
    blocks
        .map((block) => `${format_timestamp(block.start)} ${block.speaker}: ${block.text}`)
        .join('\n\n');

/** Parse the persisted text format back into transcript blocks (inverse of {@link serialize_transcript}). */
export const parse_transcript_text = (text: string): TranscriptBlock[] => {
    const blocks: TranscriptBlock[] = [];
    for (const chunk of text.split('\n\n')) {
        if (!chunk.trim()) continue;

        let start = 0;
        let rest = chunk;
        const timestamp_match = chunk.match(timestamp_prefix_regex);
        if (timestamp_match) {
            const hours = timestamp_match[1] ? parseInt(timestamp_match[1]) : 0;
            const minutes = parseInt(timestamp_match[2]);
            const seconds = parseInt(timestamp_match[3]);
            start = hours * 3600 + minutes * 60 + seconds;
            rest = chunk.slice(timestamp_match[0].length);
        }

        // The name ends at the first `:` after the timestamp; the message is the rest
        // (which may itself contain colons).
        const colon_index = rest.indexOf(':');
        if (colon_index === -1) continue;
        blocks.push({
            speaker: rest.slice(0, colon_index).trim(),
            text: rest.slice(colon_index + 1).trim(),
            start,
        });
    }
    return blocks;
};
