// Contrats frontend portables pour la future UI React.
// Le backend Flask reste la source de vérité pendant les Lots 1 et 2.

export const DEFAULT_API_BASE = 'http://localhost:5000/api';

export const DEFAULT_APPEARANCE = {
    themeVariant: 'glass',
    bgColor: '#1a5276',
    bgOpacity: 70,
    blur: 10,
    borderRadius: 12,
    borderColor: '#2e86c1',
    borderStyle: 'thin'
};

export const DEFAULT_WIDGET_APPEARANCE = {
    ...DEFAULT_APPEARANCE,
    iconTemplate: 'scrybe'
};

export function normalizeStatusPayload(payload = {}) {
    return {
        status: typeof payload.status === 'string' ? payload.status : 'Prêt',
        isRecording: Boolean(payload.is_recording),
        isTranscribing: Boolean(payload.is_transcribing),
        language: payload.language || 'fr',
        modelSize: payload.model_size || 'small',
        appearance: { ...DEFAULT_APPEARANCE, ...(payload.appearance || {}) },
        widgetAppearance: { ...DEFAULT_WIDGET_APPEARANCE, ...(payload.widget_appearance || {}) },
        shortcuts: payload.shortcuts || {},
        engine: payload.engine || null,
        modelLoaded: Boolean(payload.model_loaded),
        device: payload.device || null,
        computeType: payload.compute_type || null
    };
}

export function normalizeHistoryItem(item = {}) {
    return {
        id: item.id,
        text: typeof item.text === 'string' ? item.text : '',
        timestamp: item.timestamp || null,
        language: item.language || null
    };
}
