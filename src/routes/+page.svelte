<script lang="ts">
    import SettingsQuery from '$lib/scripts/SettingsQuery.svelte';
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
    import {get_generate_context} from '$lib/generate/generate_context.svelte';
    import {get_transcribe_context} from '$lib/transcribe/transcribe_context.svelte';
    import type {SpeechBlock} from '$lib/transcribe/Transcribe.svelte';
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import Popover from '$lib/widgets/Popover.svelte';
    import {open} from '@tauri-apps/plugin-shell';
    import PaperPlane from '$lib/icons/PaperPlane.svelte';

    const settings = get_settings_context();
    const generate = get_generate_context();
    const transcribe = get_transcribe_context();

    let speech_block = $state<SpeechBlock[]>([]);
    let meeting_state = $state<'record' | 'transcript' | 'edit'>();
    let audio_path = $state<string>();
    let is_open = $state(false);
    let show_menu = $state(false);
    let mail_error = $state<string>();

    const on_audio_ready = async (path: string) => {
        // recorder
        if (path.startsWith('asset://')) {
            audio_path = decodeURIComponent(path);
            const system_path = decodeURIComponent(new URL(path).pathname);
            meeting_state = 'record';
            await transcribe.transcribe_from_path(system_path);
        } else {
            // upload
            audio_path = convertFileSrc(path);
            meeting_state = 'record';
            await transcribe.transcribe_from_path(path);
        }
        meeting_state = 'transcript';
    };

    const get_transcript_text = () =>
        speech_block
            .map((segment) => `Speaker ${segment.speaker + 1}: ${segment.text}`)
            .join('\n\n');

    const copy = async () => {
        await navigator.clipboard.writeText(get_transcript_text());
    };

    const download = async () => {
        const path = await save({
            filters: [{name: 'Text', extensions: ['txt']}],
            defaultPath: 'transcript.txt',
        });
        console.log('save in', path);
        if (!path) return;

        const encoder = new TextEncoder();
        await writeFile(path, encoder.encode(get_transcript_text()));
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
                <!-- <PlayerAudio src={audio_path}/> -->
            </div>
            <div class="flex items-center gap-4">
                <button class="btn ghost" onclick={copy}><CopyIcon --size="1.2rem" />Copier</button>
                <button class="btn ghost" onclick={download}
                    ><DownloadIcon --size="1.2rem" />Télécharger</button
                >
                {#if generate.current !== undefined && generate.tabs[generate.current]?.title === 'Email' && generate.result[generate.current] && settings.mail_client}
                    <button
                        class="btn ghost"
                        onclick={() => open_mail(generate.result[generate.current])}
                    >
                        <PaperPlane --size="1.2rem" />Envoyer
                    </button>
                    {#if mail_error}
                        <p class="text-red-400 text-sm">{mail_error}</p>
                    {/if}
                {/if}
            </div>
        {/if}

        <button class="btn ghost icon ms-auto" onclick={() => (is_open = true)}>
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
        {:else if meeting_state === 'edit'}
            <div class="flex h-full justify-center">
                <div
                    class="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-bg-2"
                >
                    <div class="min-h-0 flex-1 overflow-y-auto p-6">
                        {#each generate.tabs as tab, i}
                            {#if i === generate.current}
                                {#if generate.loading}
                                    <p class="text-fg-2">{tab.title} en cours...</p>
                                {:else}
                                    {generate.result[i]}
                                {/if}
                            {/if}
                        {/each}
                    </div>
                </div>
            </div>
        {/if}
    </div>
    {#if meeting_state === 'transcript' || meeting_state === 'edit'}
        <div class="shrink-0 border-bg-2 p-4">
            <div class="flex items-center justify-center gap-4">
                <button
                    class="btn ghost {meeting_state === 'transcript' ? 'secondary' : ''}"
                    onclick={() => (meeting_state = 'transcript')}
                >
                    Transcription
                </button>
                {#each generate.opened_tabs as index}
                    <button
                        class="btn ghost {meeting_state === 'edit' && generate.current === index
                            ? 'secondary'
                            : ''}"
                        onclick={() => {
                            meeting_state = 'edit';
                            generate.open_tab(index, get_transcript_text());
                        }}
                    >
                        {generate.tabs[index].title}
                    </button>
                {/each}
                {#if generate.available_tabs.length > 0}
                    <Popover bind:is_open={show_menu} offset_y={10}>
                        {#snippet target()}
                            <button class="btn ghost" onclick={() => (show_menu = true)}
                                ><CrossIcon rotate={45} --size="1.2rem" /></button
                            >
                        {/snippet}

                        {#each generate.available_tabs as tab}
                            <button
                                class="btn ghost"
                                onclick={() => {
                                    meeting_state = 'edit';
                                    generate.open_tab(
                                        generate.tabs.indexOf(tab),
                                        get_transcript_text(),
                                    );
                                    show_menu = false;
                                }}
                            >
                                {tab.title}
                            </button>
                        {/each}
                    </Popover>
                {/if}
            </div>
        </div>
    {/if}
</div>

<Dialog {is_open} onrequestclose={() => (is_open = false)} position="center">
    <SettingsQuery onclose={() => (is_open = false)} />
</Dialog>
