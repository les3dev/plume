<script lang="ts">
    import {set_settings_context} from '$lib/settings/settings_context.svelte';
    import {set_transcribe_context} from '$lib/transcribe/transcribe_context.svelte';
    import '../app.css';
    import {set_meeting_context} from '../lib/meeting/meeting_context.svelte';
    import '@fontsource/source-serif-pro';
    import '@fontsource-variable/bricolage-grotesque';
    import {set_generate_context} from '$lib/generate/generate_context.svelte';

    let {children} = $props();
    set_settings_context();
    set_transcribe_context();
    set_meeting_context();
    set_generate_context();
</script>

{@render children()}
