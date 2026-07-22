import {mkdir, readDir, watch, type UnwatchFn} from '@tauri-apps/plugin-fs';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {DateTime} from 'luxon';
import {get_settings_context} from '$lib/settings/settings_context.svelte';
import {catch_error} from '$lib/helpers/catch_error';
import {getContext, setContext} from 'svelte';
import {parse_folder_name} from '$lib/helpers/parse_folder_name';

export type MeetingFolder = {
    path: string;
    title: string;
    date: DateTime;
    folder_name: string;
};

class MeetingsContext {
    #settings = get_settings_context();
    error_message = $state('');
    folders = $state<MeetingFolder[]>([]);

    constructor() {
        $effect(() => {
            const path = this.#settings.save_path;
            if (!path) {
                this.folders = [];
                return;
            }

            this.load_folders(path);

            let cancelled = false;
            const refresh = () => this.load_folders(path);

            let unwatch: UnwatchFn | undefined;
            watch(path, refresh, {recursive: false})
                .then((stop_watching) => {
                    if (cancelled) {
                        stop_watching();
                    } else {
                        unwatch = stop_watching;
                    }
                })
                .catch((error) => console.error('failed to watch save_path', error));

            // Fs events aren't always reliable (debounce/backend quirks), so also refresh
            // whenever the window regains focus - covers renaming/deleting from Finder.
            let unlisten_focus: (() => void) | undefined;
            getCurrentWindow()
                .onFocusChanged(({payload: focused}) => {
                    if (focused) refresh();
                })
                .then((stop_listening) => {
                    if (cancelled) {
                        stop_listening();
                    } else {
                        unlisten_focus = stop_listening;
                    }
                })
                .catch((error) => console.error('failed to listen for window focus', error));

            return () => {
                cancelled = true;
                unwatch?.();
                unlisten_focus?.();
            };
        });
    }

    load_folders = async (path: string) => {
        const entries = await catch_error(() => readDir(path));
        if (entries instanceof Error) {
            this.error_message = entries.message;
            return;
        }
        this.error_message = '';
        this.folders = entries
            .filter((entry) => entry.isDirectory && parse_folder_name(entry.name) !== null)
            .map((entry) => {
                const parsed = parse_folder_name(entry.name)!;
                return {
                    date: parsed.date,
                    title: parsed.title,
                    path: `${path}/${entry.name}`,
                    folder_name: entry.name,
                };
            });
    };

    create_meeting = async (title: string) => {
        console.log('save_path:', this.#settings.save_path);

        const save_path = this.#settings.save_path;
        if (!save_path) return null;
        const date = DateTime.now().toFormat('yyyy-MM-dd_HHmm');
        const folder_name = `${date} ${title}`;
        const path = `${save_path}/${folder_name}`;

        const error = await catch_error(() => mkdir(path));
        console.log('mkdir result:', error);
        if (error instanceof Error) {
            this.error_message = error.message;
            return null;
        }

        await this.load_folders(save_path);

        return {path, title, folder_name};
    };
}

const key = Symbol();
export const set_meetings_context = () => setContext(key, new MeetingsContext());
export const get_meetings_context = () => getContext<MeetingsContext>(key);
