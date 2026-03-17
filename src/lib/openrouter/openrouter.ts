// src/lib/openrouter.ts  ← fichier final propre
import {createOpenRouter} from '@openrouter/ai-sdk-provider';
import {generateText} from 'ai';

export const genererResume = async (texte: string, apiKey: string | undefined) => {
    const openrouter = createOpenRouter({apiKey});
    const {text} = await generateText({
        model: openrouter.chat('nvidia/nemotron-3-super-120b-a12b:free'),
        prompt: `Fais un résumé court :${texte}`,
    });

    return text;
};
