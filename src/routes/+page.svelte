<script lang="ts">
    import SettingsQuery from '$lib/scripts/SettingsQuery.svelte';
    import Dialog from '$lib/widgets/Dialog.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import SettingsIcon from '$lib/icons/SettingsIcon.svelte';
    import Upload from '$lib/upload/Upload.svelte';
    import {get_upload_context} from '$lib/upload/upload_context.svelte';
    import CopyIcon from '$lib/icons/CopyIcon.svelte';
    import DownloadIcon from '$lib/icons/DownloadIcon.svelte';
    import Transcript from '$lib/transcript/Transcript.svelte';
    import SuperRecorder from '$lib/recorder/SuperRecorder.svelte';
    import {writeFile} from '@tauri-apps/plugin-fs';
    import {save} from '@tauri-apps/plugin-dialog';
    import {get_generate_context} from '$lib/generate/generate_context.svelte';
    import { convertFileSrc } from '@tauri-apps/api/core';

    const settings = get_settings_context();
    const upload = get_upload_context();

    let meeting_state = $state<
        'record' | 'transcript' | 'edit' | 'resume' | 'mail' | 'compte-rendu'
    >();
    let audio_path = $state<string>();
    let is_open = $state(false);
    let blocs = $state<any[]>([]);
    let resume = $state<string>();

    const generate = get_generate_context();

    const onAudioReady = async (path: string) => {
        audio_path = convertFileSrc(decodeURIComponent(path));
        meeting_state = 'record';
        await upload.transcribe_from_path(path);
        meeting_state = 'transcript';
    };


    const get_transcript_text = () =>
        blocs.map((item: any) => `Speaker ${item.speaker + 1}: ${item.text}`).join('\n\n');

    const copy = async () => {
        await navigator.clipboard.writeText(get_transcript_text());
    };

    const download = async () => {
        const path = await save({
            filters: [{name: 'Text', extensions: ['txt']}],
            defaultPath: 'transcript.txt',
        });
        console.log('sauvegarder ds', path);
        if (!path) return;

        const encoder = new TextEncoder();
        await writeFile(path, encoder.encode(get_transcript_text()));
    };
</script>

<div class="flex h-screen flex-col">
    <div class="flex shrink-0 justify-between p-4">
        {#if meeting_state}
            <div class="flex items-center gap-3">
                <audio controls src={audio_path} class="h-10"></audio>
                <!-- <PlayerAudio src={audio_path}/> -->
            </div>
            <div class="flex items-end gap-4">
                <button class="btn ghost" onclick={copy}><CopyIcon /> copy</button>
                <button class="btn ghost" onclick={download}><DownloadIcon />download</button>
            </div>
        {/if}

        <button class="btn ghost icon" onclick={() => (is_open = true)}>
            <SettingsIcon />
        </button>
    </div>

    <div class="min-h-0 flex-1 px-6 pb-4">
        {#if !settings.deepgram_key || !settings.openrouter_key}
            <div class="flex h-full items-center justify-center">
                <div class="max-w-150 rounded-xl border border-dotted p-4 text-center">
                    Your openrouter keys and deepgram api keys are not setup yet. Use the settings
                    button to register your api keys locally.
                </div>
            </div>
        {:else if !meeting_state}
            <div class="flex h-full flex-col items-center justify-center gap-6">
                <SuperRecorder onfinish={onAudioReady} />
                <Upload onFinish={onAudioReady} />
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
                        <Transcript blocs_ready={(received) => (blocs = received)} />
                    </div>
                </div>
            </div>
        {:else if meeting_state === 'resume'}
            <div class="flex h-full justify-center">
                <div
                    class="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-bg-2"
                >
                    <div class="min-h-0 flex-1 overflow-y-auto p-6">
                        {#if generate.loading}
                            <p class="text-fg-2">Résumé en cours...</p>
                        {:else}
                            {generate.results['resume']}
                        {/if}
                    </div>
                </div>
            </div>
        {:else if meeting_state === 'compte-rendu'}
            <div class="flex h-full justify-center">
                <div
                    class="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-bg-2"
                >
                    <div class="min-h-0 flex-1 overflow-y-auto p-6">
                        {#if generate.loading}
                            <p class="text-fg-2">Compte-rendu en cours...</p>
                        {:else}
                            {generate.results['compte-rendu']}
                        {/if}
                    </div>
                </div>
            </div>
        {:else if meeting_state === 'mail'}
            <div class="flex h-full justify-center">
                <div
                    class="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-bg-2"
                >
                    <div class="min-h-0 flex-1 overflow-y-auto p-6">
                        {#if generate.loading}
                            <p class="text-fg-2">Mail en cours...</p>
                        {:else}
                            {generate.results['mail']}
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    </div>

    {#if meeting_state === 'transcript' || meeting_state === 'resume' || meeting_state === 'compte-rendu' || meeting_state === 'mail'}
        <div class="shrink-0 border-bg-2 p-4">
            <div class="flex items-center justify-center gap-4">
                <button
                    class="btn ghost {meeting_state === 'transcript' ? 'active' : ''}"
                    onclick={() => (meeting_state = 'transcript')}>transcript</button
                >
                <button
                    class="btn ghost {meeting_state === 'resume' ? 'active' : ''}"
                    onclick={() => {
                        meeting_state = 'resume';
                        generate.generate('resume', get_transcript_text());
                    }}
                >
                    résumé
                </button>
                <button
                    class="btn ghost {meeting_state === 'compte-rendu' ? 'active' : ''}"
                    onclick={() => {
                        meeting_state = 'compte-rendu';
                        generate.generate('compte-rendu', get_transcript_text());
                    }}
                >
                    compte rendu
                </button>
                <button
                    class="btn ghost {meeting_state === 'mail' ? 'active' : ''}"
                    onclick={() => {
                        meeting_state = 'mail';
                        generate.generate('mail', get_transcript_text());
                    }}>mail client</button
                >
            </div>
            {#if resume}
                <p class="mt-4 text-debug">{resume}</p>
            {/if}
        </div>
    {/if}
</div>

<Dialog {is_open} onrequestclose={() => (is_open = false)} position="center">
    <SettingsQuery onclose={() => (is_open = false)} />
</Dialog>
