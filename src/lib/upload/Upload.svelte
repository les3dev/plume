<script lang="ts">
    import DownloadIcon from "$lib/icons/DownloadIcon.svelte"
	import { get_transcribe_context } from "../transcribe/transcribe_context.svelte";
    import { open as open_file } from "@tauri-apps/plugin-dialog";

    type Props = { onFinish?: (path: string) => void }
    let { onFinish }: Props = $props();

    const transcribe = get_transcribe_context();

    const upload = async () => {
        const path = await open_file({
            multiple: false,
            filters: [{ name: 'Audio', extensions: ['mp3', 'wav'] }],
        });
        if (path) onFinish?.(path);
    };
</script>
<button class="btn p-6! rounded-full!" onclick={upload}>
    <DownloadIcon /> {transcribe.file_name ?? "Ajouter un fichier audio"}
</button>
