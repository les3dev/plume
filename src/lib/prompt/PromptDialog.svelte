<script lang="ts">
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import PenIcon from '$lib/icons/PenIcon.svelte';
    import SparklesIcon from '$lib/icons/SparklesIcon.svelte';
    import {get_prompt_context, type Prompt} from './prompt_context.svelte';
    type Props = {
        has_audio: boolean;
        onselect: (prompt: Prompt) => void;
        tabs: {id: string; result: string}[];
    };

    let {has_audio, tabs, onselect}: Props = $props();
    const prompt_context = get_prompt_context();
    let editing_prompt: Prompt | null = $state(null);
    let creating = $state(false);
    let new_prompt = $state({title: '', prompt: ''});
    let search = $state('');
    let filtered_prompts = $derived(
        prompt_context.prompts.filter(
            (p) =>
                !tabs.some((t) => t.id === p.id) &&
                (search === '' || p.title.toLowerCase().includes(search.toLowerCase())),
        ),
    );
</script>

<div class="w-lg">
    {#if creating}
        <div class="flex items-center gap-3 pb-4">
            <button class="btn ghost icon" onclick={() => (creating = false)}>
                <ChevronIcon --size="1.2rem" />
            </button>
            <h1>Ajouter un prompt</h1>
        </div>

        <div class="flex flex-col gap-2">
            <label for="new-title">Titre</label>
            <input type="text" id="new-title" bind:value={new_prompt.title} class="w-full" />
        </div>

        <div class="flex flex-col gap-2 pt-4">
            <label for="new-prompt">Prompt</label>
            <textarea
                id="new-prompt"
                bind:value={new_prompt.prompt}
                class="h-auto! w-full"
                rows="15"
            ></textarea>
        </div>

        <button
            class="btn mt-4 w-fit"
            onclick={() => {
                prompt_context.add_prompt(new_prompt);
                new_prompt = {title: '', prompt: ''};
                creating = false;
            }}
        >
            Créer
        </button>
    {:else if editing_prompt !== null}
        <div class="flex items-center gap-3 pb-4">
            <button class="btn ghost icon" onclick={() => (editing_prompt = null)}>
                <ChevronIcon --size="1.2rem" />
            </button>
            <h1>Editer le prompt</h1>
        </div>

        <div class="flex flex-col gap-2">
            <label for="title">Titre</label>
            <input type="text" id="title" bind:value={editing_prompt.title} class="w-full" />
        </div>

        <div class="flex flex-col gap-2 pt-4">
            <label for="prompt">Prompt</label>
            <textarea
                id="prompt"
                bind:value={editing_prompt.prompt}
                class="h-auto! w-full p-2 font-mono! text-sm!"
                rows="15"
            ></textarea>
        </div>

        <div class="flex gap-3 pt-4">
            <button
                class="btn"
                onclick={() => {
                    prompt_context.edit_prompt(
                        editing_prompt!.id,
                        editing_prompt!.title,
                        editing_prompt!.prompt,
                    );
                    editing_prompt = null;
                }}
            >
                Sauvegarder
            </button>
            <button
                class="btn error"
                onclick={() => {
                    prompt_context.delete_prompt(editing_prompt!.id);
                    editing_prompt = null;
                }}
            >
                Supprimer
            </button>
        </div>
    {:else}
        <div class="ms-4 flex items-center gap-2">
            <input
                type="search"
                name="search-prompt"
                id="search-prompt"
                autocomplete="off"
                class="min-w-0 flex-1 text-sm placeholder:text-fg-2"
                bind:value={search}
                placeholder="Rechercher un prompt.."
            />
            <button class="btn icon shrink-0" onclick={() => (creating = true)}>
                <CrossIcon rotate={45} --size="1rem" />
            </button>
        </div>
        <div class="flex h-96 w-full flex-col gap-2 overflow-y-auto pt-4">
            {#each filtered_prompts as prompt (prompt.id)}
                <div class="flex w-full items-center gap-4">
                    <button
                        class="btn ghost grow text-start!"
                        style:height="unset"
                        onclick={() => (editing_prompt = {...prompt})}
                    >
                        <div class="flex w-full min-w-0 flex-col p-2">
                            <h1 class="truncate font-medium!">{prompt.title}</h1>
                            <p class="w-full truncate font-normal! text-fg-2">
                                {prompt.prompt.slice(0, 60)}
                                {#if prompt.prompt.length > 60}…{/if}
                            </p>
                        </div>
                    </button>
                    {#if has_audio}
                        <button class="btn icon shrink-0" onclick={() => onselect(prompt)}>
                            <SparklesIcon --size="1rem" />
                        </button>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>
