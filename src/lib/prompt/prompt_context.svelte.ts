import {browser} from '$app/environment';
import {StoreContext} from '$lib/helpers/StoreContext';
import {getContext, setContext} from 'svelte';

export interface Prompt {
    id: string;
    title: string;
    prompt: string;
}

const store_path = 'prompts.json';

const default_prompts: Prompt[] = [
    {id: crypto.randomUUID(), title: 'Email', prompt: 'Rédige un email professionnel au client :'},
    {id: crypto.randomUUID(), title: 'Compte Rendu', prompt: 'Rédige un compte rendu clair et structuré :'},
    {id: crypto.randomUUID(), title: 'Résumé', prompt: 'Fais un résumé clair et concis du texte suivant :'},
];

class PromptContext extends StoreContext {
    #prompts_key = 'prompts';
    prompts = $state<Prompt[]>([]);

    constructor() {
        super(store_path);
        if (browser) this.load_store();
    }

    load_store = async () => {
        const stored = await this.get_from_store<Prompt[]>(this.#prompts_key);
        if (!stored) {
            this.prompts = default_prompts;
            await this.set_to_store(this.#prompts_key, default_prompts);
            await this.save_store();
        } else {
            this.prompts = stored;
        }
    };

    save_prompts = async () => {
        await this.set_to_store(this.#prompts_key, this.prompts);
        await this.save_store();
    };

    add_prompt = (prompt: Omit<Prompt, 'id'>) => {
        this.prompts = [...this.prompts, {id: crypto.randomUUID(), ...prompt}];
        this.save_prompts();
    };

    edit_prompt = (id: string, title: string, prompt: string) => {
        const found = this.prompts.find((prompt) => prompt.id === id);
        if (!found) return;
        found.title = title;
        found.prompt = prompt;
        this.save_prompts();
    };

    delete_prompt = (id: string) => {
        this.prompts = this.prompts.filter((prompt) => prompt.id !== id);
        this.save_prompts();
    };
}

const key = Symbol();
export const set_prompt_context = () => setContext(key, new PromptContext());
export const get_prompt_context = () => getContext<PromptContext>(key);