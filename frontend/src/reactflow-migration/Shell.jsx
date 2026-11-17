import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createTranslator, translateStatus } from './i18n';
import { apiClient, eventsClient } from './clients';
import { useUiLanguage } from './useUiLanguage';
import { DEFAULT_APPEARANCE } from './contracts';
import '../App.css';
import './Shell.css';
import DashboardMigration from './DashboardMigration';
import HistoryPanel from './HistoryPanel';
import AppearancePanel from './AppearancePanel';
import SettingsPanel from './SettingsPanel';
import logo from '../assets/logo.svg';
import { createPlatformAdapter } from './platformAdapter';
import AboutPanel from './AboutPanel';
import { Monitor, History, Palette, Settings, Info, X, Minus, Square } from 'lucide-react';

const TAB_KEYS = ['dashboard', 'history', 'appearance', 'settings', 'about'];

function WindowControls({ adapter }) {
    return (
        <div className="window-controls">
            <button className="control-btn minimize" onClick={() => adapter.minimize()} title="Minimize">
                <Minus size={14} />
            </button>
            <button className="control-btn maximize" onClick={() => adapter.maximize()} title="Maximize">
                <Square size={12} />
            </button>
            <button className="control-btn close" onClick={() => adapter.close()} title="Close">
                <X size={14} />
            </button>
        </div>
    );
}

export default function Shell() {
    const [locale] = useUiLanguage();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [status, setStatus] = useState('Prêt');
    const [isRecording, setIsRecording] = useState(false);
    const [appearance, setAppearance] = useState({ ...DEFAULT_APPEARANCE });
    const shellRef = useRef(null);
    const t = useMemo(() => createTranslator(locale), [locale]);
    const platformAdapter = useMemo(() => createPlatformAdapter(), []);

    // Navigation depuis la tray / le menu contextuel
    useEffect(() => {
        const applyNavigate = (tab) => {
            if (TAB_KEYS.includes(tab)) setActiveTab(tab);
        };
        const pending = platformAdapter.getPendingNavigate?.();
        if (pending?.then) pending.then(applyNavigate).catch(() => {});
        else applyNavigate(pending);
        return platformAdapter.onNavigate(applyNavigate);
    }, [platformAdapter]);

    // Statut + apparence backend pour le bandeau (SSE avec fallback polling)
    useEffect(() => {
        const unsubscribe = eventsClient.start({
            onStatus: (payload) => {
                if (payload.status) setStatus(payload.status);
                if (payload.isRecording !== undefined) setIsRecording(payload.isRecording);
                if (payload.appearance) setAppearance((a) => ({ ...a, ...payload.appearance }));
            },
            pollStatus: () => apiClient.getStatus(),
        });
        apiClient.getStatus()
            .then((res) => {
                if (res?.status) setStatus(res.status);
                if (res?.appearance) setAppearance((a) => ({ ...a, ...res.appearance }));
            })
            .catch(() => {});
        return unsubscribe;
    }, []);

    // Redimensionnement fenêtre au changement de vue (comme le legacy)
    useEffect(() => {
        const id = requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                const height = shellRef.current?.scrollHeight;
                if (height) platformAdapter.resizeToContent(1000, height + 24);
            })
        );
        return () => cancelAnimationFrame(id);
    }, [activeTab, platformAdapter]);

    // Apparence dynamique — même calcul que App.jsx legacy
    const themeClass =
        appearance.themeVariant === 'glass' ? 'variant-glass' : `variant-${appearance.themeVariant}`;
    const bgColor =
        typeof appearance.bgColor === 'string' &&
        (/^#[0-9a-f]{6}$/i.test(appearance.bgColor) || appearance.bgColor.startsWith('rgba'))
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
        ...(Number(appearance.blur) > 0
            ? {}
            : { backdropFilter: 'none', WebkitBackdropFilter: 'none' }),
    };

    const NAV_ICONS = {
        dashboard: Monitor,
        history: History,
        appearance: Palette,
        settings: Settings,
        about: Info,
    };

    const renderPanelContent = () => {
        if (activeTab === 'dashboard') return <DashboardMigration />;
        if (activeTab === 'history') return <HistoryPanel />;
        if (activeTab === 'appearance') return <AppearancePanel />;
        if (activeTab === 'settings') return <SettingsPanel />;
        if (activeTab === 'about') return <AboutPanel t={t} />;
        return null;
    };

    return (
        <div className={`app-container ${themeClass}`} style={dynamicStyle} ref={shellRef}>
            {/* Sidebar — même structure que App.jsx */}
            <nav className="sidebar">
                <div className="logo">
                    <img
                        src={logo}
                        alt="Scrybe"
                        className="logo-img"
                        style={{ width: 56, height: 56, objectFit: 'contain', marginRight: 10 }}
                    />
                    <span>The Scrybe</span>
                </div>
                <div className="nav-items">
                    {TAB_KEYS.map((key) => {
                        const Icon = NAV_ICONS[key];
                        return (
                            <button
                                key={key}
                                className={`nav-item ${activeTab === key ? 'active' : ''}`}
                                onClick={() => setActiveTab(key)}
                            >
                                <Icon size={20} />
                                <span>{t(key)}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="sidebar-footer">
                    <div className="status-indicator">
                        <div className={`status-dot ${isRecording ? 'pulse' : ''}`}></div>
                        <span>{translateStatus(status, t)}</span>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="content">
                <header className="content-header">
                    <div className="title-area">
                        <img
                            src={logo}
                            alt="Scrybe"
                            style={{ width: 48, height: 48, marginRight: 12, verticalAlign: 'middle' }}
                        />
                        <h1>{t(activeTab)}</h1>
                    </div>
                    <div className="header-right">
                        <div className="user-info" style={{ marginRight: '1rem' }}>
                            <span className="badge">{t('local_engine')}</span>
                        </div>
                        <WindowControls adapter={platformAdapter} />
                    </div>
                </header>

                <div className="content-body">{renderPanelContent()}</div>
            </main>
        </div>
    );
}
