<script lang="ts">
    import { open } from "@tauri-apps/plugin-dialog"
    import { readFile } from "@tauri-apps/plugin-fs"
    import DownloadIcon from "$lib/icons/DownloadIcon.svelte"
	import { get_upload_context } from "./upload_context.svelte";

    // let file_name = $state<string>()

    // const handleUpload = async () => {
    //     const selected_file_path = await open({
    //         multiple: false,
    //         filters: [{ name: "Audio", extensions: ["mp3"] }]
    //     })
    //     if (!selected_file_path) {
    //         return
    //     }
       
    //     const audio_file_bytes = await readFile(selected_file_path)
    //     file_name = selected_file_path.split('/').pop()
    //     console.log('nom', file_name)
    //     console.log("fichier recu", audio_file_bytes)   
    // }
    type Props = {
        hidden?: boolean
    }
    let { hidden = false, }: Props = $props()
    const upload = get_upload_context()
</script>
{#if !hidden}
    <button class="btn p-8! rounded-full!" onclick={async () => { await upload.upload() }}>
        <DownloadIcon /> {upload.file_name ?? "Upload"}
    </button>
{/if}