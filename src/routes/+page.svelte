<script lang="ts">
    import Dialog from '$lib/widgets/Dialog.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import SettingsIcon from '$lib/icons/SettingsIcon.svelte';
    import Upload from '$lib/upload/Upload.svelte';
    import CopyIcon from '$lib/icons/CopyIcon.svelte';
    import DownloadIcon from '$lib/icons/DownloadIcon.svelte';
    import TranscriptEditor from '$lib/transcribe/TranscriptEditor.svelte';
    import SuperRecorder from '$lib/recorder/SuperRecorder.svelte';
    import {writeFile} from '@tauri-apps/plugin-fs';
    import {save} from '@tauri-apps/plugin-dialog';
    import {generate_summary} from '$lib/openrouter/openrouter';
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import {open} from '@tauri-apps/plugin-shell';
    import PaperPlaneIcon from '$lib/icons/PaperPlaneIcon.svelte';
    import PromptDialog from '$lib/prompt/PromptDialog.svelte';
    import {get_prompt_context, type Prompt} from '$lib/prompt/prompt_context.svelte';
    import {goto} from '$app/navigation';
    import {reactive_timer} from '$lib/helpers/reactive_timer.svelte';
    import {generate_transcript, type TranscriptBlock} from '$lib/transcribe/generate_transcript';

    const settings = get_settings_context();
    const prompts_ctx = get_prompt_context();

    let audio_path = $state<string>();
    let is_prompts_open = $state(false);
    let mail_error = $state<string>();
    let tabs = $state<{id: string; result: string}[]>([]);
    let tab_type = $state<'transcript' | 'ai'>('transcript');
    let current_tab = $state(0);
    let is_generating = $state(false);

    let is_recording = $state(false);

    let meeting_name = $state('Nouvelle réunion');

    let transcript = $state<TranscriptBlock[] | Error>([]);
    let transcript_text = $derived(
        transcript instanceof Error
            ? ``
            : transcript.map((s) => `Speaker ${s.speaker + 1}: ${s.text}`).join('\n\n'),
    );

    const generate = async (prompt: Prompt) => {
        if (tabs.some((tab) => tab.id === prompt.id) || is_generating || !transcript_text) return;
        is_generating = true;
        tabs.push({id: prompt.id, result: ''});
        current_tab = tabs.length - 1;
        tab_type = 'ai';
        const result = await generate_summary(
            `${prompt.prompt} ${transcript_text}`,
            settings.openrouter_key,
            settings.model,
        );
        tabs[current_tab].result = result;
        is_generating = false;
    };

    const transcript_timer = reactive_timer();

    const start_transcript = async (path: string) => {
        transcript_timer.start();
        audio_path = path;
        if (settings.deepgram_key) {
            transcript = await generate_transcript(path, settings.deepgram_key);
        }
        transcript_timer.stop();
    };

    const copy = async () => {
        await navigator.clipboard.writeText(transcript_text);
    };

    const download = async () => {
        const path = await save({
            filters: [{name: 'Text', extensions: ['txt']}],
            defaultPath: 'transcript.txt',
        });
        if (!path) return;
        const encoder = new TextEncoder();
        await writeFile(path, encoder.encode(transcript_text));
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

    const reset = () => {
        audio_path = undefined;
        transcript = [];
        tabs = [];
        current_tab = 0;
        is_generating = false;
        meeting_name = 'Nouvelle réunion';
    };
</script>

<div class="flex h-screen flex-col">
    <header class="flex items-center gap-2 p-4 pb-2">
        <button class="btn ghost icon" onclick={reset}>
            <CrossIcon --size="1.2rem" />
        </button>
        <input type="text" bind:value={meeting_name} class="bg-transparent outline-none" />
        {#if audio_path !== undefined}
            <audio controls src={audio_path} class="h-10"></audio>
        {/if}
        <button class="btn ghost icon ms-auto" onclick={() => goto('/settings')}>
            <SettingsIcon --size="1.2rem" />
        </button>
    </header>

    {#if !settings.deepgram_key || !settings.openrouter_key}
        <div class="flex h-full items-center justify-center">
            <div class="max-w-150 rounded-xl border border-dotted p-4 text-center">
                Vos clés API OpenRouter et Deepgram ne sont pas encore configurées. Utilisez le <span
                    class="text-primary">bouton Paramètres</span
                > pour enregistrer vos clés API localement.
            </div>
        </div>
        <!-- If no audio_path, need to record or upload audio first -->
    {:else if audio_path === undefined}
        <div class="flex grow flex-col items-center justify-center gap-14">
            <SuperRecorder
                onstart={() => (is_recording = true)}
                onfinish={(path) => {
                    start_transcript(path);
                    is_recording = false;
                }}
            />
            {#if !is_recording}
                <Upload
                    onfile={(path) => {
                        start_transcript(path);
                    }}
                />
            {/if}
        </div>
    {:else if transcript instanceof Error}
        <div>Erreur de transcript: {transcript.message}</div>
    {:else if transcript.length === 0}
        <div>Transcript en cours</div>
    {:else}
        <div class="flex grow flex-col overflow-hidden">
            <div class="flex gap-2 px-4 pb-2">
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
            <div class="flex grow flex-col overflow-auto">
                {#if tab_type === 'transcript'}
                    <TranscriptEditor {transcript} />
                {:else if tab_type === 'ai'}
                    {#if is_generating}
                        <p class="text-cen text-fg-2">Génération en cours...</p>
                    {:else if tabs.length > 0}
                        {tabs[current_tab].result}
                    {/if}
                {/if}
            </div>
        </div>
        <div class="shrink-0 border-bg-2 p-4">
            <div class="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4">
                <button
                    class="btn {tab_type === 'transcript' ? 'secondary' : 'ghost'}"
                    onclick={() => (tab_type = 'transcript')}
                >
                    Transcription
                </button>
                {#each tabs as tab, i}
                    {@const prompt = prompts_ctx.prompts.find((p) => p.id === tab.id)}
                    {#if prompt}
                        <button
                            class="btn {current_tab === i && tab_type === 'ai'
                                ? 'secondary'
                                : 'ghost'}"
                            onclick={() => {
                                current_tab = i;
                                tab_type = 'ai';
                            }}
                        >
                            {prompt.title}
                        </button>
                    {/if}
                {/each}
                <button
                    class="btn ghost"
                    disabled={is_generating}
                    onclick={() => (is_prompts_open = true)}
                >
                    <CrossIcon rotate={45} --size="1.2rem" />
                </button>
            </div>
        </div>
    {/if}
</div>

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
