<script lang="ts">
    import CrossIcon from '$lib/icons/CrossIcon.svelte';
    import {get_settings_context} from '$lib/settings/settings_context.svelte';
    import type {MailClient} from '$lib/settings/settings_context.svelte';

    type Props = {
        onclose?: () => void;
    };
    let {onclose}: Props = $props();

    const settings = get_settings_context();
    let openrouter_key = $state('');
    let deepgram_key = $state('');

    $effect(() => {
        openrouter_key = settings.openrouter_key ?? '';
        deepgram_key = settings.deepgram_key ?? '';
    });
</script>

<div class="flex min-w-xl flex-col gap-8">
    <div class="flex items-center gap-3">
        <button class="btn ghost icon cursor-pointer" onclick={onclose}><CrossIcon /></button>
        <h1 class="text-xl">Paramètres</h1>
    </div>

    <div class="flex flex-col gap-3">
        <label class="text-sm font-medium" for="openai-input">Clé OpenRouter</label>
        <input
            id="openai-input"
            type="text"
            placeholder="openaikey.."
            bind:value={openrouter_key}
        />
        <div class="flex gap-3">
            <button
                class="btn max-w-20! grow"
                onclick={() => settings.save_openrouter_key(openrouter_key)}>Sauvegarder</button
            >
            {#if settings.openrouter_key}
                <button
                    class="btn error max-w-20! grow"
                    onclick={() => {
                        settings.save_openrouter_key(undefined);
                    }}>Effacer</button
                >
            {/if}
        </div>
    </div>

    <div class="flex flex-col gap-3">
        <label class="text-sm font-medium" for="deepgram-input">Clé API Deepgram</label>
        <input
            id="deepgram-input"
            type="text"
            placeholder="deepgramkey.."
            bind:value={deepgram_key}
        />
        <div class="flex gap-3">
            <button
                class="btn max-w-20 grow"
                onclick={() => settings.save_deepgram_key(deepgram_key)}>Sauvegarder</button
            >
            {#if settings.deepgram_key}
                <button
                    class="btn error max-w-20 grow"
                    onclick={() => {
                        settings.save_deepgram_key(undefined);
                    }}>Effacer</button
                >
            {/if}
        </div>
        <div class="text-xs text-fg-1">
            Vos clés sont enregistrées localement sur votre ordinateur et ne sont jamais partagées
            avec qui que ce soit.
        </div>
    </div>
    <div class="flex flex-col gap-3">
      <label class="text-sm font-medium" for="mail">Mail par défaut</label>
      <select
          id="mail"
          class="cursor-pointer"
          value={settings.mail_client}
          onchange={(e) => settings.save_mail_client(e.currentTarget.value as MailClient)}>
          <option value="mailto">Choisir</option>
          <option value="gmail">Gmail</option>
          <option value="outlook">Outlook</option>
      </select>
  </div>
</div>
