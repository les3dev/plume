// src/lib/openrouter.ts  ← fichier final propre
import {createOpenRouter} from '@openrouter/ai-sdk-provider';
import {generateText} from 'ai';

export const generate_summary = async (
    transcript: string,
    apiKey: string | undefined,
    model: string,
) => {
    const openrouter = createOpenRouter({apiKey});
    const {text} = await generateText({
        model: openrouter.chat(model),
        prompt: `Fais un résumé court :${transcript}`,
    });

    return text;
};
