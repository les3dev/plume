<script lang="ts">
    import SettingsQuery from '$lib/scripts/SettingsQuery.svelte'
    import Dialog from '$lib/widgets/Dialog.svelte'
    import { get_settings_context } from '$lib/settings/settings_context.svelte'
    import SettingsIcon from '$lib/icons/SettingsIcon.svelte'
    import Recorder from '$lib/recorder/Recorder.svelte'
    import Upload from '$lib/upload/Upload.svelte'
    import { get_upload_context } from '$lib/upload/upload_context.svelte'
    import CopyIcon from '$lib/icons/CopyIcon.svelte'
    import DownloadIcon from '$lib/icons/DownloadIcon.svelte'
    import PlayIcon from '$lib/icons/PlayIcon.svelte'
    import SparklesIcon from '$lib/icons/SparklesIcon.svelte'
    import Transcript from '$lib/transcript/Transcript.svelte'
    import SuperRecorder from '$lib/recorder/SuperRecorder.svelte'

    const settings = get_settings_context()
    const upload = get_upload_context()

    let audio_ready = $state<string>()
    let is_open = $state(false)

    let has_audio = $derived(audio_ready !== undefined || upload.audio_bytes !== undefined)
</script>

<div class="flex h-screen flex-col">
    <div class="flex shrink-0 justify-between p-4">
        <button class="btn" hidden={!has_audio}>
            <PlayIcon />
            client.mp3
            <span class="opacity-50">00:30</span>
        </button>

        <div class="flex items-end gap-4">
            <button class="btn ghost" hidden={!has_audio}>
                <CopyIcon />
                copy
            </button>
            <button class="btn ghost" hidden={!has_audio}>
                <DownloadIcon />
                download
            </button>
        </div>

        <button class="btn ghost icon" onclick={() => (is_open = true)}>
            <SettingsIcon />
        </button>
    </div>

    <div class="min-h-0 flex-1 px-6 pb-4">
        {#if !settings.deepgram_key || !settings.openai_key}
            <div class="flex h-full items-center justify-center">
                <div class="max-w-150 rounded-xl border border-dotted p-4 text-center">
                    Your open ai and deepgram api keys are not setup yet. Use the settings button to
                    register your api keys locally.
                </div>
            </div>
        {:else if !has_audio}
            <div class="flex h-full items-center justify-center gap-6">
                <Recorder
                    audio_ready={async (path) => {
                        audio_ready = path
                        await upload.transcribe_from_path(path)
                    }}
                />
                <SuperRecorder />
                <Upload />
            </div>
        {:else if !upload.transcript}
            <div class="flex h-full items-center justify-center">
                <div class="rounded-xl border border-dashed border-bg-2 p-6 text-fg-2">
                    Transcription en cours...
                </div>
            </div>
        {:else}
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

    <div class="shrink-0 border-bg-2 p-4">
        <div class="flex items-center justify-center gap-4">
            <button class="btn ghost" hidden={!has_audio}>
                <SparklesIcon />
                transcript
            </button>
            <button class="btn ghost" hidden={!has_audio}>
                <SparklesIcon />
                résumé interne
            </button>
            <button class="btn ghost" hidden={!has_audio}>
                <SparklesIcon />
                compte rendu
            </button>
            <button class="btn ghost" hidden={!has_audio}>
                <SparklesIcon />
                mail client
            </button>
        </div>
    </div>
</div>

<Dialog {is_open} onrequestclose={() => (is_open = false)} position="center">
    <SettingsQuery onclose={() => (is_open = false)} />
</Dialog>
