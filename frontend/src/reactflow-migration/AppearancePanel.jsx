import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from './clients';
import { DEFAULT_APPEARANCE, DEFAULT_WIDGET_APPEARANCE } from './contracts';
import { iconTemplates } from './widgetTemplates.jsx';
import { createTranslator } from './i18n.js';
import { useUiLanguage } from './useUiLanguage';
import { Layout, Droplet, Layers, Package } from 'lucide-react';
import '../App.css';

const THEME_VARIANTS = [
  { v: 'glass', l: 'Glass' },
  { v: 'light', l: 'Light Frost' },
  { v: 'dark', l: 'Dark Glass' },
  { v: 'frosted', l: 'Frosted' },
  { v: 'blue', l: 'Blue Haze' },
  { v: 'green', l: 'Mint' },
  { v: 'amber', l: 'Amber' },
  { v: 'violet', l: 'Violet' },
  { v: 'teal', l: 'Teal' },
  { v: 'sunset', l: 'Sunset' },
];

// Helper component to render selected widget template
const WidgetTemplatePreview = ({ iconTemplate, state }) => {
  const Component = iconTemplates[iconTemplate]?.component;
  return Component ? <Component state={state} /> : null;
};

// Garde couleur : accepte #rrggbb ou rgba(...), sinon #1a5276 (comme App.jsx)
const safeHex = (value) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#1a5276';

export default function AppearancePanel({ uiLanguage: uiLanguageProp }) {
  const [backendLanguage] = useUiLanguage();
  const uiLanguage = uiLanguageProp || backendLanguage;
  const client = apiClient;
  const translate = useMemo(() => createTranslator(uiLanguage), [uiLanguage]);
  const t = (key, fallback = key) => {
    const result = translate(key);
    // createTranslator returns the key itself when absent — use fallback if so
    return result === key ? fallback : result;
  };

  const [appearance, setAppearance] = useState({ ...DEFAULT_APPEARANCE });
  const [widgetAppearance, setWidgetAppearance] = useState({ ...DEFAULT_WIDGET_APPEARANCE });

  // Fetch current appearance on mount
  useEffect(() => {
    client.getStatus()
      .then((data) => {
        if (data.appearance) setAppearance({ ...DEFAULT_APPEARANCE, ...data.appearance });
        if (data.widget_appearance) setWidgetAppearance({ ...DEFAULT_WIDGET_APPEARANCE, ...data.widget_appearance });
      })
      .catch(() => {});
  }, [client]);

  const update = (field, value) => {
    const newApp = { ...appearance, [field]: value };
    setAppearance(newApp);
    client.setTheme(newApp).catch(() => {});
  };

  const updateWidget = (field, value) => {
    const newApp = { ...widgetAppearance, [field]: value };
    setWidgetAppearance(newApp);
    client.setWidgetTheme(newApp).catch(() => {});
  };

  return (
    <div className="settings-panel appearance-panel fade-in">
      <h2 className="appearance-section-title">{t('dashboard_appearance')}</h2>

      <div className="setting-group">
        <h3>
          <Layout size={18} /> {t('theme_template')}
        </h3>
        <div className="theme-selector">
          {THEME_VARIANTS.map((opt) => (
            <button
              key={opt.v}
              className={`theme-btn ${appearance.themeVariant === opt.v ? 'active' : ''} variant-${opt.v}`}
              onClick={() => update('themeVariant', opt.v)}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-group">
        <h3>
          <Droplet size={18} /> {t('bg_translucency')}
        </h3>
        <div className="setting-row">
          <div className="label">
            <span>{t('bg_color')}</span>
          </div>
          <input
            type="color"
            value={safeHex(appearance.bgColor)}
            onChange={(e) => update('bgColor', e.target.value)}
          />
        </div>
        <div className="setting-row">
          <div className="label">
            <span>{t('opacity')} ({appearance.bgOpacity}%)</span>
          </div>
          <div className="range-group">
            <input
              type="range"
              min="0"
              max="100"
              value={appearance.bgOpacity}
              onChange={(e) => update('bgOpacity', Number(e.target.value))}
            />
          </div>
        </div>
        <div className="setting-row">
          <div className="label">
            <span>{t('blur_effect')} ({appearance.blur}px)</span>
          </div>
          <div className="range-group">
            <input
              type="range"
              min="0"
              max="30"
              value={appearance.blur}
              onChange={(e) => update('blur', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="setting-group">
        <h3>
          <Layers size={18} /> {t('borders_corners')}
        </h3>
        <div className="setting-row">
          <div className="label">
            <span>{t('border_color')}</span>
          </div>
          <input
            type="color"
            value={safeHex(appearance.borderColor)}
            onChange={(e) => update('borderColor', e.target.value)}
          />
        </div>
        <div className="setting-row">
          <div className="label">
            <span>{t('style')}</span>
          </div>
          <select
            value={appearance.borderStyle}
            onChange={(e) => update('borderStyle', e.target.value)}
          >
            <option value="none">{t('none')}</option>
            <option value="thin">{t('thin')}</option>
            <option value="thick">{t('thick')}</option>
          </select>
        </div>
        <div className="setting-row">
          <div className="label">
            <span>{t('corner_radius')} ({appearance.borderRadius}px)</span>
          </div>
          <div className="range-group">
            <input
              type="range"
              min="0"
              max="30"
              value={appearance.borderRadius}
              onChange={(e) => update('borderRadius', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <h2 className="appearance-section-title">{t('widget_appearance')}</h2>
      <p
        style={{
          fontSize: '0.85rem',
          color: 'var(--text-dim)',
          marginBottom: '1rem',
        }}
      >
        {t('widget_appearance_hint')}
      </p>

      <div className="setting-group">
        <h3>
          <Package size={18} /> {t('icon_templates')}
        </h3>
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-dim)',
            marginBottom: '1rem',
          }}
        >
          {t('select_icon')}
        </p>
        <div className="icon-grid">
          {Object.keys(iconTemplates).map((tpl) => (
            <div
              key={tpl}
              className={`icon-card ${widgetAppearance.iconTemplate === tpl ? 'active' : ''}`}
              onClick={() => updateWidget('iconTemplate', tpl)}
            >
              <div className="icon-preview">
                <WidgetTemplatePreview iconTemplate={tpl} state="idle" />
              </div>
              <div className="icon-name">{tpl}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="setting-group">
        <h3>
          <Droplet size={18} /> {t('bg_translucency')}
        </h3>
        <div className="setting-row">
          <div className="label">
            <span>{t('bg_color')}</span>
          </div>
          <input
            type="color"
            value={safeHex(widgetAppearance.bgColor)}
            onChange={(e) => updateWidget('bgColor', e.target.value)}
          />
        </div>
        <div className="setting-row">
          <div className="label">
            <span>{t('opacity')} ({widgetAppearance.bgOpacity}%)</span>
          </div>
          <div className="range-group">
            <input
              type="range"
              min="0"
              max="100"
              value={widgetAppearance.bgOpacity}
              onChange={(e) => updateWidget('bgOpacity', Number(e.target.value))}
            />
          </div>
        </div>
        <div className="setting-row">
          <div className="label">
            <span>{t('blur_effect')} ({widgetAppearance.blur}px)</span>
          </div>
          <div className="range-group">
            <input
              type="range"
              min="0"
              max="30"
              value={widgetAppearance.blur}
              onChange={(e) => updateWidget('blur', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="setting-group">
        <h3>
          <Layers size={18} /> {t('borders_corners')}
        </h3>
        <div className="setting-row">
          <div className="label">
            <span>{t('border_color')}</span>
          </div>
          <input
            type="color"
            value={safeHex(widgetAppearance.borderColor)}
            onChange={(e) => updateWidget('borderColor', e.target.value)}
          />
        </div>
        <div className="setting-row">
          <div className="label">
            <span>{t('style')}</span>
          </div>
          <select
            value={widgetAppearance.borderStyle}
            onChange={(e) => updateWidget('borderStyle', e.target.value)}
          >
            <option value="none">{t('none')}</option>
            <option value="thin">{t('thin')}</option>
            <option value="thick">{t('thick')}</option>
          </select>
        </div>
        <div className="setting-row">
          <div className="label">
            <span>{t('corner_radius')} ({widgetAppearance.borderRadius}px)</span>
          </div>
          <div className="range-group">
            <input
              type="range"
              min="0"
              max="30"
              value={widgetAppearance.borderRadius}
              onChange={(e) => updateWidget('borderRadius', Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
