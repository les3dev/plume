<script lang="ts">
    import {goto} from '$app/navigation';
    import {page} from '$app/state';
    import {get_meeting_context} from '$lib/meeting/meeting_context.svelte';
    import {get_prompt_context} from '$lib/prompt/prompt_context.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import {writeTextFile} from '@tauri-apps/plugin-fs';
    import {onMount} from 'svelte';
    import {Editor} from '@tiptap/core';
    import StarterKit from '@tiptap/starter-kit';
    import {Markdown} from 'tiptap-markdown';
    import ChevronIcon from '$lib/icons/ChevronIcon.svelte';

    const meeting_context = get_meeting_context();
    const prompts_context = get_prompt_context();
    const settings_context = get_settings_context();

    const folder_name = decodeURIComponent(page.params.name ?? '');
    const folder_path = `${settings_context.save_path}/${folder_name}`;
    const prompt_id = page.url.searchParams.get('prompt') ?? '';

    const prompt_title = $derived(
        prompts_context.prompts.find((prompt) => prompt.id === prompt_id)?.title ?? '',
    );

    const content = $state({
        value: meeting_context.ai_tabs.find((tab) => tab.id === prompt_id)?.ai_generation ?? '',
    });

    let element = $state<HTMLDivElement>();
    let editor: Editor;

    onMount(() => {
        editor = new Editor({
            element,
            extensions: [StarterKit, Markdown],
            content: content.value,
            onUpdate: ({editor}) => {
                content.value = (editor.storage as any).markdown.getMarkdown();
            },
        });
        return () => editor.destroy();
    });

    const save = async () => {
        await writeTextFile(`${folder_path}/${prompt_title}.txt`, content.value);
        const index = meeting_context.ai_tabs.findIndex((t) => t.id === prompt_id);
        if (index !== -1) {
            meeting_context.ai_tabs[index].ai_generation = content.value;
        }
        await goto(`/meeting/${encodeURIComponent(folder_name)}?prompt=${prompt_id}`);
    };
</script>

<div class="flex h-screen flex-col">
    <header class="flex items-center gap-2 p-4">
        <button
            class="btn ghost"
            onclick={() => goto(`/meeting/${encodeURIComponent(folder_name)}?prompt=${prompt_id}`)}
        >
            <ChevronIcon />{prompt_title}
        </button>
        <button class="btn ms-auto" onclick={save}>Sauvegarder</button>
    </header>

    <div bind:this={element} class="flex-1 overflow-auto p-4 font-serif focus:outline-none"></div>
</div>

<style>
    :global(.tiptap) {
        outline: none;
        height: 100%;
    }
</style>
