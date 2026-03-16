<script lang="ts">
	import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import { get_settings_context } from "$lib/settings/settings_context.svelte";
  
    type Props = { 
        onclose?: () => void 
    }
    let { onclose }: Props = $props()

    const settings = get_settings_context()
    let openrouter_key = $state("")
    let deepgram_key = $state("")

    $effect(() => {
      console.log("effect triggered, settings.openai_key:", settings.openrouter_key)
      openrouter_key = settings.openrouter_key ?? ""
      deepgram_key = settings.deepgram_key ?? ""
    })
  </script>
  
  <div class="flex flex-col gap-8  min-w-xl">
  <div class="flex items-center gap-3">
    <button class="cursor-pointer btn ghost icon"  onclick={onclose}><CrossIcon/></button>
    <h1 class="text-xl">Clés API</h1>
  </div>

  
    <div class="flex flex-col gap-3">
      <label class="text-sm font-medium" for="openai-input">Clé OpenRouter</label>
      <input id="openai-input" type="text" placeholder="openaikey.." bind:value={openrouter_key}/>
      <div class="flex gap-3">
        <button class="btn grow max-w-20!" onclick={() => settings.save_openai_key(openrouter_key)}>Sauvegarder</button>
        {#if settings.openrouter_key}
        <button class="btn grow error max-w-20!" onclick={() => {settings.save_openai_key(undefined)}}>Effacer</button>
        {/if}
      </div>
    </div>
  
    <div class="flex flex-col gap-3">
      <label class="text-sm font-medium" for="deepgram-input">Clé API Deepgram</label>
      <input id="deepgram-input" type="text" placeholder="deepgramkey.." bind:value={deepgram_key} />
      <div class="flex gap-3">
        <button class="btn grow max-w-20" onclick={() => settings.save_deepgram_key(deepgram_key)}>Sauvegarder</button>
        {#if settings.deepgram_key}
        <button class="btn grow error max-w-20" onclick={() => {settings.save_deepgram_key(undefined)}}>Effacer</button>
        {/if}
      </div>
      <div class="text-xs text-fg-1">Vos clés sont enregistrées localement sur votre ordinateur et ne sont jamais partagées avec qui que ce soit.</div>

    </div>
  </div>