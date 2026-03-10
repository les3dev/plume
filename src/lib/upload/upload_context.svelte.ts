import { getContext, setContext } from "svelte"
import { open } from "@tauri-apps/plugin-dialog"
import { readFile } from "@tauri-apps/plugin-fs"
import { DeepgramClient } from "@deepgram/sdk"
import { get_settings_context } from "$lib/settings/settings_context.svelte"

class UploadContext {
    file_name = $state<string>()
    audio_bytes = $state<Uint8Array>()
    transcript = $state<string>()

    upload = async () => {
        const selected_file_path = await open({
            multiple: false,
            filters: [{ name: "Audio", extensions: ["mp3"] }]
        })
        if (!selected_file_path){
            return
        }
        this.file_name = selected_file_path.split("/").pop()
        this.audio_bytes = await readFile(selected_file_path)
    }

    transcribe = async () => {
        if (!this.audio_bytes){
            return
        }
        const settings = get_settings_context()

        const client = new DeepgramClient({ apiKey: settings.deepgram_key ?? "" })
        const response = await client.listen.v1.media.transcribeFile(
            this.audio_bytes,
            { model: "nova-3", language: "fr" }
        )
        console.log(JSON.stringify(response))
    }
}

const key = Symbol()
export const get_upload_context = () => getContext<UploadContext>(key)
export const set_upload_context = () => setContext(key, new UploadContext())