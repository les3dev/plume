import { browser } from "$app/environment";
import { StoreContext } from "$lib/helpers/StoreContext";
import type { SpeechBlock } from "$lib/transcribe/Transcribe.svelte";

const store_path = "sessions.json"

type Session = {
    id: string,
    name: string,
    date:string,
    audio_path : string,
    transcript : any,
    speech_blocks : SpeechBlock[],
}

class SessionsContext extends StoreContext {
    sessions = $state<Session[]>()

    constructor (store_path : string){
        super(store_path)
        if(browser){
            this.load_store()
        }
        
    }

    load_store = async () => {
        this.sessions = (await this.get_from_store<Session[]>('sessions')) ?? []
    }
}   