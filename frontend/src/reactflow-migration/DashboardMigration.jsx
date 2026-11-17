import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { apiClient, eventsClient } from './clients';
import { createTranslator, translateStatus } from './i18n';
import { DEFAULT_APPEARANCE } from './contracts';
import '../App.css';
import './DashboardMigration.css';
import { Mic, Play, Square, Cpu, Languages, Globe } from 'lucide-react';

export default function DashboardMigration() {
    // État du tableau de bord
    const [status, setStatus] = useState('Prêt');
    const [isRecording, setIsRecording] = useState(false);
    const [config, setConfig] = useState({ model_size: 'small', language: 'fr' });
    const [languages, setLanguages] = useState({});
    const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);

    // Traduction dynamique selon la langue sélectionnée
    const t = useMemo(() => createTranslator(config.language), [config.language]);

    // Synchronisation via SSE / polling
    useEffect(() => {
        const stop = eventsClient.start({
            onStatus: (payload) => {
                // normalizeStatusPayload fournit du camelCase (isRecording, modelSize...)
                setStatus((prevStatus) => payload.status ?? prevStatus);
                setIsRecording(
                    (prevIsRecording) => payload.isRecording ?? prevIsRecording,
                );
                if (payload.modelSize)
                    setConfig((c) => ({ ...c, model_size: payload.modelSize }));
                if (payload.language)
                    setConfig((c) => ({ ...c, language: payload.language }));
                if (payload.appearance)
                    setAppearance((a) => ({ ...a, ...payload.appearance }));
            },
            pollStatus: async () => await apiClient.getStatus(),
        });
        // Chargement initial des langues et de la configuration
        apiClient.getLanguages().then((res) => setLanguages(res.languages || {}));
        apiClient.getStatus().then((res) => {
            setConfig((c) => ({
                ...c,
                model_size: res.model_size || c.model_size,
                language: res.language || c.language,
            }));
            if (res.appearance)
                setAppearance((a) => ({ ...a, ...res.appearance }));
        }).catch(() => {});
        return () => stop();
    }, []);

    // Gestion du bouton d'enregistrement
    const handleToggle = async () => {
        try {
            await apiClient.toggleRecording();
        } catch (e) {
            console.error(e);
        }
    };

    // Mapping qualité legacy → libellés
    const qualityMap = {
        tiny: 'eco',
        base: 'standard',
        small: 'high',
        medium: 'pro',
        large: 'max_quality',
    };

    // Traduction du statut selon le legacy
    const getTranslatedStatus = (raw) => translateStatus(raw, t);

    // Changement de langue via POST
    const handleLanguageClick = async (code) => {
        try {
            await axios.post(`${apiClient.baseUrl}/settings/language`, {
                language: code,
            });
        } catch (e) {
            console.error(e);
        }
    };

    // Bouton micro / stop – toggle via apiClient
    const micButton = (
        <button
            className={`mic-btn ${isRecording ? 'recording' : ''}`}
            onClick={handleToggle}
        >
            {isRecording ? (
                <Square size={32} fill='white' />
            ) : (
                <Play size={32} fill='white' />
            )}
        </button>
    );

    // Apparence dynamique comme le legacy (.app-container + variant-*)
    const bgColor =
        typeof appearance.bgColor === 'string' &&
        (/^#[0-9a-f]{6}$/i.test(appearance.bgColor) ||
            appearance.bgColor.startsWith('rgba'))
            ? appearance.bgColor
            : '#1a5276';
    const dynamicStyle = {
        '--cur-bg': bgColor.includes('rgba')
            ? bgColor
            : `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${appearance.bgOpacity / 100})`,
        '--cur-blur': `${appearance.blur}px`,
        '--cur-radius': `${appearance.borderRadius}px`,
        '--cur-border-color': appearance.borderColor,
        '--cur-border-width':
            appearance.borderStyle === 'thin'
                ? '1px'
                : appearance.borderStyle === 'thick'
                    ? '3px'
                    : '0px',
    };
    const themeClass =
        appearance.themeVariant === 'glass'
            ? 'variant-glass'
            : `variant-${appearance.themeVariant}`;

    return (
        <div className={`dashboard-migration ${themeClass}`} style={dynamicStyle}>
            <div className='dashboard-grid'>
                {/* Record Card */}
                <div className='record-card main-card'>
                    <div className='recording-viz'>
                        <div className={`ring ${isRecording ? 'animating' : ''}`} />
                        {micButton}
                    </div>
                    <h2>{getTranslatedStatus(status)}</h2>
                    <p className='hint'>{t('hint_record')}</p>
                </div>

                {/* Side Cards */}
                <div className='side-cards'>
                    <div className='mini-card'>
                        <Cpu size={20} className='icon-violet' />
                        <div className='mini-info'>
                            <h4>{t('quality')}</h4>
                            <p>{t(qualityMap[config.model_size] || config.model_size)}</p>
                        </div>
                    </div>
                    <div className='mini-card'>
                        <Languages size={20} className='icon-blue' />
                        <div className='mini-info'>
                            <h4>{t('language')}</h4>
                            <p>{languages[config.language] || config.language}</p>
                        </div>
                    </div>
                </div>

                {/* Language Grid Card */}
                <div className='full-width-card language-grid-card'>
                    <h3>
                        <Globe size={18} /> {t('select_transcription_language')}
                    </h3>
                    <div className='languages-grid'>
                        {Object.entries(languages).map(([code, name]) => (
                            <div
                                key={code}
                                className={`lang-card ${config.language === code ? 'active' : ''}`}
                                onClick={() => handleLanguageClick(code)}
                            >
                                <div className='lang-icon'>
                                    {code === 'fr'
                                        ? '🇫🇷'
                                        : code === 'en'
                                            ? '🇺🇸'
                                            : code === 'es'
                                                ? '🇪🇸'
                                                : code === 'de'
                                                    ? '🇩🇪'
                                                    : code === 'it'
                                                        ? '🇮🇹'
                                                        : code === 'ja'
                                                            ? '🇯🇵'
                                                            : code === 'zh'
                                                                ? '🇨🇳'
                                                                : '🌐'}
                                </div>
                                <div className='lang-name'>{name}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
