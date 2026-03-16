<script lang="ts">
    import {set_settings_context} from '$lib/settings/settings_context.svelte';
    import {set_upload_context} from '$lib/upload/upload_context.svelte';
    import '../app.css';
    import {set_meeting_context} from '../lib/meeting/meeting_context.svelte';
    import '@fontsource/source-serif-pro';
    import '@fontsource-variable/bricolage-grotesque';

    let {children} = $props();
    set_settings_context();
    set_upload_context();
    set_meeting_context();
</script>

{@render children()}
