import { StoreContext } from "$lib/helpers/StoreContext";
import { getContext, setContext } from "svelte";

const store_path = "settings.json"

class SettingsContext extends StoreContext {
    openai_key = $state<string>()
    deepgram_key = $state<string>()

    load_store = async () => {
        this.openai_key = await this.get_from_store<string>('openai_key')
        this.deepgram_key = await this.get_from_store<string>('deepgram_key')
    }

    save_openai_key = async (key : string | undefined) => {
        this.openai_key = key
        await this.set_to_store('openai_key', this.openai_key)
        await this.save_store()
    }

    save_deepgram_key = async (key : string | undefined) => {
        this.deepgram_key = key
        await this.set_to_store('deepgram_key', this.deepgram_key)
        await this.save_store()
    }
}


const key = Symbol()
export const get_settings_context = () => getContext<SettingsContext>(key)
export const set_settings_context = () => setContext(key , new SettingsContext(store_path))

