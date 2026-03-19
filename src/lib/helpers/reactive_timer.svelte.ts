import {SvelteDate} from 'svelte/reactivity';
import {reactive_now} from './reactive_now.svelte';
import {Duration} from 'luxon';

/**
 * Creates a reactive timer that tracks elapsed time using Svelte's reactivity system.
 *
 * The timer derives a formatted duration string (`hh:mm:ss`) that updates automatically
 * while running. Once stopped, the displayed time is frozen at the elapsed duration.
 *
 * @returns A timer controller object with the following interface:
 *
 * ### Methods
 * - **`start()`** — Begins the timer by recording the current time as `start_time`.
 *   Calling `start()` again will reset the timer from zero.
 * - **`stop()`** — Freezes the timer by recording the current time as `end_time`.
 *   The displayed value will no longer update after this is called.
 *
 * ### Reactive Getters
 * - **`value`** — A reactive `hh:mm:ss` formatted string of the elapsed duration.
 *   Updates every second while the timer is running.
 * - **`start_time`** — The `SvelteDate` at which the timer was last started, or `undefined`
 *   if the timer has never been started.
 * - **`end_time`** — The `SvelteDate` at which the timer was stopped, or `undefined`
 *   if the timer is still running or has never been stopped.
 *
 * @example
 * ```svelte
 * <script>
 *   const timer = reactive_timer();
 * </script>
 *
 * <p>{timer.value}</p>
 * <button onclick={timer.start}>Start</button>
 * <button onclick={timer.stop}>Stop</button>
 * ```
 *
 * @example
 * ```ts
 * // Start, then stop after 5 seconds
 * const timer = reactive_timer();
 * timer.start();
 * setTimeout(() => {
 *   timer.stop();
 *   console.log(timer.value); // e.g. "00:00:05"
 * }, 5000);
 * ```
 */
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
            end_time = undefined;
        },
        stop: () => {
            end_time = new SvelteDate(now.getTime());
        },
        get start_time() {
            return start_time;
        },
        get end_time() {
            return end_time;
        },
        get value() {
            return value;
        },
    };
};
