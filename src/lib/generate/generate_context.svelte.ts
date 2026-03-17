import {generate_summary} from '$lib/openrouter/openrouter';
import {get_settings_context} from '$lib/settings/settings_context.svelte';
import {getContext, setContext} from 'svelte';

const tabs = [
    {title: 'Email', prompt: 'Rédige un email professionnel au client :'},
    {title: 'Compte Rendu', prompt: 'Rédige un compte rendu clair et structuré :'},
    {title: 'Résumé', prompt: 'Fais un résumé clair et concis du texte suivant :'},
];

class GenerateContext {
    #settings = get_settings_context();
    tabs = $state(tabs);
    transcript = $state<string>();
    current = $state(0);
    loading = $state(false);
    result = $state<Record<number, string>>({});

    generate = async (index: number) => {
        this.current = index;
        const tab = this.tabs[index];
        if (this.result[index] || this.loading || !this.transcript) return;
        this.loading = true;
        this.result[index] = await generate_summary(
            `${tab.prompt} ${this.transcript}`,
            this.#settings.openrouter_key,
        );
        this.loading = false;
    };
}

const key = Symbol();
export const set_generate_context = () => setContext(key, new GenerateContext());
export const get_generate_context = () => getContext<GenerateContext>(key);
