import React, { useState, useEffect, useMemo } from "react";
import { apiClient } from "./clients";
import { createPlatformAdapter } from "./platformAdapter";
import { createTranslator } from "./i18n.js";
import { useUiLanguage } from "./useUiLanguage";
import { Cpu, Zap, Languages, Monitor, Mic, Keyboard, Info } from "lucide-react";
import "../App.css";

const DEFAULT_SHORTCUTS = {
  push_to_talk: ["Ctrl", "Alt"],
  push_to_block: ["Ctrl", "Shift"],
};

const isShortcutMap = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const formatShortcut = (keys) =>
  Array.isArray(keys) ? keys.join(" + ") : String(keys ?? "");
const formatShortcutName = (name) =>
  name
    .split("_")
    .map((part, index) => {
      const word = part.charAt(0).toUpperCase() + part.slice(1);
      return index === 0 ? word : word.toLowerCase();
    })
    .join(" ");
// Initialize platform adapter (Electron or web mock)
const platformAdapter = createPlatformAdapter();

// Panel to configure language, engine, audio device, quality and autostart.
export default function SettingsPanel({ uiLanguage: uiLanguageProp }) {
  const [backendLanguage] = useUiLanguage();
  const uiLanguage = uiLanguageProp || backendLanguage;
  const client = apiClient;
  const t = useMemo(() => createTranslator(uiLanguage), [uiLanguage]);
  const translate = (key, fallback = key) => {
    const result = t(key);
    return result === key ? fallback : result;
  };

  const [languages, setLanguages] = useState({});
  const [engines, setEngines] = useState([]);
  const [devices, setDevices] = useState([]);
  const [config, setConfig] = useState({
    language: "",
    engine: "",
    device: "",
    model_size: "",
  });
  const [autostart, setAutostart] = useState(false);
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [recordingShortcut, setRecordingShortcut] = useState(null);
  const [tempShortcut, setTempShortcut] = useState([]);
  const [engineKey, setEngineKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [cloudModel, setCloudModel] = useState("");
  const [keySaved, setKeySaved] = useState(false);

  // Load initial data
  useEffect(() => {
    client
      .getLanguages()
      .then((data) => {
        setLanguages(data.languages || {});
        setConfig((c) => ({ ...c, language: data.current || c.language }));
      })
      .catch(() => {});
    client
      .getEngines()
      .then((data) => {
        setEngines(data.engines || []);
        setConfig((c) => ({ ...c, engine: data.current || c.engine }));
      })
      .catch(() => {});
    client
      .getDevices()
      .then((data) => {
        setDevices(data.devices || []);
      })
      .catch(() => {});
    client
      .getStatus()
      .then((data) => {
        setConfig((c) => ({
          ...c,
          language: data.language || c.language,
          engine: data.engine || c.engine,
          device: data.device ?? c.device,
          model_size: data.model_size || c.model_size,
        }));
        if (isShortcutMap(data.shortcuts)) setShortcuts(data.shortcuts);
      })
      .catch(() => {});
    client
      .getShortcuts()
      .then((data) => {
        if (isShortcutMap(data.shortcuts)) setShortcuts(data.shortcuts);
      })
      .catch(() => {});
    // Autostart via platformAdapter (Electron only)
    platformAdapter
      .getAutostart?.()
      .then((res) => {
        if (res && typeof res.enabled === "boolean") setAutostart(res.enabled);
      })
      .catch(() => {});
  }, [client]);

  const updateSetting = async (key, value) => {
    try {
      if (key === "quality")
        await client.post("/settings/quality", { quality: value });
      else if (key === "language")
        await client.post("/settings/language", { language: value });
      else if (key === "engine")
        await client.post("/settings/engine", { engine: value });
      else if (key === "device") await client.post("/device", { id: value });
      setConfig((c) => ({
        ...c,
        [key === "quality"
          ? "model_size"
          : key === "device"
            ? "device_id"
            : key]: value,
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleAutostart = async () => {
    if (!platformAdapter.setAutostart) return;
    try {
      const res = await platformAdapter.setAutostart(!autostart);
      if (res && typeof res.enabled === "boolean") setAutostart(res.enabled);
      else setAutostart(!autostart);
    } catch (e) {
      console.error(e);
    }
  };

  const resetShortcuts = async () => {
    try {
      await client.setShortcuts(DEFAULT_SHORTCUTS);
      setShortcuts(DEFAULT_SHORTCUTS);
    } catch (e) {
      console.error(e);
    }
  };

  // Capture clavier façon legacy : "Modifier" puis appui sur les touches
  const startRecordingShortcut = (name) => {
    setRecordingShortcut(name);
    setTempShortcut([]);
  };

  const saveShortcut = async () => {
    if (!recordingShortcut || tempShortcut.length === 0) return;
    const next = { ...shortcuts, [recordingShortcut]: tempShortcut };
    try {
      await client.setShortcuts(next);
      setShortcuts(next);
      setRecordingShortcut(null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!recordingShortcut) return;
    const handleKeyDown = (e) => {
      e.preventDefault();
      let key = e.key;
      if (key === "Control") key = "Ctrl";
      if (key === " ") key = "Space";
      setTempShortcut((prev) =>
        prev.includes(key) ? prev : [...prev, key],
      );
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [recordingShortcut]);

  const shortcutEntries = isShortcutMap(shortcuts)
    ? Object.entries(shortcuts)
    : [];

  // Provider cloud selectionne : champ cle + modele (+ base_url pour custom)
  const selectedEngine = engines.find(
    (eng) => (eng.id ?? eng) === config.engine,
  );
  const saveEngineConfig = async () => {
    try {
      const payload = { provider: config.engine };
      if (engineKey.trim()) payload.key = engineKey.trim();
      if (cloudModel) payload.model = cloudModel;
      if (selectedEngine?.custom) {
        payload.base_url = customBaseUrl.trim();
        if (customModel.trim()) payload.model = customModel.trim();
      }
      await client.setEngineConfig(payload);
      setKeySaved(true);
      setEngineKey("");
      // Recharger la liste : le provider passe en "configured"
      const data = await client.getEngines();
      setEngines(data.engines || []);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="settings-panel fade-in">
      <div className="setting-group">
        <h3>
          <Cpu size={18} /> {translate("transcription", "Transcription")}
        </h3>
        <div className="setting-row">
          <div className="label">
            <Cpu size={18} />
            <span>{translate("transcription_quality", "Qualité")}</span>
          </div>
          <select
            value={config.model_size}
            onChange={(e) => updateSetting("quality", e.target.value)}
          >
            <option value="tiny">{translate("eco", "Éco")}</option>
            <option value="base">{translate("standard", "Standard")}</option>
            <option value="small">{translate("high", "Haute")}</option>
            <option value="medium">{translate("pro", "Pro")}</option>
            <option value="large">
              {translate("max_quality", "Qualité max")}
            </option>
          </select>
        </div>
        <div className="setting-row">
          <div className="label">
            <Zap size={18} />
            <span>{translate("transcription_engine", "Moteur")}</span>
          </div>
          <select
            value={config.engine}
            onChange={(e) => {
              setKeySaved(false);
              updateSetting("engine", e.target.value);
            }}
          >
            {engines.map((eng) => (
              <option key={eng.id ?? eng} value={eng.id ?? eng}>
                {eng.label ?? eng}
                {eng.remote ? (eng.configured ? " ☁️" : " ☁️ (clé requise)") : " 💻"}
              </option>
            ))}
          </select>
        </div>
        {selectedEngine?.remote && (
          <div className="setting-group">
            <h3>☁️ {selectedEngine.label}</h3>
            <div className="setting-row">
              <div className="label">
                <span>{translate("api_key", "Clé API")} ({selectedEngine.requires_key})</span>
              </div>
              <input
                type="password"
                value={engineKey}
                placeholder={
                  selectedEngine.configured
                    ? "•••••••• (configurée)"
                    : translate("enter_api_key", "Entrez la clé API")
                }
                onChange={(e) => setEngineKey(e.target.value)}
              />
            </div>
            {selectedEngine.custom && (
              <>
                <div className="setting-row">
                  <div className="label">
                    <span>Base URL</span>
                  </div>
                  <input
                    type="text"
                    value={customBaseUrl}
                    placeholder="https://api.exemple.com/v1"
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                  />
                </div>
                <div className="setting-row">
                  <div className="label">
                    <span>{translate("model", "Modèle")}</span>
                  </div>
                  <input
                    type="text"
                    value={customModel}
                    placeholder="whisper-1"
                    onChange={(e) => setCustomModel(e.target.value)}
                  />
                </div>
              </>
            )}
            {Object.keys(selectedEngine.models || {}).length > 0 && (
              <div className="setting-row">
                <div className="label">
                  <span>{translate("model", "Modèle")}</span>
                </div>
                <select
                  value={cloudModel || selectedEngine.default_model}
                  onChange={(e) => setCloudModel(e.target.value)}
                >
                  {Object.entries(selectedEngine.models).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="setting-row">
              <div className="label">
                <span>
                  {keySaved
                    ? "✅ " + translate("saved", "Enregistré")
                    : selectedEngine.configured
                      ? translate("key_configured", "Clé configurée — modifiable ci-dessus")
                      : translate("key_required", "Clé requise pour activer ce moteur")}
                </span>
              </div>
              <button className="theme-btn" onClick={saveEngineConfig}>
                {translate("save", "Enregistrer")}
              </button>
            </div>
          </div>
        )}
        <div className="setting-row">
          <div className="label">
            <Languages size={18} />
            <span>{translate("main_language", "Langue")}</span>
          </div>
          <select
            value={config.language}
            onChange={(e) => updateSetting("language", e.target.value)}
          >
            {Object.entries(languages).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="setting-row">
          <div className="label">
            <Monitor size={18} />
            <span>{translate("start_with_windows", "Démarrer avec Windows")}</span>
          </div>
          <input type="checkbox" checked={autostart} onChange={toggleAutostart} />
        </div>
      </div>

      <div className="setting-group">
        <h3>
          <Mic size={18} /> {translate("audio", "Audio")}
        </h3>
        <div className="setting-row">
          <div className="label">
            <Mic size={18} />
            <span>{translate("audio_input", "Périphérique audio")}</span>
          </div>
          <select
            value={config.device}
            onChange={(e) => updateSetting("device", e.target.value)}
          >
            {devices.map((dev) => (
              <option key={dev.id} value={dev.id}>
                {dev.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="info-box">
        <Info size={18} />
        <p>{translate("local_process_notice", "Traitement 100 % local")}</p>
      </div>

      {shortcutEntries.length > 0 && (
        <div className="setting-group">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h3>
              <Keyboard size={18} /> {translate("shortcuts", "Raccourcis")}
            </h3>
            <button
              className="theme-btn"
              onClick={resetShortcuts}
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}
            >
              {translate("reset_default", "Défaut")}
            </button>
          </div>
          {shortcutEntries.map(([name, keys]) => (
            <div key={name} className="setting-row">
              <div className="label">
                <span>{translate(name, formatShortcutName(name))}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
              >
                <div
                  className={`shortcut-display ${recordingShortcut === name ? "recording" : ""}`}
                >
                  {recordingShortcut === name
                    ? tempShortcut.length > 0
                      ? tempShortcut.join(" + ")
                      : translate("press_keys", "Appuyez sur les touches...")
                    : formatShortcut(keys)}
                </div>
                {recordingShortcut === name ? (
                  <>
                    <button
                      className="theme-btn active"
                      onClick={saveShortcut}
                    >
                      OK
                    </button>
                    <button
                      className="theme-btn"
                      onClick={() => setRecordingShortcut(null)}
                    >
                      {translate("cancel", "Annuler")}
                    </button>
                  </>
                ) : (
                  <button
                    className="theme-btn"
                    onClick={() => startRecordingShortcut(name)}
                  >
                    {translate("modify", "Modifier")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
