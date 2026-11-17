import React, { useEffect, useState } from 'react';
import { apiClient, eventsClient } from './clients';
import { createTranslator } from './i18n';
import { useUiLanguage } from './useUiLanguage';
import { Trash2, History as HistoryIcon } from 'lucide-react';
import '../App.css';

export default function HistoryPanel() {
    const [uiLanguage] = useUiLanguage();
    const t = createTranslator(uiLanguage);
    const [history, setHistory] = useState([]);
    const [error, setError] = useState(null);

    const fetchHistory = () => {
        apiClient.getHistory()
            .then((data) => setHistory(data.history || data))
            .catch((e) => setError(e.message));
    };

    useEffect(() => {
        let isMounted = true;
        fetchHistory();
        const stop = eventsClient.start({
            onHistory: () => { if (isMounted) fetchHistory(); },
            pollStatus: async () => await apiClient.getStatus()
        });
        return () => { isMounted = false; stop(); };
    }, []);

    const handleDelete = (id) => {
        apiClient.deleteHistoryItem(id)
            .then(() => fetchHistory())
            .catch((e) => setError(e.message));
    };

    if (error) {
        return <div className="history-panel-error">{t('api_error')}: {error}</div>;
    }

    return (
        <div className="history-list fade-in">
            {history.length === 0 ? (
                <div className="empty-state">
                    <HistoryIcon size={48} />
                    <p>{t('no_history')}</p>
                </div>
            ) : (
                history.map((item, idx) => (
                    <div key={item.id ?? idx} className="history-item">
                        <div className="item-content">
                            <p>{item.text || item.transcript}</p>
                            <span className="timestamp">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                        <button className="delete-btn" onClick={() => handleDelete(item.id)}>
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))
            )}
        </div>
    );
}
