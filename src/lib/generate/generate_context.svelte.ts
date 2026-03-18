// import {browser} from '$app/environment';
// import {StoreContext} from '$lib/helpers/StoreContext';
// import {generate_summary} from '$lib/openrouter/openrouter';
// import {get_settings_context} from '$lib/settings/settings_context.svelte';
// import {getContext, setContext} from 'svelte';

// export interface Prompt {
//     id: string;
//     title: string;
//     prompt: string;
// }

// const store_path = 'prompts.json';

// const default_prompts: Prompt[] = [
//     {id: crypto.randomUUID(), title: 'Email', prompt: 'Rédige un email professionnel au client :'},
//     {
//         id: crypto.randomUUID(),
//         title: 'Compte Rendu',
//         prompt: 'Rédige un compte rendu clair et structuré :',
//     },
//     {
//         id: crypto.randomUUID(),
//         title: 'Résumé',
//         prompt: 'Fais un résumé clair et concis du texte suivant :',
//     },
// ];

// class GenerateContext extends StoreContext {
//     #settings = get_settings_context();

//     prompts = $state<Prompt[]>([]);
//     transcript = $state<string>();
//     current = $state<string>();
//     loading = $state(false);
//     result = $state<Record<string, string>>({});
//     #prompts_key = 'prompts';
//     opened_prompts = $state<string[]>([]);
//     unopened_prompts = $derived(
//         this.prompts.filter((prompt) => !this.opened_prompts.includes(prompt.id)),
//     );

//     constructor() {
//         super(store_path);
//         if (browser) this.load_store();
//     }

//     load_store = async () => {
//         const stored = await this.get_from_store<Prompt[]>(this.#prompts_key);
//         if (!stored) {
//             this.prompts = default_prompts;
//             await this.set_to_store(this.#prompts_key, default_prompts);
//             await this.save_store();
//         } else {
//             this.prompts = stored;
//         }
//     };

//     save_prompts = async () => {
//         await this.set_to_store(this.#prompts_key, this.prompts);
//         await this.save_store();
//     };

//     open_prompt = (id: string) => {
//         if (!this.opened_prompts.includes(id)) {
//             this.opened_prompts = [...this.opened_prompts, id];
//         }
//         this.generate(id);
//     };

//     get_prompt = (id: string) => {
//         return this.prompts.find((prompt) => prompt.id === id);
//     };

//     add_prompt = (prompt: Omit<Prompt, 'id'>) => {
//         this.prompts = [...this.prompts, {id: crypto.randomUUID(), ...prompt}];
//         this.save_prompts();
//     };

//     edit_prompt = (id: string, title: string, prompt: string) => {
//         const select = this.prompts.find((prompt) => prompt.id === id);
//         if (!select) return;
//         select.title = title;
//         select.prompt = prompt;
//         this.save_prompts();
//     };

//     delete_prompt = (id: string) => {
//         this.prompts = this.prompts.filter((prompt) => prompt.id !== id);
//         this.save_prompts();
//     };

//     generate = async (id: string) => {
//         this.current = id;
//         const prompt = this.prompts.find((p) => p.id === id);
//         if (!prompt || this.result[id] || this.loading || !this.transcript) return;
//         this.loading = true;
//         this.result[id] = await generate_summary(
//             `${prompt.prompt} ${this.transcript}`,
//             this.#settings.openrouter_key,
//         );

//         this.loading = false;
//     };
// }

// const key = Symbol();
// export const set_generate_context = () => setContext(key, new GenerateContext());
// export const get_generate_context = () => getContext<GenerateContext>(key);


import {browser} from '$app/environment';
import {StoreContext} from '$lib/helpers/StoreContext';
import {generate_summary} from '$lib/openrouter/openrouter';
import {get_settings_context} from '$lib/settings/settings_context.svelte';
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

class GenerateContext extends StoreContext {
    #settings = get_settings_context();
    #prompts_key = 'prompts';
    prompts = $state<Prompt[]>([]);
    transcript = $state<string>();
    loading = $state(false);
    result = $state<Record<string, string>>({});

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

    generate = async (prompt: Prompt) => {
        if (this.result[prompt.id] || this.loading || !this.transcript) return;
        this.loading = true;
        this.result[prompt.id] = await generate_summary(
            `${prompt.prompt} ${this.transcript}`,
            this.#settings.openrouter_key,
        );
        this.loading = false;
    };

    add_prompt = (prompt: Omit<Prompt, 'id'>) => {
        this.prompts = [...this.prompts, {id: crypto.randomUUID(), ...prompt}];
        this.save_prompts();
    };

    edit_prompt = (id: string, title: string, prompt: string) => {
        const found = this.prompts.find((p) => p.id === id);
        if (!found) return;
        found.title = title;
        found.prompt = prompt;
        this.save_prompts();
    };

    delete_prompt = (id: string) => {
        this.prompts = this.prompts.filter((p) => p.id !== id);
        this.save_prompts();
    };
}

const key = Symbol();
export const set_generate_context = () => setContext(key, new GenerateContext());
export const get_generate_context = () => getContext<GenerateContext>(key);