<script lang="ts">
    import SettingsQuery from "$lib/scripts/SettingsQuery.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import { get_settings_context } from "$lib/settings/settings_context.svelte";
    import SettingsIcon from "$lib/icons/SettingsIcon.svelte";
	import Recorder from "$lib/recorder/Recorder.svelte";
    

    const settings = get_settings_context()

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
            <button class="text-center max-w-150 border border-dotted rounded-xl p-4 cursor-pointer">
                <div>Upload your meeting record</div>
                <div class="text-sm ">Accepted format: .mp3</div>
            </button>
        {/if}
        <Recorder/>
    </div>
</div>

<Dialog {is_open} onrequestclose={() => is_open=false} position="center">
    <SettingsQuery onclose={() => is_open = false}/>
</Dialog>