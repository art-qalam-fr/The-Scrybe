import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

// --- Animated SVG Templates ---
// Chaque template reçoit `state` : 'idle' | 'recording' | 'transcribing'
// - idle         : animation lente, discrète
// - recording    : animation rapide + accent rouge
// - transcribing : animation soutenue + accent ambre (le modèle travaille)

const stateDur = (state, rec, trans, idle) =>
    state === 'recording' ? rec : state === 'transcribing' ? trans : idle;

// Couleur d'accent selon l'état : rouge en enregistrement, ambre en transcription
const accent = (state, fallback = 'var(--icon-color-secondary, #d946ef)') =>
    state === 'recording' ? 'var(--icon-color-recording, #ef4444)'
        : state === 'transcribing' ? 'var(--icon-color-transcribing, #f59e0b)'
        : fallback;

const TemplateScrybe = ({ state }) => {
    const rotationDur = stateDur(state, "3s", "5s", "15s");
    return (
        <svg width="60" height="60" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="scrybe_glass_grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--icon-color-primary, #a855f7)" stopOpacity="0.8" />
                    <stop offset="100%" stopColor={accent(state, 'var(--icon-color-secondary, #6366f1)')} stopOpacity="0.4" />
                </linearGradient>
                <radialGradient id="specular" cx="25%" cy="25%" r="50%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
            </defs>
            <circle cx="512" cy="512" r="420" stroke="url(#scrybe_glass_grad)" strokeWidth="15" strokeDasharray="60 30" opacity="0.6">
                <animateTransform attributeName="transform" type="rotate" from="0 512 512" to="360 512 512" dur={rotationDur} repeatCount="indefinite" />
            </circle>
            <circle cx="512" cy="512" r="280" fill="url(#scrybe_glass_grad)" />
            <path d="M495 270 L529 270 L529 650 L495 650 Z" fill="white" opacity="0.15" />
            <path d="M435 340 L469 340 L469 570 L435 570 Z" fill="white" opacity="0.1" />
            <path d="M555 340 L589 340 L589 570 L555 570 Z" fill="white" opacity="0.1" />
            <circle cx="450" cy="400" r="100" fill="url(#specular)" />
        </svg>
    );
};

const TemplateWave = ({ state }) => {
    const dur = stateDur(state, "1.2s", "1.8s", "3.5s");
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="wave_blur" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" />
                </filter>
                <linearGradient id="wave_grad_main" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--icon-color-primary, #6366f1)" stopOpacity="0" />
                    <stop offset="50%" stopColor={accent(state)} stopOpacity="0.8" />
                    <stop offset="100%" stopColor="var(--icon-color-primary, #6366f1)" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d="M10 50 Q 30 15, 50 50 T 90 50" fill="none" stroke="url(#wave_grad_main)" strokeWidth="8" strokeLinecap="round" filter="url(#wave_blur)">
                <animate attributeName="d" values="M10 50 Q 30 15, 50 50 T 90 50; M10 50 Q 30 85, 50 50 T 90 50; M10 50 Q 30 15, 50 50 T 90 50" dur={dur} repeatCount="indefinite" />
            </path>
            <path d="M10 50 Q 30 25, 50 50 T 90 50" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round">
                <animate attributeName="d" values="M10 50 Q 30 25, 50 50 T 90 50; M10 50 Q 30 75, 50 50 T 90 50; M10 50 Q 30 25, 50 50 T 90 50" dur={dur} begin="0.1s" repeatCount="indefinite" />
            </path>
            <path d="M10 45 Q 35 70, 60 45 T 90 45" fill="none" stroke="var(--icon-color-primary)" strokeWidth="1" opacity="0.3">
                <animate attributeName="d" values="M10 45 Q 35 70, 60 45 T 90 45; M10 45 Q 35 20, 60 45 T 90 45; M10 45 Q 35 70, 60 45 T 90 45" dur={`${parseFloat(dur) * 1.5}s`} repeatCount="indefinite" />
            </path>
        </svg>
    );
};

const TemplateMic = ({ state }) => {
    const orbPulse = stateDur(state, "0.8s", "1.4s", "3s");
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="orb_glass_grad" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                    <stop offset="40%" stopColor="var(--icon-color-primary, #6366f1)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor={accent(state)} stopOpacity="0.1" />
                </radialGradient>
                <filter id="orb_glow"><feGaussianBlur stdDeviation="5" /><feComposite in="SourceGraphic" operator="over" /></filter>
            </defs>
            <g filter="url(#orb_glow)">
                <circle cx="50" cy="45" r="22" fill="url(#orb_glass_grad)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5">
                    <animate attributeName="r" values="22;25;22" dur={orbPulse} repeatCount="indefinite" />
                </circle>
                <ellipse cx="42" cy="35" rx="8" ry="4" fill="white" opacity="0.4" transform="rotate(-30 42 35)" />
                <path d="M40 80 Q 50 75, 60 80 M50 67 L50 80" stroke="var(--icon-color-primary)" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
                <path d="M30 45 A 20 20 0 0 0 70 45" fill="none" stroke={accent(state)} strokeWidth="2" opacity="0.4" />
            </g>
        </svg>
    );
};

const TemplateSettings = ({ state }) => {
    const dur = stateDur(state, "3s", "4s", "10s");
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="gear_glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g transform="translate(50,50)" filter="url(#gear_glow)">
                <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur={dur} repeatCount="indefinite" />
                <path d="M0,-35 L5,-35 L8,-45 L12,-45 L15,-35 L20,-35 L25,-42 L30,-38 L25,-30 L28,-26 L38,-28 L40,-22 L30,-18 L30,-12 L40,-8 L38,-2 L28,-5 L25,0 L32,5 L28,12 L20,8 L15,12 L18,22 L12,25 L8,15 L0,15 L-5,22 L-12,20 L-8,12 L-15,8 L-20,12 L-26,8 L-22,0 L-30,-5 L-28,-12 L-38,-15 L-35,-22 L-25,-20 L-20,-25 L-25,-32 L-20,-38 L-12,-32 L-8,-40 L0,-40 Z"
                    fill="var(--icon-color-primary, #6366f1)" transform="translate(-50,-50)" opacity="0.8" />
                <circle cx="0" cy="0" r="18" fill={accent(state)} transform="translate(-50,-50) translate(50,50)" />
                <circle cx="0" cy="0" r="10" fill="rgba(255,255,255,0.2)" transform="translate(-50,-50) translate(50,50)" />
            </g>
        </svg>
    );
};

const TemplateBrain = ({ state }) => {
    const dur = stateDur(state, "1.5s", "2.2s", "4s");
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="brain_glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g filter="url(#brain_glow)">
                <path d="M50 85 C20 85, 10 50, 30 25 C40 10, 60 10, 70 25 C90 50, 80 85, 50 85 Z" fill="none" stroke="var(--icon-color-primary, #6366f1)" strokeWidth="3" opacity="0.4" />
                {[
                    { x: 40, y: 30 }, { x: 60, y: 30 }, { x: 35, y: 50 }, { x: 50, y: 50 }, { x: 65, y: 50 }, { x: 40, y: 70 }, { x: 60, y: 70 }
                ].map((n, i) => (
                    <circle key={i} cx={n.x} cy={n.y} r="3" fill={accent(state)}>
                        <animate attributeName="opacity" values="0.3;1;0.3" dur={dur} begin={`${i * 0.2}s`} repeatCount="indefinite" />
                    </circle>
                ))}
                <path d="M40 30 L60 30 L65 50 L60 70 L40 70 L35 50 L40 30 M40 30 L50 50 L60 30 M35 50 L50 50 L65 50 M40 70 L50 50 L60 70"
                    fill="none" stroke="var(--icon-color-secondary, #d946ef)" strokeWidth="1" strokeDasharray="2 2" opacity="0.5">
                    <animate attributeName="stroke-dashoffset" from="0" to="20" dur="2s" repeatCount="indefinite" />
                </path>
            </g>
        </svg>
    );
};

const TemplateSearch = ({ state }) => {
    const dur = stateDur(state, "1.5s", "2s", "4s");
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="search_glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g filter="url(#search_glow)">
                <circle cx="45" cy="45" r="20" stroke={accent(state, 'var(--icon-color-primary, #6366f1)')} strokeWidth="6" fill="none" />
                <path d="M60 60 L80 80" stroke="var(--icon-color-secondary, #d946ef)" strokeWidth="8" strokeLinecap="round" />
                {[0, 1, 2].map(i => (
                    <line key={i} x1="35" y1={38 + i * 7} x2="55" y2={38 + i * 7} stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6">
                        <animate attributeName="x2" values="35;55;35" dur={dur} begin={`${i * 0.3}s`} repeatCount="indefinite" />
                    </line>
                ))}
            </g>
        </svg>
    );
};

const TemplateMusic = ({ state }) => {
    const dur = stateDur(state, "0.6s", "1.1s", "2s");
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="note_glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g filter="url(#note_glow)">
                <circle cx="40" cy="70" r="10" fill={accent(state)} />
                <path d="M50 70 L50 25 L75 35 L75 45 L50 35" fill="var(--icon-color-primary, #6366f1)" />
                <circle cx="50" cy="50" r="30" stroke="var(--icon-color-primary, #6366f1)" strokeWidth="2" fill="none" opacity="0.3">
                    <animate attributeName="r" values="30;35;30" dur={dur} repeatCount="indefinite" />
                </circle>
            </g>
        </svg>
    );
};

const TemplateCalendar = ({ state }) => {
    const dur = stateDur(state, "1.5s", "2.2s", "5s");
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="cal_glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <rect x="20" y="25" width="60" height="55" rx="8" fill="rgba(255,255,255,0.1)" stroke="var(--icon-color-primary, #6366f1)" strokeWidth="3" filter="url(#cal_glow)" />
            <rect x="20" y="25" width="60" height="15" rx="8" fill={accent(state)} opacity="0.8" />
            <circle cx="35" cy="25" r="4" fill="var(--icon-color-primary, #6366f1)" />
            <circle cx="65" cy="25" r="4" fill="var(--icon-color-primary, #6366f1)" />
            {[0, 1, 2, 3].map(i => (
                <circle key={i} cx={30 + i * 12} cy={55 + (i % 2) * 8} r="2" fill="#fff" opacity="0.6">
                    <animate attributeName="opacity" values="0.1;1;0.1" dur={dur} begin={`${i * 0.4}s`} repeatCount="indefinite" />
                </circle>
            ))}
        </svg>
    );
};

const TemplateBell = ({ state }) => {
    const dur = stateDur(state, "0.5s", "1.1s", "2s");
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="bell_glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g filter="url(#bell_glow)">
                <path d="M50 20 C35 20, 25 35, 25 50 L25 70 L75 70 L75 50 C75 35, 65 20, 50 20 Z" fill="var(--icon-color-primary, #6366f1)" opacity="0.8">
                    <animateTransform attributeName="transform" type="rotate" values="-5 50 20; 5 50 20; -5 50 20" dur={dur} repeatCount="indefinite" />
                </path>
                <rect x="42" y="70" width="16" height="8" rx="4" fill={accent(state)} />
                {[20, 80].map((x, i) => (
                    <path key={i} d={`M${x} 40 Q ${i === 0 ? x - 10 : x + 10} 50, ${x} 60`} stroke="var(--icon-color-primary, #6366f1)" strokeWidth="3" fill="none" strokeLinecap="round">
                        <animate attributeName="opacity" values="0;1;0" dur={dur} repeatCount="indefinite" />
                    </path>
                ))}
            </g>
        </svg>
    );
};

const TemplateHome = ({ state }) => {
    const dur = stateDur(state, "1s", "1.6s", "3s");
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="home_glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g filter="url(#home_glow)">
                <path d="M20 50 L50 20 L80 50 L80 80 L20 80 Z" fill="none" stroke="var(--icon-color-primary, #6366f1)" strokeWidth="4" strokeLinejoin="round" />
                <rect x="42" y="60" width="16" height="20" fill={accent(state)} opacity="0.6" />
                <ellipse cx="50" cy="55" rx="35" ry="10" fill="none" stroke="var(--icon-color-secondary, #d946ef)" strokeWidth="2" opacity="0.4">
                    <animate attributeName="rx" values="35;45;35" dur={dur} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0.1;0.4" dur={dur} repeatCount="indefinite" />
                </ellipse>
            </g>
        </svg>
    );
};

// Égaliseur audio : 5 barres qui rebondissent
const TemplateEqualizer = ({ state }) => {
    const dur = stateDur(state, "0.5s", "0.9s", "1.6s");
    const bars = [[20, 55], [30, 75], [22, 90], [28, 65], [18, 50]];
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="eq_glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g filter="url(#eq_glow)">
                {bars.map(([min, max], i) => (
                    <rect key={i} x={14 + i * 15} y={85 - min} width="9" height={min} rx="4.5"
                        fill={i === 2 ? accent(state, 'var(--icon-color-primary, #6366f1)') : 'var(--icon-color-primary, #6366f1)'}>
                        <animate attributeName="height" values={`${min};${max};${min}`} dur={dur} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                        <animate attributeName="y" values={`${85 - min};${85 - max};${85 - min}`} dur={dur} begin={`${i * 0.12}s`} repeatCount="indefinite" />
                    </rect>
                ))}
            </g>
        </svg>
    );
};

// Orbite : noyau central + satellite sur orbite elliptique
const TemplateOrbit = ({ state }) => {
    const dur = stateDur(state, "1.2s", "2.5s", "6s");
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="orbit_glow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g filter="url(#orbit_glow)">
                <circle cx="50" cy="50" r="14" fill="var(--icon-color-primary, #6366f1)" opacity="0.9">
                    <animate attributeName="r" values="14;16;14" dur={dur} repeatCount="indefinite" />
                </circle>
                <ellipse cx="50" cy="50" rx="32" ry="20" fill="none" stroke="var(--icon-color-secondary, #d946ef)" strokeWidth="1.5" opacity="0.4" transform="rotate(-20 50 50)" />
                <g transform="rotate(-20 50 50)">
                    <circle r="5" fill={accent(state)}>
                        <animateMotion dur={dur} repeatCount="indefinite"
                            path="M82 50 A32 20 0 1 1 18 50 A32 20 0 1 1 82 50" />
                    </circle>
                </g>
            </g>
        </svg>
    );
};

// Sonar : anneaux concentriques qui se propagent
const TemplatePulse = ({ state }) => {
    const dur = stateDur(state, "1s", "1.8s", "3s");
    return (
        <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="pulse_glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g filter="url(#pulse_glow)">
                <circle cx="50" cy="50" r="10" fill={accent(state, 'var(--icon-color-primary, #6366f1)')} />
                {[0, 1, 2].map(i => (
                    <circle key={i} cx="50" cy="50" r="12" fill="none" stroke="var(--icon-color-primary, #6366f1)" strokeWidth="2">
                        <animate attributeName="r" values="12;40" dur={dur} begin={`${i * parseFloat(dur) / 3}s`} repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;0" dur={dur} begin={`${i * parseFloat(dur) / 3}s`} repeatCount="indefinite" />
                    </circle>
                ))}
            </g>
        </svg>
    );
};

// Forme du masque : la plupart des templates sont pensés pour un cercle,
// quelques-uns assument un cadre carré arrondi
const iconTemplates = {
    scrybe: { component: TemplateScrybe, shape: 'circle' },
    waves: { component: TemplateWave, shape: 'circle' },
    neon: { component: TemplateMic, shape: 'circle' },
    cyber: { component: TemplateSettings, shape: 'circle' },
    orb: { component: TemplateBrain, shape: 'circle' },
    rings: { component: TemplateSearch, shape: 'circle' },
    echo: { component: TemplateMusic, shape: 'circle' },
    dot: { component: TemplateCalendar, shape: 'square' },
    shield: { component: TemplateBell, shape: 'circle' },
    burst: { component: TemplateHome, shape: 'square' },
    equalizer: { component: TemplateEqualizer, shape: 'circle' },
    orbit: { component: TemplateOrbit, shape: 'circle' },
    pulse: { component: TemplatePulse, shape: 'circle' }
};

// Overrides de test : ?tpl=nom&state=idle|recording|transcribing
// Permet aux sondes Electron de capturer chaque combinaison sans backend
// ?grid=1 : mosaïque de tous les templates × les 3 états (revue visuelle)
const devParams = new URLSearchParams(window.location.search);
const DEV_TPL = devParams.get('tpl');
const DEV_STATE = devParams.get('state');
const DEV_GRID = devParams.get('grid') === '1';

const GRID_STATES = ['idle', 'recording', 'transcribing'];

const WidgetGrid = () => (
    <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_STATES.length}, 110px)`,
        gap: '14px', padding: '16px',
        background: '#0f172a',
        fontFamily: 'sans-serif', color: '#94a3b8', fontSize: '11px'
    }}>
        {GRID_STATES.map(s => (
            <div key={`h-${s}`} style={{ textAlign: 'center', fontWeight: 700 }}>{s}</div>
        ))}
        {Object.entries(iconTemplates).map(([name, tpl]) => (
            GRID_STATES.map(s => (
                <div key={`${name}-${s}`} style={{ textAlign: 'center' }}>
                    <div className={`widget-container variant-glass ${s}`} style={{
                        '--cur-bg': 'rgba(26,82,118,0.7)',
                        '--cur-radius': tpl.shape === 'circle' ? '50%' : '12px',
                        '--cur-border-color': '#2e86c1',
                        '--cur-border-width': '1px'
                    }}>
                        <div className="widget-background-layer" style={{
                            backgroundColor: 'rgba(26,82,118,0.7)',
                            borderRadius: tpl.shape === 'circle' ? '50%' : '12px',
                            border: `1px solid #2e86c1`
                        }} />
                        {s === 'transcribing' && <div className="widget-transcribe-ring" />}
                        <div className="widget-content">
                            <div className="widget-icon">
                                <tpl.component state={s} />
                            </div>
                        </div>
                    </div>
                    <div>{name}</div>
                </div>
            ))
        ))}
    </div>
);

const DEFAULT_APPEARANCE = {
    themeVariant: 'glass',
    bgColor: '#1a5276',
    bgOpacity: 70,
    blur: 10,
    borderRadius: 12,
    borderColor: '#2e86c1',
    borderStyle: 'thin',
    iconTemplate: 'scrybe'
};

const WidgetLive = () => {
    const [isRecording, setIsRecording] = useState(DEV_STATE === 'recording');
    const [isTranscribing, setIsTranscribing] = useState(DEV_STATE === 'transcribing');
    const [appearance, setAppearance] = useState({
        ...DEFAULT_APPEARANCE,
        ...(DEV_TPL ? { iconTemplate: DEV_TPL } : {})
    });

    // SSE : le backend pousse les changements d'état ; polling lent (5s)
    // uniquement en filet de sécurité si la connexion SSE tombe
    useEffect(() => {
        if (DEV_TPL || DEV_STATE) return; // mode capture : pas de réseau
        // Remonter les erreurs JS du widget vers logs/frontend.log
        const reportError = (msg) => {
            axios.post(`${API_BASE}/log`, {
                level: 'error', source: 'widget',
                message: String(msg).slice(0, 2000)
            }).catch(() => {});
        };
        const onError = (e) => reportError(`${e.message} @${e.filename}:${e.lineno}`);
        const onRejection = (e) => reportError(`unhandledrejection: ${e.reason}`);
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);

        let sseFailed = false;
        const es = new EventSource(`${API_BASE}/events`);
        es.onopen = () => { sseFailed = false; };
        es.onerror = () => { sseFailed = true; };
        es.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'status' && msg.data) {
                    setIsRecording(msg.data.is_recording);
                    setIsTranscribing(!!msg.data.is_transcribing);
                    // Le widget a sa propre apparence, indépendante du dashboard
                    const wa = msg.data.widget_appearance || msg.data.appearance;
                    if (wa) setAppearance(prev => ({ ...prev, ...wa }));
                }
            } catch { /* message malformé : ignorer */ }
        };
        const fallback = setInterval(async () => {
            if (!sseFailed) return;
            try {
                const res = await axios.get(`${API_BASE}/status`);
                setIsRecording(res.data.is_recording);
                setIsTranscribing(!!res.data.is_transcribing);
                const wa = res.data.widget_appearance || res.data.appearance;
                if (wa) setAppearance(prev => ({ ...prev, ...wa }));
            } catch (e) { console.error(e); }
        }, 5000);
        return () => {
            es.close(); clearInterval(fallback);
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
        };
    }, []);

    const state = isTranscribing ? 'transcribing' : isRecording ? 'recording' : 'idle';
    const template = iconTemplates[appearance.iconTemplate] || iconTemplates.scrybe;
    const themeClass = appearance.themeVariant === 'glass' ? 'variant-glass' : `variant-${appearance.themeVariant}`;

    const bgColor = (typeof appearance.bgColor === 'string' &&
        (/^#[0-9a-f]{6}$/i.test(appearance.bgColor) || appearance.bgColor.startsWith('rgba')))
        ? appearance.bgColor : '#1a5276';
    const dynamicStyle = {
        '--cur-bg': bgColor.includes('rgba') ? bgColor : `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${appearance.bgOpacity / 100})`,
        '--cur-blur': `${appearance.blur}px`,
        '--cur-radius': template.shape === 'circle' ? '50%' : `${appearance.borderRadius}px`,
        '--cur-border-color': appearance.borderColor,
        '--cur-border-width': appearance.borderStyle === 'thin' ? '1px' : appearance.borderStyle === 'thick' ? '3px' : '0px',
    };

    return (
        <div className={`widget-container ${themeClass} ${state}`} style={dynamicStyle}>
            <div
                className="widget-background-layer"
                style={{
                    backgroundColor: dynamicStyle['--cur-bg'],
                    backdropFilter: Number(appearance.blur) > 0 ? `blur(${dynamicStyle['--cur-blur']})` : 'none',
                    WebkitBackdropFilter: Number(appearance.blur) > 0 ? `blur(${dynamicStyle['--cur-blur']})` : 'none',
                    borderRadius: dynamicStyle['--cur-radius'],
                    border: `${dynamicStyle['--cur-border-width']} solid ${dynamicStyle['--cur-border-color']}`
                }}
            />
            {/* Anneau de progression visible uniquement pendant la transcription */}
            {state === 'transcribing' && <div className="widget-transcribe-ring" />}
            <div className="widget-content">
                <div className="widget-icon">
                    <template.component state={state} />
                </div>
            </div>
        </div>
    );
};

const Widget = () => (DEV_GRID ? <WidgetGrid /> : <WidgetLive />);

export default Widget;
