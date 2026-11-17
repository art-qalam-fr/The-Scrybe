import React, { useState, useEffect, useMemo } from 'react';

import { ScrybeEventsClient } from './eventsClient';
import { ScrybeApiClient } from './apiClient';
import { DEFAULT_API_BASE, DEFAULT_WIDGET_APPEARANCE } from './contracts';
import { iconTemplates } from './widgetTemplates.jsx';
import './WidgetMigration.css';

const NullTemplate = () => null;

// --- DEV Modes (ported from Widget.jsx) ---
// ?grid=1 : mosaïque de tous les templates × les 3 états (revue visuelle)
// ?tpl=nom&state=idle|recording|transcribing : capture individuelle pour screenshots

const devParams = new URLSearchParams(window.location.search);
const DEV_TPL = devParams.get('tpl');
const DEV_STATE = devParams.get('state');
const DEV_GRID = devParams.get('grid') === '1';

const GRID_STATES = ['idle', 'recording', 'transcribing'];

const WidgetGrid = () => (
    <div className="widget-scope" style={{
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
                            border: '1px solid #2e86c1'
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

const WidgetCapture = ({ tplName, state }) => {
    const tpl = iconTemplates[tplName];
    if (!tpl) {
        return (
            <div style={{ padding: 20, color: '#ef4444', fontFamily: 'sans-serif' }}>
                Template "{tplName}" inconnu. Disponibles : {Object.keys(iconTemplates).join(', ')}
            </div>
        );
    }
    const Comp = tpl.component;
    const radius = tpl.shape === 'circle' ? '50%' : '12px';
    return (
        <div className="widget-scope" style={{ padding: 16, background: '#0f172a', fontFamily: 'sans-serif', color: '#94a3b8', fontSize: '12px' }}>
            <div style={{ marginBottom: 8, textAlign: 'center', fontWeight: 700 }}>{tplName} — {state}</div>
            <div className={`widget-container variant-glass ${state}`} style={{
                '--cur-bg': 'rgba(26,82,118,0.7)',
                '--cur-radius': radius,
                '--cur-border-color': '#2e86c1',
                '--cur-border-width': '1px'
            }}>
                <div className="widget-background-layer" style={{
                    backgroundColor: 'rgba(26,82,118,0.7)',
                    borderRadius: radius,
                    border: '1px solid #2e86c1'
                }} />
                {state === 'transcribing' && <div className="widget-transcribe-ring" />}
                <div className="widget-content">
                    <div className="widget-icon">
                        <Comp state={state} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function WidgetMigration() {
  const eventsClient = useMemo(
    () => new ScrybeEventsClient(DEFAULT_API_BASE, {}),
    [],
  );
  const apiClient = useMemo(() => new ScrybeApiClient(DEFAULT_API_BASE), []);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [widgetAppearance, setWidgetAppearance] = useState({
    ...DEFAULT_WIDGET_APPEARANCE,
  });

  useEffect(() => {
    if (DEV_GRID || DEV_TPL || DEV_STATE) return; // mode capture : pas de réseau

    // Remonter les erreurs JS du widget vers logs/frontend.log (comme le legacy)
    const reportError = (msg) => {
      apiClient.log('error', String(msg).slice(0, 2000), { source: 'widget' })
        .catch(() => {});
    };
    const onError = (e) => reportError(`${e.message} @${e.filename}:${e.lineno}`);
    const onRejection = (e) => reportError(`unhandledrejection: ${e.reason}`);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    const stop = eventsClient.start({
      onStatus: (payload) => {
        // Le payload SSE est normalisé en camelCase par normalizeStatusPayload
        setIsRecording(Boolean(payload.isRecording));
        setIsTranscribing(Boolean(payload.isTranscribing));
        const wa = payload.widgetAppearance || payload.appearance;
        if (wa) setWidgetAppearance((prev) => ({ ...prev, ...wa }));
      },
      onHistory: () => {},
      pollStatus: async () => await apiClient.getStatus(),
    });
    return () => {
      stop();
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [eventsClient, apiClient]);

  const handleClick = async () => {
    try {
      await apiClient.toggleRecording();
    } catch (error) {
      console.error('Failed to toggle recording:', error);
    }
  };

  const templateKey =
    widgetAppearance.iconTemplate || DEFAULT_WIDGET_APPEARANCE.iconTemplate;
  const template = iconTemplates[templateKey] || { shape: 'circle', component: NullTemplate };
  const TemplateComponent = template.component;

  const state = isTranscribing ? 'transcribing' : isRecording ? 'recording' : 'idle';

  // --- DEV overrides ---
  if (DEV_GRID) return <WidgetGrid />;
  if (DEV_TPL && DEV_STATE) {
    return <WidgetCapture tplName={DEV_TPL} state={DEV_STATE} />;
  }
  // --- end DEV overrides ---

  // Apparence dynamique, même calcul que le legacy Widget.jsx
  const themeClass =
    widgetAppearance.themeVariant === 'glass'
      ? 'variant-glass'
      : `variant-${widgetAppearance.themeVariant}`;
  const bgColor =
    typeof widgetAppearance.bgColor === 'string' &&
    (/^#[0-9a-f]{6}$/i.test(widgetAppearance.bgColor) ||
      widgetAppearance.bgColor.startsWith('rgba'))
      ? widgetAppearance.bgColor
      : '#1a5276';
  const curBg = bgColor.includes('rgba')
    ? bgColor
    : `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${(widgetAppearance.bgOpacity ?? 70) / 100})`;
  const containerStyle = {
    '--cur-bg': curBg,
    '--cur-blur': Number(widgetAppearance.blur) > 0 ? `blur(${widgetAppearance.blur}px)` : 'none',
    '--cur-radius': template.shape === 'circle' ? '50%' : `${widgetAppearance.borderRadius ?? 12}px`,
    '--cur-border-color': widgetAppearance.borderColor || '#2e86c1',
    '--cur-border-width':
      widgetAppearance.borderStyle === 'thin'
        ? '1px'
        : widgetAppearance.borderStyle === 'thick'
          ? '3px'
          : '0px',
  };

  return (
    <div
      className={`widget-migration widget-scope ${state}`}
      style={containerStyle}
      data-state={state}
      onClick={handleClick}
    >
      <div className={`widget-container ${themeClass} ${state}`}>
        <div
          className="widget-background-layer"
          style={{
            backgroundColor: curBg,
            borderRadius: containerStyle['--cur-radius'],
            border: `${containerStyle['--cur-border-width']} solid ${containerStyle['--cur-border-color']}`,
          }}
        />
        {state === 'transcribing' && (
          <div className="widget-transcribe-ring" />
        )}
        <div className="widget-content">
          <div className="widget-icon">
            <TemplateComponent state={state} />
          </div>
        </div>
      </div>
    </div>
  );
}
