<script lang="ts">
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import SparklesIcon from '$lib/icons/SparklesIcon.svelte';
    import PenIcon from '$lib/icons/PenIcon.svelte';
    import {get_prompt_context, type Prompt} from './prompt_context.svelte';
    type Props = {
        ongenerate: (prompt: Prompt) => void;
        can_generate: boolean;
        used_prompts: {id: string; ai_generation: string}[];
    };
    let {can_generate, used_prompts, ongenerate}: Props = $props();

    const prompt_context = get_prompt_context();

    let editing_prompt: Prompt | null = $state(null);
    let creating = $state(false);
    let new_prompt = $state({title: '', prompt: ''});
    let search = $state('');

    let filtered_prompts = $derived(
        prompt_context.prompts.filter(
            (p) =>
                !used_prompts.some((t) => t.id === p.id) &&
                (search === '' || p.title.toLowerCase().includes(search.toLowerCase())),
        ),
    );
</script>

<div>
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
                class="h-auto! w-full font-serif!"
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
        <div class="flex items-center gap-2 pb-4">
            <input
                type="search"
                name="search-prompt"
                id="search-prompt"
                autocomplete="off"
                class="min-w-0 flex-1 text-sm placeholder:text-fg-2"
                bind:value={search}
                placeholder="Search prompts..."
            />
            <button class="btn icon shrink-0" onclick={() => (creating = true)}>
                <CrossIcon rotate={45} --size="1rem" />
            </button>
        </div>
        <div
            class="grid max-h-[70vh] w-full grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3"
        >
            {#each filtered_prompts as prompt (prompt.id)}
                <div class="flex flex-col gap-3 rounded-xl border border-bg-2 p-4">
                    <div class="flex items-start justify-between gap-2">
                        <h2 class="text-base leading-tight font-semibold">{prompt.title}</h2>
                        <button
                            class="btn ghost icon shrink-0"
                            onclick={() => (editing_prompt = {...prompt})}
                        >
                            <PenIcon --size="1rem" />
                        </button>
                    </div>
                    <p class="line-clamp-3 grow text-sm text-fg-2">
                        {prompt.prompt}
                    </p>
                    {#if can_generate}
                        <button class="btn w-fit" onclick={() => ongenerate(prompt)}>
                            <SparklesIcon --size="1rem" />
                            Générer
                        </button>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>
