<script lang="ts">
    import "../app.css";
    import {set_meeting_context} from "../lib/meeting/meeting_context.svelte";

    let {children} = $props();

    set_meeting_context();
</script>

{@render children()}
