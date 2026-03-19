import {SvelteDate} from 'svelte/reactivity';
import {reactive_now} from './reactive_now.svelte';
import {Duration} from 'luxon';

export const reactive_timer = () => {
    let start_time = $state<SvelteDate>();
    let end_time = $state<SvelteDate>();
    const now = reactive_now({scale: 1, interval: 1000});
    const ms = $derived.by(() => {
        if (end_time !== undefined && start_time !== undefined) {
            return Math.max(0, end_time.getTime() - start_time.getTime());
        }
        if (start_time === undefined) {
            return 0;
        }
        return Math.max(0, now.getTime() - start_time.getTime());
    });
    const value = $derived(
        Duration.fromMillis(ms).shiftTo('hours', 'minutes', 'seconds').toFormat('hh:mm:ss'),
    );
    return {
        start: () => {
            start_time = new SvelteDate();
        },
        stop: () => {
            end_time = now;
        },
        get value() {
            return value;
        },
    };
};
