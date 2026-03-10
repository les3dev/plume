<script lang="ts">
  import { set_settings_context } from "$lib/settings/settings_context.svelte";
    import "../app.css";
    import {set_meeting_context} from "../lib/meeting/meeting_context.svelte";

    let {children} = $props();

    set_meeting_context();

    set_settings_context()
</script>

{@render children()}
