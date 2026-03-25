import {create_i18n_context} from '@les3dev/i18n/svelte';
import {i18n} from '.';

export const {set_i18n_context, get_i18n_context} = create_i18n_context(i18n);
