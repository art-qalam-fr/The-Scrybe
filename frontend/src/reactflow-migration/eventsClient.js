import { normalizeStatusPayload } from './contracts';

export class ScrybeEventsClient {
    constructor(baseUrl, { EventSourceImpl = EventSource, pollMs = 5000 } = {}) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.EventSourceImpl = EventSourceImpl;
        this.pollMs = pollMs;
        this.eventSource = null;
        this.fallbackTimer = null;
        this.failed = false;
        this.statusHandlers = new Set();
        this.historyHandlers = new Set();
        this.pollStatus = null;
    }

    emitStatus(payload) {
        const normalized = normalizeStatusPayload(payload);
        this.statusHandlers.forEach((handler) => handler(normalized));
    }

    emitHistory() {
        this.historyHandlers.forEach((handler) => handler());
    }

    connect() {
        if (this.eventSource) return;
        this.eventSource = new this.EventSourceImpl(`${this.baseUrl}/events`);
        this.eventSource.onopen = () => { this.failed = false; };
        this.eventSource.onerror = () => { this.failed = true; };
        this.eventSource.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'status' && message.data) {
                    this.emitStatus(message.data);
                } else if (message.type === 'history') {
                    this.emitHistory();
                }
            } catch {
                // Ignore malformed SSE frames; the fallback remains available.
            }
        };
        this.fallbackTimer = setInterval(async () => {
            if (!this.failed || !this.pollStatus) return;
            try {
                this.emitStatus(await this.pollStatus());
            } catch {
                // Keep SSE as the primary channel and retry on the next interval.
            }
        }, this.pollMs);
    }

    start({ onStatus, onHistory, pollStatus } = {}) {
        if (onStatus) this.statusHandlers.add(onStatus);
        if (onHistory) this.historyHandlers.add(onHistory);
        if (pollStatus) this.pollStatus = pollStatus;
        this.connect();
        return () => {
            if (onStatus) this.statusHandlers.delete(onStatus);
            if (onHistory) this.historyHandlers.delete(onHistory);
            if (this.statusHandlers.size === 0 && this.historyHandlers.size === 0) {
                this.pollStatus = null;
                this.stop();
            }
        };
    }

    stop() {
        this.eventSource?.close();
        this.eventSource = null;
        if (this.fallbackTimer) clearInterval(this.fallbackTimer);
        this.fallbackTimer = null;
    }
}
