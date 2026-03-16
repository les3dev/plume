import { browser } from "$app/environment";
import { StoreContext } from "$lib/helpers/StoreContext";
import { getContext, setContext } from "svelte";

const store_path = "settings.json"
export type MailClient = 'mailto' | 'gmail' | 'outlook'


class SettingsContext extends StoreContext {
    openrouter_key = $state<string>()
    deepgram_key = $state<string>()
    mail_client = $state<MailClient | undefined>(undefined)

    save_mail_client = async (client:MailClient) => {
        this.mail_client = client
        await this.set_to_store('mail_client', client)
        await this.save_store()
    }

    constructor(store_path: string) {
        super(store_path);
        if (browser) this.load_store()
    }

    load_store = async () => {
        this.openrouter_key = (await this.get_from_store<string>('openai_key')) ?? undefined
        this.deepgram_key = (await this.get_from_store<string>('deepgram_key')) ?? undefined
        this.mail_client = await this.get_from_store<MailClient>('mail_client')
    }

    save_openrouter_key = async (key: string | undefined) => {
        if (!browser) return
        this.openrouter_key = key
        await this.set_to_store('openai_key', key)
        await this.save_store()
    }
    
    save_deepgram_key = async (key: string | undefined) => {
        if (!browser) return
        this.deepgram_key = key
        await this.set_to_store('deepgram_key', key)
        await this.save_store()
    }
}

const key = Symbol()
export const get_settings_context = () => getContext<SettingsContext>(key)
export const set_settings_context = () => setContext(key , new SettingsContext(store_path))


