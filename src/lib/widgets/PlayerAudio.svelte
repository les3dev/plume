<script lang="ts">

    type Props = {
        src : string | undefined
    }

    let {src} : Props = $props()

    let audioElement = $state<HTMLAudioElement>()
    let currentTime = $state(0);
    let duration = $state(0);

    const formatTime = (time: number) => {
        const minuts = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
        return `${minuts}:${formattedSeconds}`;
    };
    const togglePlay = async () => {
        if (!audioElement) return;

        if (audioElement.paused) {
            try {
                await audioElement.play();
            } catch (err) {
                console.error('Error de lecture iOS:', err);
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

