<script lang="ts">
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import PenIcon from '$lib/icons/PenIcon.svelte';
    import {get_prompt_context, type Prompt} from './prompt_context.svelte';
    type Props = {
        onselect: (prompt: Prompt) => void;
        tabs: {id: string; result: string}[];
    };

    let {tabs, onselect}: Props = $props();
    const prompt_context = get_prompt_context();
    let editing_prompt: Prompt | null = $state(null);
    let creating = $state(false);
    let new_prompt = $state({title: '', prompt: ''});
</script>

{#if creating}
    <div class="flex w-130 max-w-full flex-col gap-6">
        <div class="flex items-center gap-3">
            <button class="btn ghost" onclick={() => (creating = false)}>
                <ChevronIcon --size="1.2rem" />
            </button>
            <h1>Ajouter un prompt</h1>
        </div>

        <div class="flex flex-col gap-2">
            <label for="new-title">Titre</label>
            <input type="text" id="new-title" bind:value={new_prompt.title} class="w-full" />
        </div>

        <div class="flex flex-col gap-2">
            <label for="new-prompt">Prompt</label>
            <textarea
                id="new-prompt"
                bind:value={new_prompt.prompt}
                class="h-auto! w-full"
                rows="15"
            ></textarea>
        </div>

        <button
            class="btn w-fit"
            onclick={() => {
                prompt_context.add_prompt(new_prompt);
                new_prompt = {title: '', prompt: ''};
                creating = false;
            }}
        >
            Sauvegarder
        </button>
    </div>
{:else if editing_prompt !== null}
    <div class="flex w-130 max-w-full flex-col gap-6">
        <div class="flex items-center gap-3">
            <button class="btn ghost" onclick={() => (editing_prompt = null)}>
                <ChevronIcon --size="1.2rem" />
            </button>
            <h1>Editer le prompt</h1>
        </div>

        <div class="flex flex-col gap-2">
            <label for="title">Titre</label>
            <input type="text" id="title" bind:value={editing_prompt.title} class="w-full" />
        </div>

        <div class="flex flex-col gap-2">
            <label for="prompt">Prompt</label>
            <textarea
                id="prompt"
                bind:value={editing_prompt.prompt}
                class="h-auto! w-full"
                rows="15"
            ></textarea>
        </div>

        <div class="flex gap-3">
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
    </div>
{:else}
    <div class="flex w-130 max-w-full flex-col gap-6">
        <div class="flex items-center gap-2">
            <input
                type="search"
                name=""
                id=""
                class="min-w-0 flex-1 text-sm placeholder:text-fg-2"
                placeholder="rechercher un prompt.."
            />
            <button class="btn shrink-0" onclick={() => (creating = true)}>
                <CrossIcon rotate={45} --size="1rem" />
            </button>
        </div>
        <div class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
            {#each prompt_context.prompts.filter((p) => !tabs.some((t) => t.id === p.id)) as prompt (prompt.id)}
                <div class="flex items-center gap-2 py-5 hover:bg-bg-1 rounded-xl">
                    <button
                        class="btn ghost min-w-0 flex-1 justify-between px-5! py-4!"
                        onclick={() => onselect(prompt)}
                    >
                        <div class="min-w-0 flex-1 text-start">
                            <h1 class="truncate font-medium!">{prompt.title}</h1>
                            <p class="truncate font-light! text-fg-2">{prompt.prompt}</p>
                        </div>
                    </button>
                    <button
                        class="btn ghost shrink-0"
                        onclick={() => (editing_prompt = {...prompt})}
                    >
                        <PenIcon --size="1rem" />
                    </button>
                </div>
            {/each}
        </div>
    </div>
{/if}
