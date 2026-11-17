import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Mic,
  Play,
  Square,
  Trash2,
  History,
  Settings,
  Monitor,
  Languages,
  Cpu,
  Globe,
  Info,
  Palette,
  Keyboard,
  Layout,
  Droplet,
  Layers,
  Sun,
  Minus,
  X,
  Maximize,
  Package,
  Zap,
} from "lucide-react";
import AboutPanel from "./reactflow-migration/AboutPanel";
import logo from "./assets/logo.svg";
import "./App.css";
import { translations } from "./translations";

const API_BASE = "http://localhost:5000/api";

const WindowControls = () => {
  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => window.electronAPI?.maximizeWindow();
  const handleClose = () => window.electronAPI?.closeWindow();

  return (
    <div className="window-controls">
      <button
        onClick={handleMinimize}
        className="control-btn minimize"
        title="Minimize"
      >
        <Minus size={14} />
      </button>
      <button
        onClick={handleMaximize}
        className="control-btn maximize"
        title="Maximize"
      >
        <Square size={12} />
      </button>
      <button onClick={handleClose} className="control-btn close" title="Close">
        <X size={14} />
      </button>
    </div>
  );
};

const App = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [status, setStatus] = useState("Prêt");
  const [isRecording, setIsRecording] = useState(false);
  const [history, setHistory] = useState([]);
  const [devices, setDevices] = useState([]);
  const [languages, setLanguages] = useState({});
  const [theme, setTheme] = useState("glass");
  const [appearance, setAppearance] = useState({
    themeVariant: "glass",
    bgColor: "#1a5276",
    bgOpacity: 70,
    blur: 10,
    borderRadius: 12,
    borderColor: "#2e86c1",
    borderStyle: "thin",
  });
  // Apparence du widget flottant : indépendante du dashboard
  const [widgetAppearance, setWidgetAppearance] = useState({
    themeVariant: "glass",
    bgColor: "#1a5276",
    bgOpacity: 70,
    blur: 10,
    borderRadius: 12,
    borderColor: "#2e86c1",
    borderStyle: "thin",
    iconTemplate: "scrybe",
  });
  const [shortcuts, setShortcuts] = useState({
    push_to_talk: ["Ctrl", "Alt"],
    push_to_block: ["Ctrl", "Shift"],
  });
  const [config, setConfig] = useState({
    language: "fr",
    model_size: "small",
    device_id: null,
  });
  const [uiLanguage, setUiLanguage] = useState("fr");
  // useRef : le compteur est lu dans le callback d'intervalle — un state créerait
  // une closure figée et l'erreur API ne s'afficherait jamais (bug B5)
  const apiErrorCountRef = React.useRef(0);
  const [recordingShortcut, setRecordingShortcut] = useState(null); // 'push_to_talk' | 'push_to_block' | null
  const [tempShortcut, setTempShortcut] = useState([]);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [engine, setEngine] = useState("faster_whisper");
  const [engines, setEngines] = useState([]);
  const [device, setDevice] = useState(null);
  // Refs lus par les callbacks SSE/polling — évitent les closures figées
  const isRecordingRef = React.useRef(isRecording);
  isRecordingRef.current = isRecording;
  const sseFailedRef = React.useRef(false);
  // Translation helper
  const t = (key) =>
    translations[uiLanguage]?.[key] || translations["en"]?.[key] || key;

  // Refs pour les callbacks SSE/polling : évitent les closures figées au montage.
  // Initialiser sans lire t protège le premier rendu contre une version HMR
  // périmée qui réordonnerait les déclarations pendant le remplacement à chaud.
  const tRef = React.useRef(null);
  tRef.current = t;
  const listsRef = React.useRef({ devices: 0, languages: 0, history: 0 });
  listsRef.current = {
    devices: devices.length,
    languages: Object.keys(languages).length,
    history: history.length,
  };

  // Ref to prevent polling from overriding manual theme changes
  const lastManualUpdate = React.useRef(0);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/history`);
      setHistory(res.data.history);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await axios.get(`${API_BASE}/devices`);
      setDevices(res.data.devices);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLanguages = async () => {
    try {
      const res = await axios.get(`${API_BASE}/languages`);
      setLanguages(res.data.languages);
      setConfig((prev) => ({ ...prev, language: res.data.current }));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEngines = async () => {
    try {
      const res = await axios.get(`${API_BASE}/engines`);
      setEngines(res.data.engines);
      if (res.data.current) setEngine(res.data.current);
    } catch (e) {
      console.error(e);
    }
  };

  // SSE : le backend Pousse les changements d'état — fini le polling intensif.
  // Filet de sécurité : si SSE tombe, un polling lent (5s) prend le relais.
  useEffect(() => {
    const applyStatus = (data) => {
      // Rafraîchir l'historique à la fin d'un enregistrement
      if (isRecordingRef.current && !data.is_recording) fetchHistory();
      apiErrorCountRef.current = 0;
      setStatus(data.status);
      setIsRecording(data.is_recording);

      // Ne pas écraser une modification d'apparence manuelle récente (3s)
      const now = Date.now();
      if (data.appearance && now - lastManualUpdate.current > 3000) {
        setAppearance(data.appearance);
        setTheme(data.appearance.themeVariant);
        if (data.appearance.uiLanguage)
          setUiLanguage(data.appearance.uiLanguage);
      }
      if (data.widget_appearance && now - lastManualUpdate.current > 3000) {
        setWidgetAppearance((prev) => ({ ...prev, ...data.widget_appearance }));
      }
      if (data.shortcuts) setShortcuts(data.shortcuts);
      if (data.engine) setEngine(data.engine);
      setDevice(
        data.device
          ? `${data.device}${data.compute_type ? ` (${data.compute_type})` : ""}`
          : null,
      );

      // Si le backend a démarré après le frontend, les listes restent
      // vides : retenter à la prochaine réception d'état
      if (listsRef.current.devices === 0) fetchDevices();
      if (listsRef.current.languages === 0) fetchLanguages();
      if (listsRef.current.history === 0) fetchHistory();
    };

    // Remonter les erreurs JS du renderer vers logs/frontend.log
    const reportError = (msg) => {
      axios
        .post(`${API_BASE}/log`, {
          level: "error",
          source: "app",
          message: String(msg).slice(0, 2000),
        })
        .catch(() => {});
    };
    const onError = (e) =>
      reportError(`${e.message} @${e.filename}:${e.lineno}`);
    const onRejection = (e) => reportError(`unhandledrejection: ${e.reason}`);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // Chargement initial des métadonnées
    fetchDevices();
    fetchLanguages();
    fetchHistory();
    fetchEngines();

    const es = new EventSource(`${API_BASE}/events`);
    es.onopen = () => {
      sseFailedRef.current = false;
      // (Re)connexion SSE -> backend joignable : re-synchroniser les métadonnées
      fetchDevices();
      fetchLanguages();
      fetchHistory();
      fetchEngines();
    };
    es.onerror = () => {
      sseFailedRef.current = true;
    };
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "status" && msg.data) applyStatus(msg.data);
        else if (msg.type === "history") fetchHistory();
      } catch {
        /* message malformé : ignorer */
      }
    };

    const fallback = setInterval(async () => {
      if (!sseFailedRef.current) return; // SSE vivant -> rien à faire
      try {
        const res = await axios.get(`${API_BASE}/status`);
        applyStatus(res.data);
      } catch (e) {
        console.error(e);
        apiErrorCountRef.current += 1;
        if (apiErrorCountRef.current > 2) {
          setStatus(tRef.current("api_error"));
        }
      }
    }, 5000);

    return () => {
      es.close();
      clearInterval(fallback);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const getTranslatedStatus = (rawStatus) => {
    if (rawStatus === "Prêt") return t("ready_to_dictate");
    if (rawStatus.includes("Enregistrement (PTT)")) return t("recording_ptt");
    if (rawStatus.includes("Enregistrement")) return t("recording");
    if (rawStatus.includes("Transcription")) return t("transcribing");
    if (rawStatus.includes("Chargement du modèle")) return t("loading_model");
    return rawStatus;
  };

  // Navigation pilotée par le menu tray (Paramètres, etc.)
  useEffect(() => {
    if (
      window.electronAPI &&
      typeof window.electronAPI.onNavigate === "function"
    ) {
      window.electronAPI.onNavigate((tab) => {
        if (typeof tab === "string") {
          setActiveTab(tab);
        }
      });
    }
    // Vérifier si une navigation est en attente (depuis second-instance ou tray)
    if (
      window.electronAPI &&
      typeof window.electronAPI.getPendingNavigate === "function"
    ) {
      const pending = window.electronAPI.getPendingNavigate();
      if (pending) {
        // Différé : setState synchrone dans un effet = cascading renders (eslint)
        setTimeout(() => setActiveTab(pending), 0);
      }
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.getAutostart) return;
    window.electronAPI
      .getAutostart()
      .then((res) => {
        if (res && typeof res.enabled === "boolean") {
          setAutostartEnabled(res.enabled);
        }
      })
      .catch((e) => console.error(e));
  }, []);

  const toggleRecording = async () => {
    try {
      await axios.post(`${API_BASE}/toggle_recording`);
      if (isRecording) {
        // Just stopped, wait a bit then refresh history
        setTimeout(fetchHistory, 2000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteItem = async (id) => {
    try {
      await axios.delete(`${API_BASE}/delete_transcription/${id}`);
      fetchHistory();
    } catch (e) {
      console.error(e);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      if (key === "quality") {
        await axios.post(`${API_BASE}/settings/quality`, { quality: value });
      } else if (key === "language") {
        await axios.post(`${API_BASE}/settings/language`, { language: value });
      } else if (key === "engine") {
        await axios.post(`${API_BASE}/settings/engine`, { engine: value });
      } else if (key === "device") {
        await axios.post(`${API_BASE}/device`, { id: value });
      }
      // Refresh local config state
      if (key === "engine") setEngine(value);
      setConfig((prev) => ({
        ...prev,
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

  const updateAppearance = async (field, value) => {
    try {
      lastManualUpdate.current = Date.now();
      const newAppearance = { ...appearance, [field]: value };
      setAppearance(newAppearance);
      if (field === "themeVariant") setTheme(value);

      await axios.post(`${API_BASE}/settings/theme`, newAppearance);
    } catch (e) {
      console.error(e);
    }
  };

  const updateWidgetAppearance = async (field, value) => {
    try {
      // eslint-disable-next-line react-hooks/purity
      lastManualUpdate.current = Date.now();
      const newWidgetAppearance = { ...widgetAppearance, [field]: value };
      setWidgetAppearance(newWidgetAppearance);
      await axios.post(
        `${API_BASE}/settings/widget_theme`,
        newWidgetAppearance,
      );
    } catch (e) {
      console.error(e);
    }
  };

  const startRecordingShortcut = (type) => {
    setRecordingShortcut(type);
    setTempShortcut([]);
  };

  const saveShortcut = async () => {
    if (!recordingShortcut || tempShortcut.length === 0) return;
    const newShortcuts = { ...shortcuts, [recordingShortcut]: tempShortcut };
    try {
      await axios.post(`${API_BASE}/shortcuts`, { shortcuts: newShortcuts });
      setShortcuts(newShortcuts);
      setRecordingShortcut(null);
    } catch (e) {
      console.error(e);
    }
  };

  const resetShortcuts = async () => {
    const defaults = {
      push_to_talk: ["Ctrl", "Alt"],
      push_to_block: ["Ctrl", "Shift"],
    };
    try {
      await axios.post(`${API_BASE}/shortcuts`, { shortcuts: defaults });
      setShortcuts(defaults);
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

      setTempShortcut((prev) => {
        if (prev.includes(key)) return prev;
        return [...prev, key];
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [recordingShortcut]);

  const toggleAutostart = async () => {
    if (!window.electronAPI || !window.electronAPI.setAutostart) return;
    try {
      const res = await window.electronAPI.setAutostart(!autostartEnabled);
      if (res && typeof res.enabled === "boolean") {
        setAutostartEnabled(res.enabled);
      } else {
        setAutostartEnabled(!autostartEnabled);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // La fenêtre suit le contenu : à chaque changement d'onglet, on mesure la
  // hauteur réelle et on demande au main process d'ajuster (borné côté main)
  useEffect(() => {
    if (!window.electronAPI?.resizeToContent) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const content = document.querySelector(".content");
        const sidebar = document.querySelector(".sidebar");
        const h = Math.max(
          content?.scrollHeight || 0,
          sidebar?.scrollHeight || 0,
        );
        if (h > 0) window.electronAPI.resizeToContent(1000, h + 24);
      }),
    );
    return () => cancelAnimationFrame(id);
  }, [activeTab]);

  const themeClass = theme === "glass" ? "variant-glass" : `variant-${theme}`;

  // Garde : bgColor peut être corrompu en DB — on accepte #rrggbb ou rgba(...), sinon défaut (bug B9)
  const bgColor =
    typeof appearance.bgColor === "string" &&
    (/^#[0-9a-f]{6}$/i.test(appearance.bgColor) ||
      appearance.bgColor.startsWith("rgba"))
      ? appearance.bgColor
      : "#1a5276";
  // Pour <input type="color"> qui exige strictement #rrggbb
  const bgColorHex = /^#[0-9a-f]{6}$/i.test(bgColor) ? bgColor : "#1a5276";
  const dynamicStyle = {
    "--cur-bg": bgColor.includes("rgba")
      ? bgColor
      : `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${appearance.bgOpacity / 100})`,
    "--cur-blur": `${appearance.blur}px`,
    "--cur-radius": `${appearance.borderRadius}px`,
    "--cur-border-color": appearance.borderColor,
    "--cur-border-width":
      appearance.borderStyle === "thin"
        ? "1px"
        : appearance.borderStyle === "thick"
          ? "3px"
          : "0px",
    // blur=0 : couper backdrop-filter — sur fenêtre transparente, même
    // blur(0)+saturate() force une passe de compositing permanente et
    // rend les clics lents (GPU 1050 / DWM Windows)
    ...(Number(appearance.blur) > 0
      ? {}
      : { backdropFilter: "none", WebkitBackdropFilter: "none" }),
  };

  return (
    <div className={`app-container ${themeClass}`} style={dynamicStyle}>
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="logo">
          <img
            src={logo}
            alt="Scrybe"
            className="logo-img"
            style={{
              width: 56,
              height: 56,
              objectFit: "contain",
              marginRight: 10,
            }}
          />
          <span>The Scrybe</span>
        </div>
        <div className="nav-items">
          <button
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <Monitor size={20} />
            <span>{t("dashboard")}</span>
          </button>
          <button
            className={`nav-item ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <History size={20} />
            <span>{t("history")}</span>
          </button>
          <button
            className={`nav-item ${activeTab === "appearance" ? "active" : ""}`}
            onClick={() => setActiveTab("appearance")}
          >
            <Palette size={20} />
            <span>{t("appearance")}</span>
          </button>
          <button
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <Settings size={20} />
            <span>{t("settings")}</span>
          </button>
          <button
            className={`nav-item ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
          >
            <Info size={20} />
            <span>{t("about")}</span>
          </button>
        </div>
        <div className="sidebar-footer">
          <div className="status-indicator">
            <div className={`status-dot ${isRecording ? "pulse" : ""}`}></div>
            <span>{getTranslatedStatus(status)}</span>
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
              style={{
                width: 48,
                height: 48,
                marginRight: 12,
                verticalAlign: "middle",
              }}
            />
            <h1>{t(activeTab)}</h1>
          </div>
          <div className="header-right">
            <div className="user-info" style={{ marginRight: "1rem" }}>
              <span className="badge">{t("local_engine")}</span>
            </div>
            <WindowControls />
          </div>
        </header>

        <div className="content-body">
          {activeTab === "dashboard" && (
            <div className="dashboard-grid fade-in">
              <div className="main-card record-card">
                <div className="recording-viz">
                  <div
                    className={`ring ${isRecording ? "animating" : ""}`}
                  ></div>
                  <button
                    className={`mic-btn ${isRecording ? "recording" : ""}`}
                    onClick={toggleRecording}
                  >
                    {isRecording ? (
                      <Square size={32} fill="white" />
                    ) : (
                      <Play size={32} fill="white" />
                    )}
                  </button>
                </div>
                <h2>{getTranslatedStatus(status)}</h2>
                <p className="hint">{t("hint_record")}</p>
              </div>

              <div className="side-cards">
                <div className="mini-card">
                  <Cpu size={20} className="icon-violet" />
                  <div className="mini-info">
                    <h4>{t("quality")}</h4>
                    <p>
                      {t(
                        {
                          tiny: "eco",
                          base: "standard",
                          small: "high",
                          medium: "pro",
                          large: "max_quality",
                        }[config.model_size],
                      ) || config.model_size.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="mini-card">
                  <Languages size={20} className="icon-blue" />
                  <div className="mini-info">
                    <h4>{t("language")}</h4>
                    <p>{languages[config.language] || config.language}</p>
                  </div>
                </div>
              </div>

              <div className="full-width-card language-grid-card">
                <h3>
                  <Globe size={18} /> {t("select_transcription_language")}
                </h3>
                <div className="languages-grid">
                  {Object.entries(languages).map(([code, name]) => (
                    <div
                      key={code}
                      className={`lang-card ${config.language === code ? "active" : ""}`}
                      onClick={() => updateSetting("language", code)}
                    >
                      <div className="lang-icon">
                        {code === "fr"
                          ? "🇫🇷"
                          : code === "en"
                            ? "🇺🇸"
                            : code === "es"
                              ? "🇪🇸"
                              : code === "de"
                                ? "🇩🇪"
                                : code === "it"
                                  ? "🇮🇹"
                                  : code === "ja"
                                    ? "🇯🇵"
                                    : code === "zh"
                                      ? "🇨🇳"
                                      : "🌐"}
                      </div>
                      <div className="lang-name">{name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="history-list fade-in">
              {history.length === 0 ? (
                <div className="empty-state">
                  <History size={48} />
                  <p>{t("no_history")}</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="history-item">
                    <div className="item-content">
                      <p>{item.text}</p>
                      <span className="timestamp">{item.timestamp}</span>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="settings-panel fade-in">
              <div className="setting-group">
                <h3>{t("transcription")}</h3>
                <div className="setting-row">
                  <div className="label">
                    <Cpu size={18} />
                    <span>{t("transcription_quality")}</span>
                  </div>
                  <select
                    value={config.model_size}
                    onChange={(e) => updateSetting("quality", e.target.value)}
                  >
                    <option value="tiny">{t("eco")}</option>
                    <option value="base">{t("standard")}</option>
                    <option value="small">{t("high")}</option>
                    <option value="medium">{t("pro")}</option>
                    <option value="large">{t("max_quality")}</option>
                  </select>
                </div>
                <div className="setting-row">
                  <div className="label">
                    <Zap size={18} />
                    <span>{t("transcription_engine")}</span>
                  </div>
                  <select
                    value={engine}
                    onChange={(e) => updateSetting("engine", e.target.value)}
                  >
                    {engines.map((en) => (
                      <option key={en.id} value={en.id}>
                        {en.label}
                      </option>
                    ))}
                  </select>
                </div>
                {device && (
                  <div className="setting-row">
                    <div className="label">
                      <Cpu size={18} />
                      <span>Device</span>
                    </div>
                    <span className="badge">{device}</span>
                  </div>
                )}
                <div className="setting-row">
                  <div className="label">
                    <Languages size={18} />
                    <span>{t("main_language")}</span>
                  </div>
                  <select
                    value={uiLanguage}
                    onChange={(e) => {
                      const lang = e.target.value;
                      setUiLanguage(lang);
                      updateAppearance("uiLanguage", lang);
                    }}
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
                    <span>{t("start_with_windows")}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autostartEnabled}
                    onChange={toggleAutostart}
                  />
                </div>
              </div>

              <div className="setting-group">
                <h3>{t("audio")}</h3>
                <div className="setting-row">
                  <div className="label">
                    <Mic size={18} />
                    <span>{t("audio_input")}</span>
                  </div>
                  <select
                    value={config.device_id || ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!Number.isNaN(v)) updateSetting("device", v);
                    }}
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
                <p>{t("local_process_notice")}</p>
              </div>

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
                    <Keyboard size={18} /> {t("shortcuts")}
                  </h3>
                  <button
                    className="theme-btn"
                    onClick={resetShortcuts}
                    style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}
                  >
                    {t("reset_default")}
                  </button>
                </div>

                <div className="setting-row">
                  <div className="label">
                    <span>Push-to-Talk</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                    }}
                  >
                    <div
                      className={`shortcut-display ${recordingShortcut === "push_to_talk" ? "recording" : ""}`}
                    >
                      {recordingShortcut === "push_to_talk"
                        ? tempShortcut.length > 0
                          ? tempShortcut.join(" + ")
                          : t("press_keys")
                        : shortcuts.push_to_talk.join(" + ")}
                    </div>
                    {recordingShortcut === "push_to_talk" ? (
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
                          {t("cancel")}
                        </button>
                      </>
                    ) : (
                      <button
                        className="theme-btn"
                        onClick={() => startRecordingShortcut("push_to_talk")}
                      >
                        {t("modify")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="label">
                    <span>Push-to-Block</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                    }}
                  >
                    <div
                      className={`shortcut-display ${recordingShortcut === "push_to_block" ? "recording" : ""}`}
                    >
                      {recordingShortcut === "push_to_block"
                        ? tempShortcut.length > 0
                          ? tempShortcut.join(" + ")
                          : t("press_keys")
                        : shortcuts.push_to_block.join(" + ")}
                    </div>
                    {recordingShortcut === "push_to_block" ? (
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
                          {t("cancel")}
                        </button>
                      </>
                    ) : (
                      <button
                        className="theme-btn"
                        onClick={() => startRecordingShortcut("push_to_block")}
                      >
                        {t("modify")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="settings-panel appearance-panel fade-in">
              <h2 className="appearance-section-title">
                {t("dashboard_appearance")}
              </h2>
              <div className="setting-group">
                <h3>
                  <Layout size={18} /> {t("theme_template")}
                </h3>
                <div className="theme-selector">
                  {[
                    { v: "glass", l: "Glass" },
                    { v: "light", l: "Light Frost" },
                    { v: "dark", l: "Dark Glass" },
                    { v: "frosted", l: "Frosted" },
                    { v: "blue", l: "Blue Haze" },
                    { v: "green", l: "Mint" },
                    { v: "amber", l: "Amber" },
                    { v: "violet", l: "Violet" },
                    { v: "teal", l: "Teal" },
                    { v: "sunset", l: "Sunset" },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      className={`theme-btn ${theme === opt.v ? "active" : ""} variant-${opt.v}`}
                      onClick={() => updateAppearance("themeVariant", opt.v)}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <h3>
                  <Droplet size={18} /> {t("bg_translucency")}
                </h3>
                <div className="setting-row">
                  <div className="label">
                    <span>{t("bg_color")}</span>
                  </div>
                  <input
                    type="color"
                    value={bgColorHex}
                    onChange={(e) =>
                      updateAppearance("bgColor", e.target.value)
                    }
                  />
                </div>
                <div className="setting-row">
                  <div className="label">
                    <span>
                      {t("opacity")} ({appearance.bgOpacity}%)
                    </span>
                  </div>
                  <div className="range-group">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={appearance.bgOpacity}
                      onChange={(e) =>
                        updateAppearance("bgOpacity", parseInt(e.target.value))
                      }
                    />
                  </div>
                </div>
                <div className="setting-row">
                  <div className="label">
                    <span>
                      {t("blur_effect")} ({appearance.blur}px)
                    </span>
                  </div>
                  <div className="range-group">
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={appearance.blur}
                      onChange={(e) =>
                        updateAppearance("blur", parseInt(e.target.value))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="setting-group">
                <h3>
                  <Layers size={18} /> {t("borders_corners")}
                </h3>
                <div className="setting-row">
                  <div className="label">
                    <span>{t("border_color")}</span>
                  </div>
                  <input
                    type="color"
                    value={appearance.borderColor}
                    onChange={(e) =>
                      updateAppearance("borderColor", e.target.value)
                    }
                  />
                </div>
                <div className="setting-row">
                  <div className="label">
                    <span>{t("style")}</span>
                  </div>
                  <select
                    value={appearance.borderStyle}
                    onChange={(e) =>
                      updateAppearance("borderStyle", e.target.value)
                    }
                  >
                    <option value="none">{t("none")}</option>
                    <option value="thin">{t("thin")}</option>
                    <option value="thick">{t("thick")}</option>
                  </select>
                </div>
                <div className="setting-row">
                  <div className="label">
                    <span>
                      {t("corner_radius")} ({appearance.borderRadius}px)
                    </span>
                  </div>
                  <div className="range-group">
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={appearance.borderRadius}
                      onChange={(e) =>
                        updateAppearance(
                          "borderRadius",
                          parseInt(e.target.value),
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <h2 className="appearance-section-title">
                {t("widget_appearance")}
              </h2>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-dim)",
                  marginBottom: "1rem",
                }}
              >
                {t("widget_appearance_hint")}
              </p>

              <div className="setting-group">
                <h3>
                  <Layout size={18} /> {t("theme_template")}
                </h3>
                <div className="theme-selector">
                  {[
                    { v: "glass", l: "Glass" },
                    { v: "light", l: "Light Frost" },
                    { v: "dark", l: "Dark Glass" },
                    { v: "frosted", l: "Frosted" },
                    { v: "blue", l: "Blue Haze" },
                    { v: "green", l: "Mint" },
                    { v: "amber", l: "Amber" },
                    { v: "violet", l: "Violet" },
                    { v: "teal", l: "Teal" },
                    { v: "sunset", l: "Sunset" },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      className={`theme-btn ${widgetAppearance.themeVariant === opt.v ? "active" : ""} variant-${opt.v}`}
                      onClick={() =>
                        updateWidgetAppearance("themeVariant", opt.v)
                      }
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <h3>
                  <Package size={18} /> {t("icon_templates")}
                </h3>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-dim)",
                    marginBottom: "1rem",
                  }}
                >
                  {t("select_icon")}
                </p>
                <div className="icon-grid">
                  {[
                    "scrybe",
                    "waves",
                    "neon",
                    "cyber",
                    "orb",
                    "rings",
                    "echo",
                    "dot",
                    "shield",
                    "burst",
                    "equalizer",
                    "orbit",
                    "pulse",
                  ].map((tpl) => (
                    <div
                      key={tpl}
                      className={`icon-card ${widgetAppearance.iconTemplate === tpl ? "active" : ""}`}
                      onClick={() =>
                        updateWidgetAppearance("iconTemplate", tpl)
                      }
                    >
                      <div className="icon-name">{tpl}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <h3>
                  <Droplet size={18} /> {t("bg_translucency")}
                </h3>
                <div className="setting-row">
                  <div className="label">
                    <span>{t("bg_color")}</span>
                  </div>
                  <input
                    type="color"
                    value={widgetAppearance.bgColor}
                    onChange={(e) =>
                      updateWidgetAppearance("bgColor", e.target.value)
                    }
                  />
                </div>
                <div className="setting-row">
                  <div className="label">
                    <span>
                      {t("opacity")} ({widgetAppearance.bgOpacity}%)
                    </span>
                  </div>
                  <div className="range-group">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={widgetAppearance.bgOpacity}
                      onChange={(e) =>
                        updateWidgetAppearance(
                          "bgOpacity",
                          parseInt(e.target.value),
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="setting-group">
                <h3>
                  <Layers size={18} /> {t("borders_corners")}
                </h3>
                <div className="setting-row">
                  <div className="label">
                    <span>{t("border_color")}</span>
                  </div>
                  <input
                    type="color"
                    value={widgetAppearance.borderColor}
                    onChange={(e) =>
                      updateWidgetAppearance("borderColor", e.target.value)
                    }
                  />
                </div>
                <div className="setting-row">
                  <div className="label">
                    <span>{t("style")}</span>
                  </div>
                  <select
                    value={widgetAppearance.borderStyle}
                    onChange={(e) =>
                      updateWidgetAppearance("borderStyle", e.target.value)
                    }
                  >
                    <option value="none">{t("none")}</option>
                    <option value="thin">{t("thin")}</option>
                    <option value="thick">{t("thick")}</option>
                  </select>
                </div>
                <div className="setting-row">
                  <div className="label">
                    <span>
                      {t("corner_radius")} ({widgetAppearance.borderRadius}px)
                    </span>
                  </div>
                  <div className="range-group">
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={widgetAppearance.borderRadius}
                      onChange={(e) =>
                        updateWidgetAppearance(
                          "borderRadius",
                          parseInt(e.target.value),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "about" && <AboutPanel t={t} />}
        </div>
      </main>
    </div>
  );
};

export default App;
