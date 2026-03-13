
<script lang="ts">
    import SettingsQuery from '$lib/scripts/SettingsQuery.svelte';
    import Dialog from '$lib/widgets/Dialog.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import SettingsIcon from '$lib/icons/SettingsIcon.svelte';
    import Upload from '$lib/upload/Upload.svelte';
    import {get_upload_context} from '$lib/upload/upload_context.svelte';
    import CopyIcon from '$lib/icons/CopyIcon.svelte';
    import DownloadIcon from '$lib/icons/DownloadIcon.svelte';
    import PlayIcon from '$lib/icons/PlayIcon.svelte';
    import SparklesIcon from '$lib/icons/SparklesIcon.svelte';
    import Transcript from '$lib/transcript/Transcript.svelte';
    import SuperRecorder from '$lib/recorder/SuperRecorder.svelte';
    import {genererResume} from '$lib/openrouter/openrouter';

    const settings = get_settings_context();
    const upload = get_upload_context();

    let meeting_state = $state<'record' | 'transcript' | 'edit'>();
    let audio_path = $state<string>();
    let is_open = $state(false);
    let resume = $state('');
    let chargement = $state(false);

    const onAudioReady = async (path: string) => {
        audio_path = decodeURIComponent(path);
        meeting_state = 'record';
        await upload.transcribe_from_path(path);
        meeting_state = 'transcript';
    };

    const lancerResume = async () => {
        chargement = true;
        resume = await genererResume('1+1 = ', settings.openrouter_key);
        chargement = false;
    };
</script>

<div class="flex h-screen flex-col">
    <div class="flex shrink-0 justify-between p-4">
        {#if meeting_state}
            <button class="btn">
                <PlayIcon />
                {audio_path?.split('/').pop() ?? 'audio'}
                <span class="opacity-50">00:30</span>
            </button>
            <div class="flex items-end gap-4">
                <button class="btn ghost"><CopyIcon /> copy</button>
                <button class="btn ghost"><DownloadIcon /> download</button>
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
                <Upload onFinish={onAudioReady}/>
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
                        <Transcript />
                    </div>
                </div>
            </div>
        {/if}
    </div>

    {#if meeting_state === 'transcript'}
        <div class="shrink-0 border-bg-2 p-4">
            <div class="flex items-center justify-center gap-4">
                <button class="btn ghost"><SparklesIcon /> transcript</button>
                <button class="btn ghost" onclick={lancerResume}>
                    <SparklesIcon /> résumé
                </button>
                <button class="btn ghost"><SparklesIcon /> compte rendu</button>
                <button class="btn ghost"><SparklesIcon /> mail client</button>
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
