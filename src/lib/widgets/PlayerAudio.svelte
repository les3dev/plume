<script lang="ts">

    type Props = {
        src : string | undefined
    }

    let {src} : Props = $props()

    let audioElement = $state<HTMLAudioElement>()
    let currentTime = $state(0);
    let duration = $state(0);

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const secondes = Math.floor(time % 60);
        const formattedSeconds = secondes < 10 ? `0${secondes}` : secondes;
        return `${minutes}:${formattedSeconds}`;
    };
    const togglePlay = async () => {
        if (!audioElement) return;

        if (audioElement.paused) {
            try {
                await audioElement.play();
            } catch (err) {
                console.error('Erreur de lecture iOS:', err);
            }
        } else {
            audioElement.pause();
        }
    };

    let progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);

    const handleSeek = (e: Event) => {
        const target = e.target as HTMLInputElement;
        currentTime = (Number(target.value) / 100) * duration;
    };
</script>

