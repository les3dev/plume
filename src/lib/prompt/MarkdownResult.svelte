<script lang="ts">
    import {unified} from 'unified';
    import remarkParse from 'remark-parse';
    import remarkBreaks from 'remark-breaks';
    import remarkHtml from 'remark-html';

    type Props = {
        markdown: string;
    };
    let {markdown}: Props = $props();
    let html = $derived(
        (() => {
            // console.log('markdown reçu:', JSON.stringify(markdown.slice(0, 200)));
            return unified()
                .use(remarkParse)
                .use(remarkBreaks)
                .use(remarkHtml)
                .processSync(markdown.replace(/\\n/g, '\n')) // espacement
                .toString();
        })(),
    );
</script>

<div class="flex h-full flex-col px-6 font-serif" style:line-height="1.7">{@html html}</div>

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
