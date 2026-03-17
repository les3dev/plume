import {setContext, getContext} from 'svelte';

class MeetingContext {
    transcript_file = $state('');

    start_transcript = () => {
        console.log('Transcript');
    };
}

const key = Symbol();
export const set_meeting_context = () => setContext(key, new MeetingContext());
export const get_meeting_context = () => getContext<MeetingContext>(key);
