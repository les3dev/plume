<script lang="ts">
    import {invoke} from "@tauri-apps/api/core";

    let name = $state("");
    let greetMsg = $state("");

    async function greet(event: Event) {
        event.preventDefault();
        // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
        greetMsg = await invoke("greet", {name});
    }
</script>

<form class="flex flex-col h-full p-4 gap-4" onsubmit={greet}>
    <h1>Hello world</h1>
    <input id="greet-input" type="text" placeholder="Enter a name..." bind:value={name} />
    <button class="btn" type="submit">Greet</button>
    <p>{greetMsg}</p>
</form>
