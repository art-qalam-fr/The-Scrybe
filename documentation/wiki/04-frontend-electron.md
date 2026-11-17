# 04 — Frontend React + Electron (deep dive)

## `electron/main.cjs` (385 l.) — processus principal

### Ce qu'il fait au boot (`app.whenReady`, l.300-326)
1. `startPythonBackend()` — spawn `.venv/Scripts/python.exe backend/flask_api.py` (`env.PORT=5000`, `windowsHide:true`)
2. `createWindow()` — 1000×800, `show:false`, `frame:false`, `transparent`, `skipTaskbar:true`
3. `createWidgetWindow()` — 80×80 `alwaysOnTop`, même preload
4. `createTray()` — menu : Ouvrir / Widget / Paramètres / Quitter
5. `ensureDesktopContextMenu()` — **écrit dans HKCU** le sous-menu clic-droit Bureau (`runPowershell` + `ExecutionPolicy Bypass`, script temp dans %TMP%)
6. Dev : `setInterval(checkSignalFile, 1000)` — surveille `.scrybe-open-settings` (écrit par `Desk-top-settings.vbs`)

### Points de vigilance

- **B2** : ce spawn Flask + les scripts `.bat` qui font pareil = double backend
- `pythonProcess.kill()` (l.336) — pas de `/T` arbre → risque de python zombie gardant le port
- `mainWindow` hide-on-close (l.85-91) ; quit réel uniquement via tray "Quitter" (`isQuitting`)
- 4 mécanismes de navigation redondants : signal file, `SCRYBE_OPEN_SETTINGS`, `pendingNavigate` IPC sync, `second-instance --open-settings`
- Widget en prod : `file://.../index.html?window=widget` — query string sur file:// peu fiable (préférer hash)

## `electron/preload.cjs` (22 l.)

Expose `window.electronAPI` : minimize/maximize/closeWindow, get/setAutostart, onNavigate (+cleanup), getPendingNavigate (sendSync — bloquant, utilisé au boot App.jsx:152).
`setWidgetOpacity` exposé mais **handler ipcMain commenté** (main.cjs:340) → appel no-op silencieux.

## `src/App.jsx` (651 l.) — 4 onglets dans un seul composant

### Timers actifs (le nerf des perfs)

| Timer | Intervalle | Action |
|-------|-----------|--------|
| `setInterval` (l.96) | **500 ms** | GET `/api/status` + sync appearance/shortcuts + fetch conditionnels |
| `setInterval` (l.162) | 10 s | GET `/api/history` |
| `checkSignalFile` (main) | 1 s | fs existsSync (dev) |

### Bugs React

- **B5** deps `[isRecording, uiLanguage]` mais lit `devices/languages/history/apiErrorCount` → closures stales ; `apiErrorCount > 2` figé → jamais `api_error`
- **B8** `parseInt(e.target.value)` NaN sur select device vide (l.493)
- **B9** `appearance.bgColor.includes` sans garde de type (l.282)
- `window.uiLanguage` (l.21) — état global non réactif pour WindowControls
- Lock "manuel" `lastManualUpdate` 3 s (l.111) — bricolage anti-écrasement du thème par le polling

### Flux de données

- État local `useState` ×14 — pas de Context/store ; prop drilling léger
- `translations.js` (350 l.) : `t(key)` fallback FR→EN→key
- Apparence : envoyée entière à `/api/settings/theme` à chaque slider → sauvegarde SQLite côté backend à chaque input (spam DB pendant drag d'un range)

## `src/Widget.jsx` (308 l.)

- 10 templates SVG animés (`iconTemplates` l.240) pilotés par `appearance.iconTemplate`
- Poll `/api/status` 1 s (l.267)
- **Bug B7** : `dur * 1.5` sur string (l.62) → `NaNs`
- `template.component` JSX dynamique OK

## Communication — le problème central

```
React ──HTTP axios──▶ Flask ──▶ BackendLogic
      3 req/s permanentes
```

Pas de WebSocket/SSE/IPC : toute l'interactivité passe par polling HTTP vers un serveur Werkzeug dont le process partage le GIL avec PyTorch. **Pendant la transcription, l'API devient lente → l'UI semble "ramer"** — c'est la cause racine des ralentissements perçus (cf. audit P1/P2).
