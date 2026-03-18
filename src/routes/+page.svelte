<script lang="ts">
    import Dialog from '$lib/widgets/Dialog.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import SettingsIcon from '$lib/icons/SettingsIcon.svelte';
    import Upload from '$lib/upload/Upload.svelte';
    import CopyIcon from '$lib/icons/CopyIcon.svelte';
    import DownloadIcon from '$lib/icons/DownloadIcon.svelte';
    import Transcript from '$lib/transcribe/Transcribe.svelte';
    import SuperRecorder from '$lib/recorder/SuperRecorder.svelte';
    import {writeFile} from '@tauri-apps/plugin-fs';
    import {save} from '@tauri-apps/plugin-dialog';
    import {convertFileSrc} from '@tauri-apps/api/core';
    import {get_transcribe_context} from '$lib/transcribe/transcribe_context.svelte';
    import {generate_summary} from '$lib/openrouter/openrouter';
    import type {SpeechBlock} from '$lib/transcribe/Transcribe.svelte';
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import {open} from '@tauri-apps/plugin-shell';
    import PaperPlaneIcon from '$lib/icons/PaperPlaneIcon.svelte';
    import Settings from '$lib/settings/Settings.svelte';
    import PromptDialog from '$lib/prompt/PromptDialog.svelte';
    import {get_prompt_context, type Prompt} from '$lib/prompt/prompt_context.svelte';

    const settings = get_settings_context();
    const prompts_ctx = get_prompt_context();
    const transcribe = get_transcribe_context();

    let speech_block = $state<SpeechBlock[]>([]);
    let meeting_state = $state<'record' | 'transcript' | 'ai_result'>();
    let audio_path = $state<string>();
    let is_settings_open = $state(false);
    let is_prompts_open = $state(false);
    let mail_error = $state<string>();
    let tabs = $state<{id: string; result: string}[]>([]);
    let current_tab = $state(0);
    let loading = $state(false);
    let transcript = $derived(
        speech_block.map((speach) => `Speaker ${speach.speaker + 1}: ${speach.text}`).join('\n\n'),
    );

    $inspect(tabs, settings.mail_client);

    const generate = async (prompt: Prompt) => {
        if (tabs.some((tab) => tab.id === prompt.id) || loading || !transcript) return;
        loading = true;
        meeting_state = 'ai_result';
        tabs.push({id: prompt.id, result: ''});
        current_tab = tabs.length - 1;
        const result = await generate_summary(
            `${prompt.prompt} ${transcript}`,
            settings.openrouter_key,
        );
        tabs[current_tab].result = result;
        loading = false;
    };
    const on_audio_ready = async (path: string) => {
        if (path.startsWith('asset://')) {
            audio_path = decodeURIComponent(path);
            const system_path = decodeURIComponent(new URL(path).pathname);
            meeting_state = 'record';
            await transcribe.transcribe_from_path(system_path);
        } else {
            audio_path = convertFileSrc(path);
            meeting_state = 'record';
            await transcribe.transcribe_from_path(path);
        }
        meeting_state = 'transcript';
    };

    const copy = async () => {
        await navigator.clipboard.writeText(transcript);
    };

    const download = async () => {
        const path = await save({
            filters: [{name: 'Text', extensions: ['txt']}],
            defaultPath: 'transcript.txt',
        });
        if (!path) return;
        const encoder = new TextEncoder();
        await writeFile(path, encoder.encode(transcript));
    };

    const open_mail = (body: string) => {
        if (!settings.mail_client) {
            mail_error = "Vous n'avez pas choisis de mail par défaut";
            return;
        }
        const urls = {
            mailto: `mailto:?subject=Compte rendu&body=${encodeURIComponent(body)}`,
            gmail: `https://mail.google.com/mail/?view=cm&body=${encodeURIComponent(body)}`,
            outlook: `https://outlook.office.com/mail/deeplink/compose?body=${encodeURIComponent(body)}`,
        };
        open(urls[settings.mail_client]);
    };
</script>

<div class="flex h-screen flex-col">
    <div class="flex shrink-0 items-center justify-between p-4">
        {#if meeting_state}
            <div class="flex items-center gap-3">
                <audio controls src={audio_path} class="h-10"></audio>
            </div>
            <div class="flex items-center gap-4">
                <button class="btn ghost" onclick={copy}><CopyIcon --size="1.2rem" />Copier</button>
                <button class="btn ghost" onclick={download}
                    ><DownloadIcon --size="1.2rem" />Télécharger</button
                >
                {#if tabs.length > 0}
                    {@const current = tabs[current_tab]}
                    {@const prompt = prompts_ctx.prompts.find((prompt) => prompt.id === current.id)}
                    {#if prompt?.title === 'Email' && settings.mail_client && current.result}
                        <button class="btn ghost" onclick={() => open_mail(current.result)}>
                            <PaperPlaneIcon --size="1.2rem" />Envoyer
                        </button>
                        {#if mail_error}
                            <p class="text-red-400 text-sm">{mail_error}</p>
                        {/if}
                    {/if}
                {/if}
            </div>
        {/if}
        <button class="btn ghost icon ms-auto" onclick={() => (is_settings_open = true)}>
            <SettingsIcon --size="1.2rem" />
        </button>
    </div>

    <div class="min-h-0 flex-1 px-6 pb-4">
        {#if !settings.deepgram_key || !settings.openrouter_key}
            <div class="flex h-full items-center justify-center">
                <div class="max-w-150 rounded-xl border border-dotted p-4 text-center">
                    Vos clés API OpenRouter et Deepgram ne sont pas encore configurées. Utilisez le <span
                        class="text-primary">bouton Paramètres</span
                    > pour enregistrer vos clés API localement.
                </div>
            </div>
        {:else if !meeting_state}
            <div class="flex h-full flex-col items-center justify-center gap-6">
                <SuperRecorder onfinish={on_audio_ready} />
                <Upload onFinish={on_audio_ready} />
            </div>
        {:else if meeting_state === 'record'}
            <div class="flex h-full items-center justify-center">
                <div class="rounded-xl border border-dashed border-bg-2 p-6 text-fg-2">
                    Transcription en cours...
                </div>
            </div>
        {:else if meeting_state === 'transcript'}
            <div class="flex h-full justify-center">
                <div
                    class="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-bg-2"
                >
                    <div class="min-h-0 flex-1 overflow-y-auto p-6">
                        <Transcript speech_block_ready={(received) => (speech_block = received)} />
                    </div>
                </div>
            </div>
        {:else if meeting_state === 'ai_result'}
            <div class="flex h-full justify-center">
                <div
                    class="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-bg-2"
                >
                    <div class="min-h-0 flex-1 overflow-y-auto p-6">
                        {#if loading}
                            <p class="text-fg-2">Génération en cours...</p>
                        {:else if tabs.length > 0}
                            {tabs[current_tab].result}
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    </div>

    {#if meeting_state === 'transcript' || meeting_state === 'ai_result'}
        <div class="shrink-0 border-bg-2 p-4">
            <div class="flex items-center justify-center gap-4">
                <button
                    class="btn ms-auto {meeting_state === 'transcript' ? 'secondary' : 'ghost'}"
                    onclick={() => (meeting_state = 'transcript')}
                >
                    Transcription
                </button>
                {#each tabs as tab, i}
                    {@const prompt = prompts_ctx.prompts.find((prompt) => prompt.id === tab.id)}
                    {#if prompt}
                        <button
                            class="btn {current_tab === i && meeting_state === 'ai_result'
                                ? 'secondary'
                                : 'ghost'}"
                            onclick={() => {
                                current_tab = i;
                                meeting_state = 'ai_result';
                            }}
                        >
                            {prompt.title}
                        </button>
                    {/if}
                {/each}
                <button
                    class="btn ghost"
                    disabled={loading}
                    onclick={() => (is_prompts_open = true)}
                >
                    <CrossIcon rotate={45} --size="1.2rem" />
                </button>
            </div>
        </div>
    {/if}
</div>

<Dialog
    is_open={is_settings_open}
    onrequestclose={() => (is_settings_open = false)}
    position="center"
>
    <Settings onclose={() => (is_settings_open = false)} />
</Dialog>
<Dialog
    is_open={is_prompts_open}
    onrequestclose={() => (is_prompts_open = false)}
    position="center"
>
    <PromptDialog
        {tabs}
        onselect={(prompt) => {
            generate(prompt);
            is_prompts_open = false;
        }}
    />
</Dialog>
