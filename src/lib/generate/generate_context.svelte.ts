import {genererResume} from '$lib/openrouter/openrouter';
import {get_settings_context} from '$lib/settings/settings_context.svelte';
import {getContext, setContext} from 'svelte';

const TABS = [
    {title: 'Email', prompt: 'Rédige un email professionnel au client :'},
    {title: 'Compte Rendu', prompt: 'Rédige un compte rendu clair et structuré :'},
    {title: 'Résumé', prompt: 'Fais un résumé clair et concis du texte suivant :'},
];

class GenerateContext {
    #settings = get_settings_context();
    tabs = TABS;
    current = $state(0);
    loading = $state(false);
    result = $state<Record<number, string>>({});
    opened_tabs = $state<number[]>([]);
    available_tabs = $derived(this.tabs.filter((_, index) => !this.opened_tabs.includes(index)));

    open_tab = (index: number, transcript: string) => {
        if (!this.opened_tabs.includes(index)) {
            this.opened_tabs = [...this.opened_tabs, index];
        }
        this.current = index;
        this.generate(index, transcript);
    };

    generate = async (index: number, transcript: string) => {
        this.current = index;
        const tab = this.tabs[index];
        if (this.result[index] || this.loading) return;
        this.loading = true;
        this.result[index] = await genererResume(
            `${tab.prompt} ${transcript}`,
            this.#settings.openrouter_key,
        );
        this.loading = false;
    };
}

const key = Symbol();
export const set_generate_context = () => setContext(key, new GenerateContext());
export const get_generate_context = () => getContext<GenerateContext>(key);
