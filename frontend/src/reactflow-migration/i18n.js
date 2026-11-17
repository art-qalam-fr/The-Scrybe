import { translations } from '../translations';

export const supportedLocales = Object.freeze(Object.keys(translations));
export const defaultLocale = 'fr';

export function createTranslator(locale = defaultLocale) {
    const activeLocale = translations[locale] ? locale : defaultLocale;
    return (key) => translations[activeLocale]?.[key]
        || translations.en?.[key]
        || key;
}

export function getLocaleDictionary(locale = defaultLocale) {
    return translations[locale] || translations[defaultLocale];
}

export function translateStatus(raw, t) {
    if (raw === 'Prêt') return t('ready_to_dictate');
    if (raw?.includes('Enregistrement (PTT)')) return t('recording_ptt');
    if (raw?.includes('Enregistrement')) return t('recording');
    if (raw?.includes('Transcription')) return t('transcribing');
    return raw;
}
