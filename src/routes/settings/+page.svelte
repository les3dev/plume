<script lang="ts">
    import {goto} from '$app/navigation';
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';
    import InfoIcon from '$lib/icons/InfoIcon.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import type {MailClient} from '$lib/settings/settings_context.svelte';

    const settings = get_settings_context();
    let openrouter_key = $state('');
    let deepgram_key = $state('');
    let model = $state(settings.model);

    
    export const ai_models = [
        {
            title: 'GPT-5 mini',
            url: 'openai/gpt-5-mini',
        },
        {
            title: 'Gemini 2.0 Flash',
            url: 'google/gemini-2.0-flash-001',
        },
        {
            title: 'Claude Haiku 3.5',
            url: 'anthropic/claude-haiku-3-5',
        },
        {
            title: 'Nemotron 3 Super 120B (nvidia)',
            url: 'nvidia/nemotron-3-super-120b-a12b:free',
        },
        {
            title: 'DeepSeek R1',
            url: 'deepseek/deepseek-r1:free',
        },
    ] as const;

    $effect(() => {
        openrouter_key = settings.openrouter_key ?? '';
        deepgram_key = settings.deepgram_key ?? '';
        model = settings.model;
    });
</script>

<div class="flex h-screen flex-col">
    <div class="flex items-center p-4">
        <button class="btn ghost icon" onclick={() => goto('/')}>
            <ChevronIcon --size="1.2rem" />
        </button>
        <h1 class="flex-1 text-center text-xl">Paramètres</h1>
        <button class="btn ghost icon">
            <InfoIcon --size="1.2rem" />
        </button>
    </div>
    <div class="flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-4">
        <div class="m-auto flex w-full max-w-lg flex-col gap-8">
            <div class="flex flex-col gap-3">
                <label class="text-sm font-medium" for="openai-input">Clé OpenRouter</label>
                <input
                    id="openai-input"
                    type="text"
                    placeholder="openaikey.."
                    bind:value={openrouter_key}
                />
                <div class="flex gap-3">
                    <button class="btn" onclick={() => settings.save_openrouter_key(openrouter_key)}
                        >Sauvegarder</button
                    >
                    {#if settings.openrouter_key}
                        <button
                            class="btn error"
                            onclick={() => settings.save_openrouter_key(undefined)}>Effacer</button
                        >
                    {/if}
                </div>
            </div>
            <div class="flex flex-col gap-3">
                <label for="model" class="cursor-pointer text-sm font-medium">Modèle</label>
                <select
                    id="model"
                    class="cursor-pointer"
                    // value={settings.model}
                    // onchange={(e) => settings.save_model(e.currentTarget.value)}
                    bind:value={model}
                >
                    {#each ai_models as model}
                        <option value={model.url}>{model.title}</option>
                    {/each}
                </select>
                <div class="flex gap-3">
                    <button class="btn" onclick={() => settings.save_model(model)}
                        >Sauvegarder
                    </button>
                </div>

                <div class="flex flex-col gap-3">
                    <label class="text-sm font-medium" for="deepgram-input">Clé API Deepgram</label>
                    <input
                        id="deepgram-input"
                        type="text"
                        placeholder="deepgramkey.."
                        bind:value={deepgram_key}
                    />
                    <div class="flex gap-3">
                        <button class="btn" onclick={() => settings.save_deepgram_key(deepgram_key)}
                            >Sauvegarder</button
                        >
                        {#if settings.deepgram_key}
                            <button
                                class="btn error"
                                onclick={() => settings.save_deepgram_key(undefined)}
                                >Effacer</button
                            >
                        {/if}
                    </div>
                    <p class="text-xs text-fg-1">
                        Vos clés sont enregistrées localement sur votre ordinateur et ne sont jamais
                        partagées avec qui que ce soit.
                    </p>
                </div>

                <div class="flex flex-col gap-3">
                    <label class="text-sm font-medium" for="mail">Mail par défaut</label>
                    <select
                        id="mail"
                        class="cursor-pointer"
                        value={settings.mail_client}
                        onchange={(e) =>
                            settings.save_mail_client(e.currentTarget.value as MailClient)}
                    >
                        <option value="mailto">Choisir</option>
                        <option value="gmail">Gmail</option>
                        <option value="outlook">Outlook</option>
                    </select>
                </div>
            </div>
        </div>
    </div>
</div>
