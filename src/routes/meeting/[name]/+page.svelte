<script lang="ts">
    import Dialog from '$lib/widgets/Dialog.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import SettingsIcon from '$lib/icons/SettingsIcon.svelte';
    import Upload from '$lib/upload/Upload.svelte';
    import CopyIcon from '$lib/icons/CopyIcon.svelte';
    import TranscriptEditor from '$lib/transcribe/TranscriptEditor.svelte';
    import SuperRecorder from '$lib/recorder/SuperRecorder.svelte';
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import PaperPlaneIcon from '$lib/icons/PaperPlaneIcon.svelte';
    import PromptDialog from '$lib/prompt/PromptDialog.svelte';
    import {get_prompt_context} from '$lib/prompt/prompt_context.svelte';
    import {goto} from '$app/navigation';
    import ProgressCircle from '$lib/widgets/ProgressCircle.svelte';
    import MarkdownResult from '$lib/prompt/MarkdownResult.svelte';
    import {get_meeting_context} from '$lib/meeting/meeting_context.svelte';
    import FolderIcon from '$lib/icons/FolderIcon.svelte';
    import {openPath} from '@tauri-apps/plugin-opener';
    import {open} from '@tauri-apps/plugin-shell';
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';
    import {parse_folder_name} from '$lib/helpers/parse_folder_name.js';
    import Popover from '$lib/widgets/Popover.svelte';
    import MicIcon from '$lib/icons/MicIcon.svelte';
    import PenIcon from '$lib/icons/PenIcon.svelte';
    import {remove} from '@tauri-apps/plugin-fs';
    import {page} from '$app/state';
    import TrashIcon from '$lib/icons/TrashIcon.svelte';

    const meeting_context = get_meeting_context();
    const settings_context = get_settings_context();
    const prompts_context = get_prompt_context();

    let {params} = $props();
    const folder_name = $derived(decodeURIComponent(params.name));

    let is_prompts_open = $state(false);
    let mail_error = $state<string>();
    let is_recording = $state(false);
    let is_audio_open = $state(false);

    const folder_path = $derived(`${settings_context.save_path}/${folder_name}`);
    const meeting_date = $derived(
        parse_folder_name(folder_name)?.date.toFormat('dd/MM/yyyy HH:mm') ?? '',
    );

    $effect(() => {
        const prompt_id = page.url.searchParams.get('prompt') ?? undefined;
        meeting_context.load_meeting(folder_name, prompts_context.prompts, prompt_id);
    });

    const copy = async () => {
        if (meeting_context.tab_type === 'ai' && meeting_context.ai_tabs.length > 0) {
            await navigator.clipboard.writeText(
                meeting_context.ai_tabs[meeting_context.selected_ai_tab].ai_generation,
            );
        } else {
            await navigator.clipboard.writeText(meeting_context.transcript_text);
        }
    };

    const delete_file = async (prompt_id: string) => {
        const prompt = prompts_context.prompts.find((prompt) => prompt.id === prompt_id);
        if (prompt) {
            await remove(`${folder_path}/${prompt.title}.txt`);
        }

        meeting_context.ai_tabs = meeting_context.ai_tabs.filter((tab) => tab.id !== prompt_id);
        meeting_context.selected_ai_tab = 0;
        meeting_context.tab_type = meeting_context.ai_tabs.length > 0 ? 'ai' : 'transcript';
    };

    const open_mail = (body: string) => {
        if (!settings_context.mail_client) {
            mail_error = "Vous n'avez pas choisis de mail par défaut";
            return;
        }
        const urls = {
            mailto: `mailto:?subject=Compte rendu&body=${encodeURIComponent(body)}`,
            gmail: `https://mail.google.com/mail/?view=cm&body=${encodeURIComponent(body)}`,
            outlook: `https://outlook.office.com/mail/deeplink/compose?body=${encodeURIComponent(body)}`,
        };
        open(urls[settings_context.mail_client]);
    };
</script>

<div class="flex h-screen flex-col">
    <header class="flex items-center gap-2 p-4 pb-2">
        <button class="btn ghost icon" onclick={() => goto('/')}>
            <ChevronIcon />
        </button>
        <div class="me-auto flex flex-wrap items-center font-serif text-lg font-semibold">
            <span class="me-2">{meeting_context.meeting_name}</span>
            <span class="font-sans text-xs text-fg-2">{meeting_date}</span>
        </div>
        {#if meeting_context.audio_asset_path}
            <Popover bind:is_open={is_audio_open} offset_y={10}>
                {#snippet target()}
                    <button class="btn ghost icon" onclick={() => (is_audio_open = !is_audio_open)}
                        ><MicIcon --size="1.2rem" /></button
                    >
                {/snippet}
                <audio controls src={meeting_context.audio_asset_path}></audio>
            </Popover>
        {/if}
        <button
            class="btn ghost icon"
            onclick={() => {
                console.log('folder_path:', folder_path);
                openPath(folder_path);
            }}
        >
            <FolderIcon --size="1.4rem" />
        </button>
        <button class="btn ghost icon" title="Réglages" onclick={() => goto('/settings')}>
            <SettingsIcon --size="1.2rem" />
        </button>
    </header>

    {#if !settings_context.deepgram_key || !settings_context.openrouter_key}
        <div class="flex h-full items-center justify-center">
            <div class="max-w-150 rounded-xl border border-dotted p-4 text-center">
                Vos clés API OpenRouter et Deepgram ne sont pas encore configurées. Utilisez le <span
                    class="text-primary">bouton Paramètres</span
                > pour enregistrer vos clés API localement.
            </div>
        </div>
    {:else if meeting_context.audio_asset_path === undefined}
        <div class="flex grow flex-col items-center justify-center gap-14">
            <SuperRecorder
                onstart={() => (is_recording = true)}
                onfinish={(raw_path, asset_path, start_time, duration) => {
                    meeting_context.start_recording_time = start_time;
                    meeting_context.recording_duration = duration;
                    meeting_context.start_transcript(raw_path, asset_path, folder_path);
                    is_recording = false;
                }}
                {folder_path}
            />
            {#if !is_recording}
                <Upload
                    onfile={(raw_path, asset_path, start_time, duration) => {
                        meeting_context.start_recording_time = start_time;
                        meeting_context.recording_duration = duration;
                        meeting_context.start_transcript(raw_path, asset_path, folder_path);
                    }}
                />
            {/if}
        </div>
    {:else if meeting_context.transcript instanceof Error}
        <div class="m-auto text-error">
            Erreur de transcript: {meeting_context.transcript.message}
        </div>
    {:else if meeting_context.transcript.length === 0}
        {#if meeting_context.transcript_timer.start_time !== undefined && meeting_context.transcript_timer.end_time === undefined}
            <div class="flex grow flex-col items-center justify-center gap-4">
                <ProgressCircle --color="var(--color-primary)" show_value={false} infinite={true} />
                <div>Transcription en cours ({meeting_context.transcript_timer.value})…</div>
            </div>
        {:else}
            <div class="m-auto flex flex-col items-center gap-4">
                <p class="text-fg-2">Aucune transcription disponible</p>
                <button
                    class="btn"
                    onclick={() =>
                        meeting_context.start_transcript(
                            meeting_context.audio_raw_path!,
                            meeting_context.audio_asset_path!,
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

                {#if meeting_context.ai_tabs.length > 0}
                    {@const current_generation =
                        meeting_context.ai_tabs[meeting_context.selected_ai_tab]}
                    {@const prompt = prompts_context.prompts.find(
                        (p) => p.id === current_generation.id,
                    )}
                    {#if prompt?.title === 'Email' && settings_context.mail_client && current_generation.ai_generation}
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
                    {#if meeting_context.tab_type === 'ai'}
                        <button
                            class="btn ghost"
                            onclick={() =>
                                goto(
                                    `/meeting/${encodeURIComponent(folder_name)}/edit?prompt=${meeting_context.ai_tabs[meeting_context.selected_ai_tab].id}`,
                                )}
                        >
                            <PenIcon --size="1.2rem" /> Éditer
                        </button>
                        <button
                            class="btn ms-auto"
                            onclick={() => delete_file(current_generation.id)}
                        >
                            <TrashIcon --size="1.2rem" />Supprimer</button
                        >
                    {/if}
                {/if}
            </div>
            <div class="flex grow flex-col overflow-auto">
                {#if meeting_context.tab_type === 'transcript'}
                    <TranscriptEditor
                        transcript={meeting_context.transcript}
                        duration={meeting_context.transcript_timer.value}
                    />
                {:else if meeting_context.tab_type === 'ai'}
                    {#if meeting_context.ai_tabs.length > 0}
                        <MarkdownResult
                            markdown={meeting_context.ai_tabs[meeting_context.selected_ai_tab]
                                .ai_generation}
                        />
                    {:else if meeting_context.is_generating}
                        <p class="text-cen m-auto text-fg-2">Génération en cours...</p>
                    {/if}
                {/if}
            </div>
        </div>
        <div class="shrink-0 border-bg-2 p-4">
            <div class="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2">
                <button
                    class="btn {meeting_context.tab_type === 'transcript' ? 'secondary' : 'ghost'}"
                    onclick={() => (meeting_context.tab_type = 'transcript')}
                >
                    Transcription
                </button>
                {#each meeting_context.ai_tabs as tab, i}
                    {@const prompt = prompts_context.prompts.find((p) => p.id === tab.id)}
                    {#if prompt}
                        <button
                            class="btn {meeting_context.selected_ai_tab === i &&
                            meeting_context.tab_type === 'ai'
                                ? 'secondary'
                                : 'ghost'}"
                            onclick={() => {
                                meeting_context.selected_ai_tab = i;
                                meeting_context.tab_type = 'ai';
                            }}
                        >
                            {prompt.title}
                        </button>
                    {/if}
                {/each}
                <button
                    class="btn ghost icon"
                    disabled={meeting_context.is_generating}
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
    --width="50rem"
    --max-width="90%"
>
    <PromptDialog
        used_prompts={meeting_context.ai_tabs}
        can_generate={meeting_context.audio_asset_path !== undefined}
        ongenerate={(prompt) => {
            meeting_context.generate(prompt, folder_path);
            is_prompts_open = false;
        }}
    />
</Dialog>
