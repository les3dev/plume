import { genererResume } from "$lib/openrouter/openrouter";
import { get_settings_context } from '$lib/settings/settings_context.svelte'
import { getContext, setContext } from 'svelte'


const TABS = [
    { title: "Email", prompt: "Rédige un email professionnel au client :", result: "", loading: false },
    { title: "Compte Rendu", prompt: "Rédige un compte rendu clair et structuré :", result: "", loading: false },
    { title: "Résumé", prompt: "Fais un résumé clair et concis du texte suivant :", result: "", loading: false },
]

class GenerateContext {
    tabs = $state(TABS)
    current = $state(0)
    opened_tabs = $state<number[]>([])
    available_tabs = $derived(this.tabs.filter((_, index) => !this.opened_tabs.includes(index)));

    constructor(private settings: ReturnType<typeof get_settings_context>) {}

    open_tab = (index:number, transcript:string) => {
        if(!this.opened_tabs.includes(index)){
            this.opened_tabs = [...this.opened_tabs, index]
        }
        this.current = index
        this.generate(index, transcript)
    }


    generate = async (index: number, transcript: string) => {
        // const settings = get_settings_context(); 
        this.current = index;
        const tab = this.tabs[index];
        if (tab.result || tab.loading) return;
        tab.loading = true;
        tab.result = await genererResume(`${tab.prompt} ${transcript}`, this.settings.openrouter_key);
        tab.loading = false;
    };
}

const key = Symbol()
// export const set_generate_context = () => setContext(key, new GenerateContext());
export const set_generate_context = () => {
    const settings = get_settings_context(); // ici c'est ok, appelé pendant l'init
    return setContext(key, new GenerateContext(settings));
}
export const get_generate_context = () => getContext<GenerateContext>(key)
