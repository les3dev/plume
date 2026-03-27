<script lang="ts">
    import {unified} from 'unified';
    import remarkParse from 'remark-parse';
    import remarkHtml from 'remark-html';

    type Props = {
        markdown: string;
    };
    let {markdown}: Props = $props();

    let html = $derived(
        unified().use(remarkParse).use(remarkHtml).processSync(markdown).toString(),
    );
</script>

<div class="flex h-full flex-col px-6 font-mono" style:line-height="1.7">{@html html}</div>

<style>
    div {
        :global(h2) {
            font-size: 2rem;
        }
        :global(h3) {
            font-size: 1.6rem;
        }
        :global(hr) {
            color: var(--color-bg-1);
            margin-block: 1rem;
        }
    }
</style>
