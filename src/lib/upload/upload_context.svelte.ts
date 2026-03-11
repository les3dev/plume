import { getContext, setContext } from "svelte"
import { open } from "@tauri-apps/plugin-dialog"
import { readFile } from "@tauri-apps/plugin-fs"
import { get_settings_context } from "$lib/settings/settings_context.svelte"
import { fetch } from "@tauri-apps/plugin-http"

class UploadContext {
    file_name = $state<string>()
    audio_bytes = $state<Uint8Array>()
    transcript = $state<string>()

    constructor(private settings: ReturnType<typeof get_settings_context>) {}

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
        await this.transcribe()
    }

    transcribe = async () => {
        if (!this.audio_bytes){
        return
        }
        console.log("transcription lancé")
    
        try {
            const response = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&detect_language=true", {
                method: "POST",
                headers: {
                    "Authorization": `Token ${this.settings.deepgram_key}`,
                },
                body: new Blob([this.audio_bytes])
            })
            console.log("status", response.status)
            const data = await response.json()
            console.log(JSON.stringify(data))
            this.transcript = data.results.channels[0].alternatives[0].transcript
        } catch (error) {
            console.error("erreur transcriptio", error)
        }
    }

    transcribe_from_path = async (path: string) => {
        this.audio_bytes = await readFile(path)
        await this.transcribe()
    }
}

const key = Symbol()
export const get_upload_context = () => getContext<UploadContext>(key)
export const set_upload_context = () => {
    const settings = get_settings_context()
    return setContext(key, new UploadContext(settings))
}