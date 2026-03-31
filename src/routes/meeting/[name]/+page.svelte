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
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import PaperPlaneIcon from '$lib/icons/PaperPlaneIcon.svelte';
    import PromptDialog from '$lib/prompt/PromptDialog.svelte';
    import {get_prompt_context} from '$lib/prompt/prompt_context.svelte';
    import {goto} from '$app/navigation';
    import ProgressCircle from '$lib/widgets/ProgressCircle.svelte';
    import MarkdownResult from '$lib/prompt/MarkdownResult.svelte';
    import {get_meeting_context} from '$lib/meeting/meeting_context.svelte';
    import SparklesIcon from '$lib/icons/SparklesIcon.svelte';
    import FolderIcon from '$lib/icons/FolderIcon.svelte';
    import {openPath} from '@tauri-apps/plugin-opener';
    import {open} from '@tauri-apps/plugin-shell';
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';
    import {parse_folder_name} from '$lib/helpers/parse_folder_name.js';

    const meeting = get_meeting_context();
    const settings = get_settings_context();
    const prompts = get_prompt_context();

    let {params} = $props();
    const folder_name = $derived(decodeURIComponent(params.name));

    let is_prompts_open = $state(false);
    let mail_error = $state<string>();
    let is_recording = $state(false);

    const folder_path = $derived(`${settings.save_path}/${folder_name}`);
    const meeting_date = $derived(
        parse_folder_name(folder_name)?.date.toFormat('dd/MM/yyyy HH:mm') ?? '',
    );

    $effect(() => {
        meeting.load_meeting(folder_name, prompts.prompts);
    });

    const copy = async () => {
        if (meeting.tab_type === 'ai' && meeting.ai_tabs.length > 0) {
            await navigator.clipboard.writeText(
                meeting.ai_tabs[meeting.selected_ai_tab].ai_generation,
            );
        } else {
            await navigator.clipboard.writeText(meeting.transcript_text);
        }
    };

    // const download = async () => {
    //     const default_name = 'transcript';
    //     const prompt_name =
    //         meeting.tab_type === 'ai' && meeting.ai_tabs.length > 0
    //             ? (prompts.prompts.find((p) => p.id === meeting.ai_tabs[meeting.selected_ai_tab].id)
    //                   ?.title ?? default_name)
    //             : default_name;

    //     const path = `${folder_path}/${prompt_name}.txt`;
    //     if (!path) return;
    //     const encoder = new TextEncoder();
    //     const content =
    //         meeting.tab_type === 'ai' && meeting.ai_tabs.length > 0
    //             ? meeting.ai_tabs[meeting.selected_ai_tab].ai_generation
    //             : meeting.transcript_text;
    //     await writeFile(path, encoder.encode(content));
    // };

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
    <header class="flex items-center p-4 pb-2">
        <button class="btn ghost icon" onclick={() => goto('/')}>
            <ChevronIcon />
        </button>
        <div class="font-serif text-lg font-semibold">
            {meeting.meeting_name} <span class="font-sans text-xs text-fg-2">{meeting_date}</span>
        </div>
        <button
            class="btn ghost icon ms-auto"
            onclick={() => {
                console.log('folder_path:', folder_path);
                openPath(folder_path);
            }}
        >
            <FolderIcon />
        </button>
        {#if meeting.audio_asset_path}
            <audio controls src={meeting.audio_asset_path} class="h-10"></audio>
        {:else}
            <button class="btn ghost icon ms-auto" onclick={() => (is_prompts_open = true)}
                ><SparklesIcon --size="1.2rem" /></button
            >
        {/if}
        <button class="btn ghost icon" onclick={meeting.reset}> 🗑️ </button>
        <button class="btn ghost icon" title="Réglages" onclick={() => goto('/settings')}>
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
    {:else if meeting.audio_asset_path === undefined}
        <div class="flex grow flex-col items-center justify-center gap-14">
            <SuperRecorder
                onstart={() => (is_recording = true)}
                onfinish={(raw_path, asset_path, start_time, duration) => {
                    meeting.start_recording_time = start_time;
                    meeting.recording_duration = duration;
                    meeting.start_transcript(raw_path, asset_path, folder_path);
                    is_recording = false;
                }}
                {folder_path}
            />
            {#if !is_recording}
                <Upload
                    onfile={(raw_path, asset_path, start_time, duration) => {
                        meeting.start_recording_time = start_time;
                        meeting.recording_duration = duration;
                        meeting.start_transcript(raw_path, asset_path, folder_path);
                    }}
                />
            {/if}
        </div>
    {:else if meeting.transcript instanceof Error}
        <div class="m-auto text-error">Erreur de transcript: {meeting.transcript.message}</div>
    {:else if meeting.transcript.length === 0}
        {#if meeting.transcript_timer.start_time !== undefined && meeting.transcript_timer.end_time === undefined}
            <div class="flex grow flex-col items-center justify-center gap-4">
                <ProgressCircle --color="var(--color-primary)" show_value={false} infinite={true} />
                <div>Transcription en cours ({meeting.transcript_timer.value})…</div>
            </div>
        {:else}
            <div class="m-auto flex flex-col items-center gap-4">
                <p class="text-fg-2">Aucune transcription disponible</p>
                <button
                    class="btn"
                    onclick={() =>
                        meeting.start_transcript(
                            meeting.audio_raw_path!,
                            meeting.audio_asset_path!,
                            folder_path,
                        )}
                >
                    Transcrire
                </button>
            </div>
        {/if}
    {:else}
        <div class="flex grow flex-col overflow-hidden">
            <div class="flex gap-2 px-4 pb-2">
                <button class="btn ghost" onclick={copy}><CopyIcon --size="1.2rem" />Copier</button>
                <!-- <button class="btn ghost" onclick={download}
                    ><DownloadIcon --size="1.2rem" />Télécharger</button
                > -->

                {#if meeting.ai_tabs.length > 0}
                    {@const current_generation = meeting.ai_tabs[meeting.selected_ai_tab]}
                    {@const prompt = prompts.prompts.find((p) => p.id === current_generation.id)}
                    {#if prompt?.title === 'Email' && settings.mail_client && current_generation.ai_generation}
                        <button
                            class="btn ghost"
                            onclick={() => open_mail(current_generation.ai_generation)}
                        >
                            <PaperPlaneIcon --size="1.2rem" />Envoyer
                        </button>
                        {#if mail_error}
                            <p class="text-red-400 text-sm">{mail_error}</p>
                        {/if}
                    {/if}
                {/if}
            </div>
            <div class="flex grow flex-col overflow-auto">
                {#if meeting.tab_type === 'transcript'}
                    <TranscriptEditor
                        transcript={meeting.transcript}
                        duration={meeting.transcript_timer.value}
                    />
                {:else if meeting.tab_type === 'ai'}
                    {#if meeting.ai_tabs.length > 0}
                        <MarkdownResult
                            markdown={meeting.ai_tabs[meeting.selected_ai_tab].ai_generation}
                        />
                    {:else if meeting.is_generating}
                        <p class="text-cen m-auto text-fg-2">Génération en cours...</p>
                    {/if}
                {/if}
            </div>
        </div>
        <div class="shrink-0 border-bg-2 p-4">
            <div class="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4">
                <button
                    class="btn {meeting.tab_type === 'transcript' ? 'secondary' : 'ghost'}"
                    onclick={() => (meeting.tab_type = 'transcript')}
                >
                    Transcription
                </button>
                {#each meeting.ai_tabs as tab, i}
                    {@const prompt = prompts.prompts.find((p) => p.id === tab.id)}
                    {#if prompt}
                        <button
                            class="btn {meeting.selected_ai_tab === i && meeting.tab_type === 'ai'
                                ? 'secondary'
                                : 'ghost'}"
                            onclick={() => {
                                meeting.selected_ai_tab = i;
                                meeting.tab_type = 'ai';
                            }}
                        >
                            {prompt.title}
                        </button>
                    {/if}
                {/each}
                <button
                    class="btn ghost icon"
                    disabled={meeting.is_generating}
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
    style="--width: 100%; --max-width: 90vw;"
>
    <PromptDialog
        used_prompts={meeting.ai_tabs}
        can_generate={meeting.audio_asset_path !== undefined}
        ongenerate={(prompt) => {
            meeting.generate(prompt, folder_path);
            is_prompts_open = false;
        }}
    />
</Dialog>
