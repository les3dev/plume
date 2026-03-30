<script lang="ts">
    import {goto} from '$app/navigation';
    import {readDir} from '@tauri-apps/plugin-fs';
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import SettingsIcon from '$lib/icons/SettingsIcon.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import {catch_error} from '$lib/helpers/catch_error';
    import {DateTime} from 'luxon';
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';
    import {get_meetings_context} from '$lib/meetings/meetings_context.svelte';
    import Dialog from '$lib/widgets/Dialog.svelte';
    import PromptDialog from '$lib/prompt/PromptDialog.svelte';
    import SparklesIcon from '$lib/icons/SparklesIcon.svelte';
    import {parse_folder_name} from '$lib/helpers/parse_folder_name';

    const settings = get_settings_context();
    const meetings = get_meetings_context();

    let search = $state('');
    let folders = $state<{path: string; title: string; date: DateTime; folder_name: string}[]>([]);
    let error_message = $state('');
    let is_dialog_open = $state(false);
    let title_meeting = $state('');
    let is_prompts_open = $state(false);

    $effect(() => {
        if (settings.save_path) {
            load_folders(settings.save_path);
        }
    });

    let filtered_folders = $derived(
        folders
            .filter((folder) => {
                if (!folder.date.isValid) {
                    return false;
                }
                const query = search.toLowerCase();
                return (
                    folder.title.toLowerCase().includes(query) ||
                    folder.date.toFormat('dd/MM/yyyy HH:mm').includes(query) ||
                    folder.date.toFormat('MMMM yyyy', {locale: 'fr'}).toLowerCase().includes(query)
                );
            })
            .sort((first, last) => last.date.toMillis() - first.date.toMillis()),
    );

    async function load_folders(path: string) {
        console.log('save_path', path);
        const entries = await catch_error(() => readDir(path));
        console.log('entries', entries);
        if (entries instanceof Error) {
            error_message = entries.message;
            return;
        }
        folders = entries
            .filter((entry) => entry.isDirectory && parse_folder_name(entry.name) !== null)
            .map((entry) => {
                const parsed = parse_folder_name(entry.name)!;
                return {
                    date: parsed.date,
                    title: parsed.title,
                    path: `${path}/${entry.name}`,
                    folder_name: entry.name,
                };
            });
    }
</script>

<div class="flex h-screen flex-col">
    <header class="flex items-center gap-2 p-4 pb-2">
        <input
            type="text"
            bind:value={search}
            placeholder="Rechercher…"
            class="grow border-none! bg-transparent!"
            autocomplete="off"
            autocorrect="off"
        />
        <button class="btn ghost icon" onclick={() => (is_dialog_open = true)}
            ><CrossIcon rotate={45} /></button
        >
        <button
            class="btn ghost icon"
            // disabled={meeting.is_generating}
            onclick={() => (is_prompts_open = true)}
        >
            <SparklesIcon --size="1.2rem" />
        </button>
        <button class="btn ghost icon" onclick={() => goto('/settings')}>
            <SettingsIcon --size="1.2rem" />
        </button>
    </header>
    <div class="flex flex-col gap-4 px-4">
        {#if error_message}
            <p class="text-error">{error_message}</p>
        {:else if filtered_folders.length === 0}
            <p>No folders found.</p>
        {:else}
            {#each filtered_folders as folder}
                <button
                    class="btn ghost w-full"
                    onclick={() => goto(`/meeting/${encodeURIComponent(folder.folder_name)}`)}
                >
                    <span class="grow text-start font-serif text-lg font-semibold"
                        >{folder.title}</span
                    >
                    <span class="text-sm font-normal text-fg-2"
                        >{folder.date.toFormat('dd/MM/yyyy HH:mm')}</span
                    >
                    <ChevronIcon rotate={180} --size="1rem" />
                </button>
            {/each}
        {/if}
    </div>
</div>

<Dialog
    is_open={is_dialog_open}
    onrequestclose={() => (is_dialog_open = false)}
    position="center"
    style="--width: 100%; --max-width: 90vw;"
>
    <div>
        <h1 class="mb-4 text-lg">Nouvelle réunion</h1>
        <div class="flex flex-col gap-2">
            <label for="title text-sm!" class="font-normal">Titre de la réunion</label>
            <input
                type="text"
                id="title"
                bind:value={title_meeting}
                placeholder="ex: Entretien RH.."
                class="w-full"
            />
        </div>
        <div class="mt-4 flex justify-between">
            <button class="btn ghost" onclick={() => (is_dialog_open = false)}> Annuler </button>
            <button
                class="btn"
                onclick={async () => {
                    const result = await meetings.create_meeting(title_meeting);
                    if (result) {
                        is_dialog_open = false;
                        title_meeting = '';
                        goto(`/meeting/${encodeURIComponent(result.folder_name)}`);
                    }
                }}
            >
                Créer
            </button>
        </div>
    </div>
</Dialog>

<Dialog
    is_open={is_prompts_open}
    onrequestclose={() => (is_prompts_open = false)}
    position="center"
    style="--width: 100%; --max-width: 90vw;"
>
    <PromptDialog used_prompts={[]} can_generate={false} ongenerate={() => {}} />
</Dialog>
