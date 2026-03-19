<script lang="ts">
    import {catch_error} from '$lib/helpers/catch_error';
    import UploadIcon from '$lib/icons/UploadIcon.svelte';
    import {convertFileSrc} from '@tauri-apps/api/core';
    import {open as open_file} from '@tauri-apps/plugin-dialog';

    type Props = {onfinish?: (path: string) => void};
    let {onfinish}: Props = $props();

    let path = $state<string | null>(null);
    let error_message = $state<string>();

    const upload = async () => {
        const current_path = await catch_error(() =>
            open_file({
                multiple: false,
                filters: [{name: 'Audio', extensions: ['mp3', 'wav', 'ogg']}],
            }),
        );
        if (current_path === null) {
            return;
        }
        if (current_path instanceof Error) {
            error_message = current_path.message;
            return;
        }
        const asset_path = catch_error(() => convertFileSrc(current_path));
        if (asset_path instanceof Error) {
            error_message = asset_path.message;
            return;
        }
        path = asset_path;
        if (path) onfinish?.(path);
    };
</script>

<button class="btn rounded-full! p-6!" onclick={upload}>
    <UploadIcon />
    {path ?? 'Ajouter un fichier audio'}
</button>

{#if error_message !== undefined}
    <div class="text-error">{error_message}</div>
{/if}
