<script lang="ts">
    import { get_upload_context } from "$lib/upload/upload_context.svelte"
    const upload = get_upload_context()
</script>

<div>{upload.transcript}</div>
