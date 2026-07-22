<script lang="ts">
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import SettingsIcon from '$lib/icons/SettingsIcon.svelte';
    import Upload from '$lib/upload/Upload.svelte';
    import CopyIcon from '$lib/icons/CopyIcon.svelte';
    import TranscriptEditor from '$lib/transcribe/TranscriptEditor.svelte';
    import SuperRecorder from '$lib/recorder/SuperRecorder.svelte';
    import {goto} from '$app/navigation';
    import ProgressCircle from '$lib/widgets/ProgressCircle.svelte';
    import {get_meeting_context} from '$lib/meeting/meeting_context.svelte';
    import FolderIcon from '$lib/icons/FolderIcon.svelte';
    import {openPath} from '@tauri-apps/plugin-opener';
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';
    import {parse_folder_name} from '$lib/helpers/parse_folder_name.js';
    import Popover from '$lib/widgets/Popover.svelte';
    import MicIcon from '$lib/icons/MicIcon.svelte';
    import SparklesIcon from '$lib/icons/SparklesIcon.svelte';

    const meeting_context = get_meeting_context();
    const settings_context = get_settings_context();

    let {params} = $props();
    const folder_name = $derived(decodeURIComponent(params.name));

    let is_recording = $state(false);
    let is_audio_open = $state(false);
    let show_dialog_deleted = $state(false);

    const folder_path = $derived(`${settings_context.save_path}/${folder_name}`);
    const meeting_date = $derived(
        parse_folder_name(folder_name)?.date.toFormat('dd/MM/yyyy HH:mm') ?? '',
    );

    $effect(() => {
        meeting_context.load_meeting(folder_name);
    });

    meeting_context.on_meeting_renamed = (new_folder_name) => {
        goto(`/meeting/${encodeURIComponent(new_folder_name)}`, {replaceState: true});
    };

    const copy = async () => {
        await navigator.clipboard.writeText(meeting_context.transcript_text);
    };
</script>

<div class="flex h-screen flex-col">
    <header class="flex items-center gap-2 p-4 pb-2">
        <button class="btn ghost icon" onclick={() => goto('/')}>
            <ChevronIcon />
        </button>
        <div class="me-auto flex flex-wrap items-center font-serif text-lg font-semibold">
            <input
                class="me-2 h-fit! rounded-none! border-none! bg-transparent! px-0! font-serif! text-lg! font-semibold!"
                type="text"
                size={meeting_context.meeting_name.length || 1}
                bind:value={
                    () => meeting_context.meeting_name,
                    (new_value) => meeting_context.rename_meeting(new_value)
                }
            />
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
    {:else if meeting_context.audio_asset_path === undefined && !meeting_context.has_transcript_file}
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
    {:else if meeting_context.audio_asset_path === undefined && meeting_context.has_transcript_file}
        {#if meeting_context.transcript instanceof Error}
            <div class="m-auto text-error">
                Erreur de transcript: {meeting_context.transcript.message}
            </div>
        {:else}
            <div class="flex grow flex-col overflow-hidden">
                <div class="flex gap-2 px-4 pb-2">
                    <button class="btn ghost" onclick={copy}
                        ><CopyIcon --size="1.2rem" />Copier</button
                    >
                    {#if settings_context.openrouter_key}
                        <button
                            class="btn ghost"
                            disabled={meeting_context.is_identifying_speakers}
                            onclick={() => meeting_context.identify_speakers(folder_path)}
                        >
                            <SparklesIcon --size="1.2rem" />
                            {meeting_context.is_identifying_speakers
                                ? 'Identification en cours...'
                                : 'Identifier les speakers'}
                        </button>
                    {/if}
                </div>
                <div class="flex grow flex-col overflow-auto">
                    <TranscriptEditor
                        transcript={meeting_context.transcript}
                        duration={meeting_context.transcript_timer.value}
                    />
                </div>
            </div>
        {/if}
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
                {#if settings_context.openrouter_key}
                    <button
                        class="btn ghost"
                        disabled={meeting_context.is_identifying_speakers}
                        onclick={() => meeting_context.identify_speakers(folder_path)}
                    >
                        <SparklesIcon --size="1.2rem" />
                        {meeting_context.is_identifying_speakers
                            ? 'Identification en cours...'
                            : 'Identifier les speakers'}
                    </button>
                {/if}
            </div>
            <div class="flex grow flex-col overflow-auto">
                <TranscriptEditor
                    transcript={meeting_context.transcript}
                    duration={meeting_context.transcript_timer.value}
                />
            </div>
        </div>
    {/if}
</div>
