<script lang="ts">
    import {get_generate_context, type Prompt} from '$lib/generate/generate_context.svelte';
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import PenIcon from '$lib/icons/PenIcon.svelte';

    type Props = {
        onselect: (id: string) => void;
    };

    let {onselect}: Props = $props();
    const generate = get_generate_context();
    let editingPrompt: Prompt | null = $state(null);
</script>

{#if editingPrompt === null}
    <div class="flex min-w-lg flex-col gap-6">
        <div class="flex items-center">
            <input
                type="search"
                name=""
                id=""
                class="flex-1 text-sm placeholder:text-fg-2"
                placeholder="rechercher un prompt.."
            />
            <button class="btn">
                <CrossIcon rotate={45} --size="1rem" />
            </button>
        </div>
        {#each generate.prompts.filter((prompt) => !(prompt.id in generate.result)) as prompt (prompt.id)}
            <div class="flex items-center">
                <button
                    class="btn ghost min-w-0 flex-1 justify-between px-5! py-4!"
                    onclick={() => {
                        generate.generate(prompt);
                        onselect(prompt.id);
                    }}
                >
                    <div class="min-w-0 flex-1 text-start">
                        <h1 class="font-medium!">{prompt.title}</h1>
                        <p class="font-light! text-fg-2">{prompt.prompt}</p>
                    </div>
                </button>
                <button class="btn ghost" onclick={() => (editingPrompt = {...prompt})}>
                    <PenIcon --size="1rem" />
                </button>
            </div>
        {/each}
    </div>
{:else}
    <div class="flex min-w-lg flex-col gap-6">
        <div class="flex items-center gap-3">
            <button class="btn ghost" onclick={() => (editingPrompt = null)}>
                <ChevronIcon --size="1.2rem" />
            </button>
            <h1>Editer le prompt</h1>
        </div>

        <div class="flex flex-col gap-4">
            <label for="title">Titre</label>
            <input type="text" id="title" bind:value={editingPrompt.title} />
        </div>

        <div class="flex flex-col gap-2">
            <label for="prompt">Prompt</label>
            <textarea id="prompt" bind:value={editingPrompt.prompt}></textarea>
        </div>

        <div class="flex gap-3">
            <button
                class="btn"
                onclick={() => {
                    generate.edit_prompt(
                        editingPrompt!.id,
                        editingPrompt!.title,
                        editingPrompt!.prompt,
                    );
                    editingPrompt = null;
                }}
            >
                Sauvegarder
            </button>
            <button
                class="btn error"
                onclick={() => {
                    generate.delete_prompt(editingPrompt!.id);
                    editingPrompt = null;
                }}
            >
                Supprimer
            </button>
        </div>
    </div>
{/if}
