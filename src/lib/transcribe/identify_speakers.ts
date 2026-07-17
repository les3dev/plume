import {catch_error} from '$lib/helpers/catch_error';
import {createOpenRouter} from '@openrouter/ai-sdk-provider';
import {generateText, Output} from 'ai';
import {type} from 'arktype';

const speaker_identification_schema = type({
    speakers: type({
        speaker: 'number',
        label: 'string',
    }).array(),
});

export const identify_speakers = async (
    transcript: string,
    api_key: string | undefined,
    model: string,
): Promise<Record<number, string> | Error> => {
    const openrouter = createOpenRouter({apiKey: api_key});
    const prompt = `Voici le transcript diarisé d'une réunion professionnelle. Chaque tour de parole commence par "Speaker N :", un numéro attribué automatiquement par le logiciel de transcription qui ne correspond à aucune identité réelle.

Pour chaque numéro de speaker, essaie de déterminer qui il est à partir du contenu de la conversation :
1. En priorité, si un prénom (ou nom) de cette personne est mentionné dans la conversation (elle se présente, quelqu'un l'interpelle par son prénom, elle signe, etc.), utilise ce prénom tel quel (ex : "Vincent", "Pierre-Marie").
2. Si aucun prénom n'est identifiable avec confiance, déduis plutôt son rôle dans la réunion à partir du contexte (ex : "Client", "Chef de projet client", "Développeur", "Chef de projet Kayro", "Designer"...).
3. Si tu n'as vraiment aucun indice exploitable (ni prénom, ni rôle) pour un speaker donné, ne l'inclus pas dans ta réponse : mieux vaut ne rien dire que d'inventer.

Réponds uniquement avec les speakers pour lesquels tu as une réponse fiable.

TRANSCRIPT:
${transcript}`;

    console.log(`Identifying speakers with model ${model}:`, prompt);
    const result = await catch_error(() =>
        generateText({
            model: openrouter.chat(model),
            output: Output.object({schema: speaker_identification_schema}),
            prompt,
        }),
    );
    if (result instanceof Error) {
        console.error('Speaker identification: AI call failed', result);
        return result;
    }
    console.log('Speaker identification: AI result', result.output, {
        finishReason: result.finishReason,
        usage: result.usage,
    });

    const labels: Record<number, string> = {};
    for (const {speaker, label} of result.output.speakers) {
        // The model echoes back the 1-indexed "Speaker N" it read from the prompt,
        // while the transcript's internal `speaker` field is 0-indexed.
        labels[speaker - 1] = label;
    }
    return labels;
};
