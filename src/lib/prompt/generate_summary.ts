import {createOpenRouter} from '@openrouter/ai-sdk-provider';
import {streamText} from 'ai';

export const generate_summary = async (
    instructions: string,
    transcript: string,
    apiKey: string | undefined,
    model: string,
    start_time: Date | undefined,
    duration: string | undefined,
    ondelta: (delta: string) => void, 
) => {
    const openrouter = createOpenRouter({apiKey});
    const prompt = `Génère un résumé à partir d'instructions et d'un transcript.
${start_time ? `Début de l'enregistrement : ${start_time.toISOString()}` : ''}
${duration ? `Durée de l'enregistrement : ${duration} (hh:mm:ss)` : ''}
INSTRUCTIONS:
${instructions}
TRANSCRIPT:
${transcript}`;
    console.log(`Generating with model ${model}:`, prompt);
    const result = streamText({
        model: openrouter.chat(model),
        prompt,
        onChunk: ({chunk}) => {
            console.log('chunk ', chunk);
            // callback ai appeler à chaque morceau généré
            if (chunk.type === 'text-delta') {
                //  filtre  le text
                ondelta(chunk.text);
            }
        },
    });

    return await result.text;
};