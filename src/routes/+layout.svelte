<script lang="ts">
    import {set_settings_context} from '$lib/settings/settings_context.svelte';
    import '../app.css';
    import {set_meeting_context} from '../lib/meeting/meeting_context.svelte';
    import '@fontsource/source-serif-pro';
    import '@fontsource-variable/bricolage-grotesque';
    import {set_prompt_context} from '$lib/prompt/prompt_context.svelte';
    import {set_i18n_context} from '$lib/i18n/context.svelte';

    let {children} = $props();

    set_i18n_context(() => 'en'); // TODO: from settings
    set_settings_context();
    set_meeting_context();
    set_prompt_context();
</script>

{@render children()}
