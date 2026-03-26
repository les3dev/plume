<script lang="ts">
    import {goto} from '$app/navigation';
    import {readDir} from '@tauri-apps/plugin-fs';
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import SettingsIcon from '$lib/icons/SettingsIcon.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import {catch_error} from '$lib/helpers/catch_error';
    import {DateTime} from 'luxon';
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';

    const settings = get_settings_context();

    let search = $state('');
    let folders = $state<{path: string; title: string; date: DateTime}[]>([]);
    let error_message = $state('');

    const parse_folder_name = (name: string) => {
        const parts = name.split(' ');
        if (parts.length < 2) {
            return null;
        }
        const [date_part, time_part] = parts[0].split('_');
        const formated_date = DateTime.fromFormat(`${date_part} ${time_part}`, 'yyyy-MM-dd HHmm');
        return {
            date: formated_date,
            title: parts.slice(1).join(' '),
        };
    };

    $effect(() => {
        if (settings.save_path) {
            load_folders(settings.save_path);
        }
    });

    let filtered_folders = $derived(
        folders.filter((folder) => {
            const query = search.toLowerCase();
            return (
                folder.title.toLowerCase().includes(query) ||
                folder.date.toFormat('dd/MM/yyyy HH:mm').includes(query) ||
                folder.date.toFormat('MMMM yyyy', {locale: 'fr'}).toLowerCase().includes(query)
            );
        }),
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
        <button class="btn ghost icon" onclick={() => goto(`/meeting/Sans titre`)}
            ><CrossIcon rotate={45} /></button
        >
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
                <button class="btn ghost w-full" onclick={() => goto(`/meeting/${folder.title}`)}>
                    <span class="grow text-start">{folder.title}</span>
                    <span class="text-sm font-normal text-fg-2"
                        >{folder.date.toFormat('dd/MM/yyyy HH:mm')}</span
                    >
                    <ChevronIcon rotate={180} --size="1rem" />
                </button>
            {/each}
        {/if}
    </div>
</div>
