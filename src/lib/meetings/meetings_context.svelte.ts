import {mkdir} from '@tauri-apps/plugin-fs';
import {DateTime} from 'luxon';
import {get_settings_context} from '$lib/settings/settings_context.svelte';
import {catch_error} from '$lib/helpers/catch_error';
import {getContext, setContext} from 'svelte';

class MeetingsContext {
    #settings = get_settings_context();
    error_message = $state('');

    create_meeting = async (title: string) => {
        console.log('save_path:', this.#settings.save_path);

        if (!this.#settings.save_path) return null;
        const date = DateTime.now().toFormat('yyyy-MM-dd_HHmm');
        const folder_name = `${date} ${title}`;
        const path = `${this.#settings.save_path}/${folder_name}`;

        const error = await catch_error(() => mkdir(path));
        console.log('mkdir result:', error);
        if (error instanceof Error) {
            this.error_message = error.message;
            return null;
        }

        return {path, title, folder_name};
    };
}

const key = Symbol();
export const set_meetings_context = () => setContext(key, new MeetingsContext());
export const get_meetings_context = () => getContext<MeetingsContext>(key);
