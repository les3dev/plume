<script>
    export let rotate = 0; // Default rotation value
</script>

<svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    style="--rotate: {rotate}deg;"
>
    <path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>
</svg>

<style>
    svg {
        width: var(--size);
        height: var(--size);
        transform: rotate(var(--rotate, 0deg));

    }
</style>
