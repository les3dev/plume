<script lang="ts">
    import {set_settings_context} from '$lib/settings/settings_context.svelte';
    import '../app.css';
    import {set_meeting_context} from '../lib/meeting/meeting_context.svelte';
    import '@fontsource/source-serif-pro';
    import '@fontsource-variable/bricolage-grotesque';
    import '@fontsource/space-mono';
    import {set_prompt_context} from '$lib/prompt/prompt_context.svelte';
    import {set_i18n_context} from '$lib/i18n/context.svelte';
    import {set_meetings_context} from '$lib/meetings/meetings_context.svelte';
    import {WebviewWindow} from '@tauri-apps/api/webviewWindow';

    let {children} = $props();

    set_settings_context();
    set_meetings_context();
    set_i18n_context(() => 'en');
    set_meeting_context();
    set_prompt_context();

    const create_new_window = async () => {
        const label = `plume_${Date.now()}`;
        new WebviewWindow(label, {
            url: '/',
            title: 'Plume',
            width: 600,
            height: 800,
        });
    };

    $effect(() => {
        const handle_keydown = async (e: KeyboardEvent) => {
            console.log('key', e.key, 'meta', e.metaKey, 'ctrl:', e.ctrlKey);
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                await create_new_window();
            }
        };

        window.addEventListener('keydown', handle_keydown);
        return () => window.removeEventListener('keydown', handle_keydown);
    });
</script>

{@render children()}
