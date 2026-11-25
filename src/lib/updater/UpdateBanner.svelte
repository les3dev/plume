<script lang="ts">
    import {check, type Update} from '@tauri-apps/plugin-updater';
    import {relaunch} from '@tauri-apps/plugin-process';
    import {getCurrentWebviewWindow} from '@tauri-apps/api/webviewWindow';

    const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

    let update = $state<Update | null>(null);
    let status = $state<'idle' | 'downloading' | 'error'>('idle');
    let progress = $state(0);
    let dismissed = $state(false);

    const check_for_update = async () => {
        if (update) return;
        try {
            update = await check();
        } catch (error) {
            // Offline, endpoint unreachable, invalid latest.json... never block the app for it.
            console.warn('[updater] check failed', error);
        }
    };

    // Only the main window checks, otherwise every extra window (Cmd+N) would show its own banner.
    // Skipped in dev: the dev build isn't a signed bundle and can't be replaced in place.
    $effect(() => {
        if (import.meta.env.DEV || getCurrentWebviewWindow().label !== 'main') return;
        check_for_update();
        const interval = setInterval(check_for_update, CHECK_INTERVAL_MS);
        return () => clearInterval(interval);
    });

    const install = async () => {
        if (!update) return;
        status = 'downloading';
        progress = 0;
        let downloaded = 0;
        let total = 0;
        try {
            await update.downloadAndInstall((event) => {
                if (event.event === 'Started') total = event.data.contentLength ?? 0;
                if (event.event === 'Progress') {
                    downloaded += event.data.chunkLength;
                    if (total) progress = Math.round((downloaded / total) * 100);
                }
            });
            await relaunch();
        } catch (error) {
            console.error('[updater] install failed', error);
            status = 'error';
        }
    };
</script>

{#if update && !dismissed}
    <div class="flex items-center gap-3 bg-bg-1 px-4 py-2 text-sm text-fg">
        {#if status === 'downloading'}
            <span class="grow">Téléchargement de Plume {update.version}… {progress}%</span>
        {:else if status === 'error'}
            <span class="grow text-error">La mise à jour a échoué.</span>
            <button class="btn ghost" onclick={install}>Réessayer</button>
        {:else}
            <span class="grow">
                Plume {update.version} est disponible. L'app redémarrera : terminez d'abord tout enregistrement
                en cours.
            </span>
            <button class="btn ghost" onclick={() => (dismissed = true)}>Plus tard</button>
            <button class="btn" onclick={install}>Mettre à jour</button>
        {/if}
    </div>
{/if}
