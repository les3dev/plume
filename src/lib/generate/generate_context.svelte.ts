import { genererResume } from "$lib/openrouter/openrouter";
import { get_settings_context } from '$lib/settings/settings_context.svelte'
import { getContext, setContext } from 'svelte'


type GenerateType = 'resume' | 'mail' | 'compte-rendu';

const prompts: Record<GenerateType, string> = {
    resume: 'Fais un résumé concis de cette transcription :',
    mail: 'Rédige un email de suivi professionnel au client :',
    'compte-rendu': 'Rédige un compte rendu structuré de cette réunion :',
};

class GenerateContext {
    results = $state<Record<GenerateType,string>>({
        'resume' : '',
        'mail' :"",
        "compte-rendu" : "",

    })
    loading = $state(false)

    constructor(private settings: ReturnType<typeof get_settings_context>) {}

    generate = async ( type : GenerateType, transcript:string)=>{
        this.loading = true
        this.results[type] = await genererResume(
            `${prompts[type]}, ${transcript}}`,
            this.settings.openrouter_key

        )
        this.loading = false
    }
}

const key = Symbol()
export const get_generate_context = () => getContext<GenerateContext>(key)
export const set_generate_context = () => {
    const settings = get_settings_context()
    return setContext(key, new GenerateContext(settings))
}