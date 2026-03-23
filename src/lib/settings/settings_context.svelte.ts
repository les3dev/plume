import {browser} from '$app/environment';
import {StoreContext} from '$lib/helpers/StoreContext';
import {getContext, setContext} from 'svelte';

const store_path = 'settings.json';
export type MailClient = 'mailto' | 'gmail' | 'outlook';
const default_model = 'nvidia/nemotron-3-super-120b-a12b:free';
class SettingsContext extends StoreContext {
    openrouter_key = $state<string>();
    deepgram_key = $state<string>();
    model = $state<string>(default_model);
    mail_client = $state<MailClient | undefined>(undefined);

    #color_scheme = $state<'light' | 'dark'>('dark');
    #match_light = matchMedia('(prefers-colors-scheme: light)');

    constructor(store_path: string) {
        super(store_path);
        if (browser) {
            this.load_store();
            (async () => {
                const system = this.#match_light ? 'light' : 'dark';
                this.#color_scheme =
                    (await this.get_from_store<'light' | 'dark'>('color_scheme')) ?? system;
                document.documentElement.setAttribute('color-scheme', this.#color_scheme);
            })();
            this.#match_light.addEventListener('change', ({matches}) => {
                this.#color_scheme = matches ? 'light' : 'dark';
            });
        }
    }

    get color_scheme() {
        return this.#color_scheme;
    }

    set color_scheme(value: 'light' | 'dark') {
        this.#color_scheme = value;
        document.documentElement.setAttribute('color-scheme', value);
        (async () => {
            await this.set_to_store('color_scheme', value);
            await this.save_store();
        })();
    }

    toggle_color_scheme = () => {
        this.color_scheme = this.color_scheme === 'light' ? 'dark' : 'light';
    };

    save_mail_client = async (client: MailClient) => {
        this.mail_client = client;
        await this.set_to_store('mail_client', client);
        await this.save_store();
    };

    load_store = async () => {
        this.openrouter_key = (await this.get_from_store<string>('openai_key')) ?? undefined;
        this.deepgram_key = (await this.get_from_store<string>('deepgram_key')) ?? undefined;
        this.mail_client = await this.get_from_store<MailClient>('mail_client');
        this.model = (await this.get_from_store<string>('model')) ?? default_model;
    };

    save_openrouter_key = async (key: string | undefined) => {
        if (!browser) return;
        this.openrouter_key = key;
        await this.set_to_store('openai_key', key);
        await this.save_store();
    };

    save_deepgram_key = async (key: string | undefined) => {
        if (!browser) return;
        this.deepgram_key = key;
        await this.set_to_store('deepgram_key', key);
        await this.save_store();
    };

    save_model = async (model: string) => {
        if (!browser) return;
        this.model = model;
        await this.set_to_store('model', model);
        await this.save_store();
    };
}

const key = Symbol();
export const get_settings_context = () => getContext<SettingsContext>(key);
export const set_settings_context = () => setContext(key, new SettingsContext(store_path));
