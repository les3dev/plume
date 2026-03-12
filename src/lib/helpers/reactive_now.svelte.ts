import {SvelteDate} from 'svelte/reactivity';

/**
 * Returns a reactive date that updates at a specified interval, with an optional scale factor to speed up or slow down time.
 */
export const reactive_now = ({scale = 1, interval = 1000} = {}) => {
    const initial_date = new SvelteDate();
    const current_date = new SvelteDate();

    $effect(() => {
        const handle = setInterval(() => {
            current_date.setTime(
                initial_date.getTime() + (Date.now() - initial_date.getTime()) * scale,
            );
        }, interval);
        return () => clearInterval(handle);
    });

    return current_date;
};
