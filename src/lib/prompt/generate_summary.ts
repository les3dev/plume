import {createOpenRouter} from '@openrouter/ai-sdk-provider';
import {generateText} from 'ai';

export const generate_summary = async (
    prompt: string,
    transcript: string,
    apiKey: string | undefined,
    model: string,
) => {
    const openrouter = createOpenRouter({apiKey});
    console.log(`Generating with model ${model}`);
    const {text} = await generateText({
        model: openrouter.chat(model),
        prompt: `Génère un résumé à partir d'instructions et d'un transcript.
INSTRUCTIONS:
${prompt}
TRANSCRIPT:
${transcript}`,
    });

    return text;
};
