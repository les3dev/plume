<script lang="ts">
    import {goto} from '$app/navigation';
    import {ai_models} from '$lib/ai_models';
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';
    import InfoIcon from '$lib/icons/InfoIcon.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import type {MailClient} from '$lib/settings/settings_context.svelte';
    import {open as open_dialog} from '@tauri-apps/plugin-dialog';
    import {appDataDir, homeDir} from '@tauri-apps/api/path';
    import {get_i18n_context} from '$lib/i18n/context.svelte';

    const i18n = get_i18n_context();
    const settings = get_settings_context();
    let openrouter_key = $state('');
    let deepgram_key = $state('');
    let model = $state(settings.model);
    let save_path = $state('');
    let default_save_path = $state('');

    $effect(() => {
        openrouter_key = settings.openrouter_key ?? '';
        deepgram_key = settings.deepgram_key ?? '';
        model = settings.model;
    });

    $effect(() => {
        save_path = settings.save_path ?? '';
    });

    $effect(() => {
        (async () => {
            if (!settings.save_path) {
                default_save_path = await appDataDir();
            }
        })();
    });

    const is_path_valid = async (path: string): Promise<boolean> => {
        const home = await homeDir();
        return path.startsWith(home);
    };

    const browse_save_path = async () => {
        error_message = '';
        const selected = await open_dialog({
            directory: true,
            multiple: false,
            defaultPath: default_save_path || undefined,
        });
        if (selected && typeof selected === 'string') {
            if (!(await is_path_valid(selected))) {
                error_message = 'Le dossier doit être dans votre dossier personnel ($HOME)';
                return;
            }
            save_path = selected;
            await settings.save_save_path(selected);
        }
    };

    let error_message = $state('');
</script>

<div class="flex h-screen flex-col">
    <div class="flex items-center p-4">
        <button class="btn ghost icon" onclick={() => goto('/')}>
            <ChevronIcon --size="1.2rem" />
        </button>
        <h1 class="flex-1 text-center text-xl">{i18n.t('Paramètres')}</h1>
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
                <select id="model" class="cursor-pointer" bind:value={model}>
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

                <div class="flex flex-col gap-3 border-b border-bg-2 pb-6">
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
                <div class="flex flex-col gap-3 border-b border-bg-2 pb-6">
                    <label class="text-sm font-medium" for="save_path">Dossier sauvegarde</label>
                    <input
                        id="save_path"
                        type="text"
                        placeholder={settings.save_path || default_save_path}
                        bind:value={save_path}
                    />
                    <div class="flex gap-2">
                        <button class="btn" onclick={browse_save_path}>Parcourir</button>
                        <button
                            class="btn secondary"
                            onclick={() => {
                                save_path = '';
                                settings.save_save_path(undefined);
                            }}>Réinitialiser</button
                        >
                    </div>
                    {#if error_message}
                        <p class="text-xs text-error">{error_message}</p>
                    {/if}
                </div>
                <div class="flex items-center justify-between gap-3">
                    <span class="text-sm font-medium">Apparence</span>
                    <div class="flex gap-2">
                        <button
                            class="btn {settings.color_scheme === 'light' ? 'secondary' : 'ghost'}"
                            onclick={() => (settings.color_scheme = 'light')}
                        >
                            Clair
                        </button>
                        <button
                            class="btn {settings.color_scheme === 'dark' ? 'secondary' : 'ghost'}"
                            onclick={() => (settings.color_scheme = 'dark')}
                        >
                            Sombre
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
