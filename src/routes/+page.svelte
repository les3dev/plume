<script lang="ts">
    import {goto} from '$app/navigation';
    import {readDir} from '@tauri-apps/plugin-fs';
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import SettingsIcon from '$lib/icons/SettingsIcon.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import {catch_error} from '$lib/helpers/catch_error';

    let search = $state('');

    const settings = get_settings_context();

    let folders = $state<{name: string; path: string}[]>([]);

    $effect(() => {
        if (settings.save_path) {
            load_folders(settings.save_path);
        }
    });

    let error_message = $state('');
    async function load_folders(path: string) {
        const entries = await catch_error(() => readDir(path));
        if (entries instanceof Error) {
            error_message = entries.message;
            return;
        }
        folders = entries
            .filter((entry) => entry.isDirectory)
            .map((entry) => ({
                name: entry.name,
                path: `${path}/${entry.name}`,
            }));
    }
</script>

<div class="flex h-screen flex-col">
    <header class="flex items-center gap-2 p-4 pb-2">
        <input
            type="text"
            bind:value={search}
            placeholder="Rechercher…"
            class="grow border-none! bg-transparent!"
        />
        <button class="btn ghost icon" onclick={() => goto(`/meeting/Sans titre`)}
            ><CrossIcon rotate={45} /></button
        >
        <button class="btn ghost icon" onclick={() => goto('/settings')}>
            <SettingsIcon --size="1.2rem" />
        </button>
    </header>
    <div class="flex flex-col gap-4 px-4">
        {#if folders.length === 0}
            <p>No folders found.</p>
        {:else}
            {#each folders as folder}
                <button class="btn ghost" onclick={() => goto(`/meeting/${folder.name}`)}>
                    {folder.name}
                </button>
            {/each}
        {/if}
    </div>
</div>


