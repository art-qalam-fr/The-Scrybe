import React, { useEffect, useMemo, useState } from 'react';
import { ScrybeApiClient } from './apiClient';
import { ScrybeEventsClient } from './eventsClient';
import { createPlatformAdapter } from './platformAdapter';

export default function MigrationHarness() {
    const api = useMemo(() => new ScrybeApiClient(), []);
    const platform = useMemo(() => createPlatformAdapter(), []);
    const [status, setStatus] = useState('Initialisation...');
    const [snapshot, setSnapshot] = useState(null);

    useEffect(() => {
        let disposeEvents;
        const load = async () => {
            try {
                const current = await api.getStatus();
                setSnapshot(current);
                setStatus('API connectée');
                const events = new ScrybeEventsClient(api.baseUrl);
                disposeEvents = events.start({
                    onStatus: (next) => setSnapshot(next),
                    pollStatus: () => api.getStatus()
                });
            } catch (error) {
                setStatus(`API indisponible: ${error.message}`);
            }
        };
        load();
        return () => disposeEvents?.();
    }, [api]);

    return (
        <main style={{ padding: 24, fontFamily: 'system-ui', color: '#e5e7eb', background: '#111827', minHeight: '100vh' }}>
            <h1>React Migration Harness</h1>
            <p data-testid="harness-status">{status}</p>
            <dl>
                <dt>Platform adapter</dt>
                <dd data-testid="platform-kind">{platform.kind}</dd>
                <dt>Backend status</dt>
                <dd data-testid="backend-status">{snapshot?.status || '—'}</dd>
                <dt>Recording</dt>
                <dd data-testid="recording-status">{String(snapshot?.isRecording ?? false)}</dd>
                <dt>Transcribing</dt>
                <dd data-testid="transcribing-status">{String(snapshot?.isTranscribing ?? false)}</dd>
            </dl>
        </main>
    );
}
