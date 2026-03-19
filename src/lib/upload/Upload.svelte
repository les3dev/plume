<script lang="ts">
    import UploadIcon from '$lib/icons/UploadIcon.svelte';
    import {open as open_file} from '@tauri-apps/plugin-dialog';

    type Props = {onfinish?: (path: string) => void};
    let {onfinish}: Props = $props();

    let path = $state<string | null>(null);

    const upload = async () => {
        path = await open_file({
            multiple: false,
            filters: [{name: 'Audio', extensions: ['mp3', 'wav', 'ogg']}],
        });
        if (path) onfinish?.(path);
    };
</script>

<button class="btn rounded-full! p-6!" onclick={upload}>
    <UploadIcon />
    {path ?? 'Ajouter un fichier audio'}
</button>
