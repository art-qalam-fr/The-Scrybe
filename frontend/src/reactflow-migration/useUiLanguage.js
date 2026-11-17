import { useEffect, useState } from 'react';
import { apiClient, eventsClient } from './clients';

// Langue UI pilotée par le backend (config.language), comme le legacy.
// setLanguage fait un POST /settings/language : le statut SSE rebroadcaste
// ensuite la langue à tous les composants abonnés.
export function useUiLanguage(fallback = 'fr') {
    const [language, setLanguageState] = useState(fallback);

    useEffect(() => {
        const unsubscribe = eventsClient.start({
            onStatus: (payload) => {
                if (payload.language) setLanguageState(payload.language);
            },
            pollStatus: () => apiClient.getStatus(),
        });
        apiClient.getStatus()
            .then((res) => { if (res?.language) setLanguageState(res.language); })
            .catch(() => {});
        return unsubscribe;
    }, []);

    const setLanguage = (code) => {
        setLanguageState(code);
        apiClient.post('/settings/language', { language: code }).catch(() => {});
    };

    return [language, setLanguage];
}
