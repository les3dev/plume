<script lang="ts">
	import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import { get_settings_context } from "$lib/settings/settings_context.svelte";
  
    type Props = { 
        onclose?: () => void 
    }
    let { onclose }: Props = $props()

    const settings = get_settings_context()
  
    let openai_key = $state(settings.openai_key)
    let deepgram_key = $state(settings.deepgram_key)
  </script>
  
  <div class="flex flex-col gap-8  min-w-xl">
  <div class="flex items-center gap-3">
    <button class="cursor-pointer btn ghost icon"  onclick={onclose}><CrossIcon/></button>
    <h1 class="text-xl">Api Keys</h1>
  </div>

  
    <div class="flex flex-col gap-3">
      <label class="text-sm font-medium" for="openai-input">OpenAI API Key</label>
      <input id="openai-input" type="text" placeholder="openaikey.." bind:value={openai_key}/>
      <div class="flex gap-3">
        <button class="btn grow max-w-20!" onclick={() => settings.save_openai_key(openai_key)}>Save</button>
        {#if settings.openai_key}
        <button class="btn grow error max-w-20!" onclick={() => {settings.save_openai_key(undefined); openai_key = undefined}}>Remove</button>
        {/if}
      </div>
    </div>
  
    <div class="flex flex-col gap-3">
      <label class="text-sm font-medium" for="deepgram-input">Deepgram API Key</label>
      <input id="deepgram-input" type="text" placeholder="deepgramkey.." bind:value={deepgram_key} />
      <div class="flex gap-3">
        <button class="btn grow max-w-20!" onclick={() => settings.save_deepgram_key(deepgram_key)}>Save</button>
        {#if settings.deepgram_key}
        <button class="btn grow error max-w-20!" onclick={() => {settings.save_deepgram_key(undefined); deepgram_key = undefined}}>Remove</button>
        {/if}
      </div>
      <div class="text-xs text-fg-1">Your keys are saved locally on your computer and never shared with anyone</div>

    </div>
  </div>