<script lang="ts">
    import SettingsQuery from "$lib/scripts/SettingsQuery.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import { get_settings_context } from "$lib/settings/settings_context.svelte";
    import SettingsIcon from "$lib/icons/SettingsIcon.svelte";
	import Recorder from "$lib/recorder/Recorder.svelte";
	import Upload from "$lib/upload/Upload.svelte";
	import Transcript from "$lib/transcript/Transcript.svelte";
	import { get_upload_context } from "$lib/upload/upload_context.svelte";
    

    const settings = get_settings_context()
    const transcript = get_upload_context()

    let is_open = $state(false)
</script>
<div class="flex flex-col h-full">
    <div class="flex justify-end p-4">
        <button class="cursor-pointer" onclick={() => is_open = true}><SettingsIcon/></button>
    </div>
    <div class="flex items-center h-screen justify-center ">
        {#if !settings.deepgram_key || !settings.openai_key}
            <div class="text-center max-w-150 border border-dotted rounded-xl p-4">
                Your open ai and deepgram api keys are not setup yet. Use the settings button to register your api keys locally.
            </div>
        {:else} 
            <Recorder/>
            <Upload />
            <Transcript/>
        {/if}
    </div>
</div>

<Dialog {is_open} onrequestclose={() => is_open=false} position="center">
    <SettingsQuery onclose={() => is_open = false}/>
</Dialog>