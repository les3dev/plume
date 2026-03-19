<script lang="ts">
    import {catch_error} from '$lib/helpers/catch_error';
    import UploadIcon from '$lib/icons/UploadIcon.svelte';
    import {convertFileSrc} from '@tauri-apps/api/core';
    import {open as open_file} from '@tauri-apps/plugin-dialog';
    import {Duration} from 'luxon';

    type Props = {
        onfile?: (path: string, start_time: Date, duration: string) => void;
    };
    let {onfile}: Props = $props();

    let path = $state<string | null>(null);
    let error_message = $state<string>();

    const get_audio_meta = (src: string): Promise<{start_time: Date; duration: string}> =>
        new Promise((resolve, reject) => {
            const audio = new Audio(src);
            audio.addEventListener('loadedmetadata', () => {
                resolve({
                    start_time: new Date(),
                    duration: Duration.fromMillis(Math.round(audio.duration * 1000))
                        .shiftTo('hours', 'minutes', 'seconds')
                        .toFormat('hh:mm:ss'),
                });
            });
            audio.addEventListener('error', () =>
                reject(new Error('Failed to load audio metadata')),
            );
        });

    const upload = async () => {
        const current_path = await catch_error(() =>
            open_file({
                multiple: false,
                filters: [{name: 'Audio', extensions: ['mp3', 'wav', 'ogg']}],
            }),
        );
        if (current_path === null) return;
        if (current_path instanceof Error) {
            error_message = current_path.message;
            return;
        }

        const asset_path = catch_error(() => convertFileSrc(current_path));
        if (asset_path instanceof Error) {
            error_message = asset_path.message;
            return;
        }

        const meta = await catch_error(() => get_audio_meta(asset_path));
        if (meta instanceof Error) {
            error_message = meta.message;
            return;
        }

        path = asset_path;
        if (path) onfile?.(path, meta.start_time, meta.duration);
    };
</script>

{#if error_message !== undefined}
    <div class="text-error">{error_message}</div>
{:else}
    <div class="flex flex-col items-center gap-4">
        <button class="btn rounded-full! p-6!" onclick={upload}>
            <UploadIcon />
            {path ?? 'Ajouter un fichier audio'}
        </button>
        <p class="text-sm text-fg-2">Formats acceptés : .mp3, .wav</p>
    </div>
{/if}
