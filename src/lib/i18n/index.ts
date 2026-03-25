import {register_translations} from '@les3dev/i18n';
import fr from './translations/fr';
import en from './translations/en';

export const i18n = register_translations({fr, en}, 'fr');
export const {translate} = i18n;

export type Locale = Parameters<typeof translate>[0];
export type Translation = typeof fr;
