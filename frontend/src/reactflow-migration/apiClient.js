import { DEFAULT_API_BASE } from './contracts';

export class ScrybeApiClient {
    constructor(baseUrl = DEFAULT_API_BASE, fetchImpl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        // fetch doit rester lié à window : un fetch destructuré appelé sans
        // récepteur lève "Failed to execute 'fetch': Illegal invocation".
        this.fetch = fetchImpl || globalThis.fetch.bind(globalThis);
    }

    async request(path, options = {}) {
        const response = await this.fetch(`${this.baseUrl}${path}`, {
            headers: { Accept: 'application/json', ...(options.headers || {}) },
            ...options
        });
        if (!response.ok) {
            throw new Error(`Scrybe API ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }

    // GET methods
    getStatus() { return this.request('/status'); }
    getHistory() { return this.request('/history'); }
    getDevices() { return this.request('/devices'); }
    getLanguages() { return this.request('/languages'); }
    getEngines() { return this.request('/engines'); }
    getShortcuts() { return this.request('/shortcuts'); }

    // POST helper
    post(path, body) {
        return this.request(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }

    // Specific POST actions
    setQuality(quality) { return this.post('/settings/quality', { quality }); }
    setShortcuts(shortcuts) { return this.post('/shortcuts', { shortcuts }); }

    // Other actions
    deleteHistoryItem(id) { return this.request(`/delete_transcription/${id}`, { method: 'DELETE' }); }
    setTheme(appearance) { return this.post('/settings/theme', appearance); }
    setWidgetTheme(appearance) { return this.post('/settings/widget_theme', appearance); }
    setEngineConfig(payload) { return this.post('/settings/engine_config', payload); }
    log(level = 'info', message = '', context = {}) {
        return this.post('/log', { level, source: context.source || 'ui', message, ...context });
    }
    startRecording() { return this.post('/start_recording', {}); }
    stopRecording() { return this.post('/stop_recording', {}); }
    toggleRecording() { return this.post('/toggle_recording', {}); }
}
