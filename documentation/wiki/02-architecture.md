# 02 — Architecture réelle

## Vue d'ensemble

```mermaid
flowchart LR
    subgraph Electron["Processus Electron (frontend/electron/main.cjs)"]
        MW["BrowserWindow principale<br/>show:false, frame:false, transparent"]
        WW["WidgetWindow 80×80<br/>alwaysOnTop"]
        TRAY["Tray + menu contextuel<br/>+ registre HKCU Bureau"]
        SPAWN["spawn .venv/Scripts/python.exe<br/>backend/flask_api.py :5000"]
    end
    subgraph Renderer["React (Vite :5173 dev / dist prod)"]
        APP["App.jsx<br/>poll /api/status @500ms<br/>poll /api/history @10s"]
        WID["Widget.jsx<br/>poll /api/status @1s"]
    end
    subgraph Python["Backend Flask :5000 (backend/)"]
        API["flask_api.py<br/>routes REST"]
        BL["BackendLogic<br/>(singleton)"]
        AR["AudioRecorder<br/>thread sounddevice→WAV"]
        SR["SpeechRecognizer<br/>openai-whisper small"]
        HK["HotkeyManager<br/>pynput listener global"]
        TI["TextInjector<br/>pyperclip+Ctrl+V"]
        DB["DatabaseManager<br/>sqlite voice_dictation.db<br/>(CWD-relatif ⚠️)"]
    end
    MW --> APP
    WW --> WID
    SPAWN --> API
    APP -- "HTTP ~2 req/s" --> API
    WID -- "HTTP 1 req/s" --> API
    API --> BL
    BL --> AR & SR & HK & TI & DB
    HK -.->|start/stop_hold_recording| BL
    TI -->|Ctrl+V| OS["App avec focus (texte injecté)"]
```

## Choix d'architecture constatés

### Ce qui est bien fait

- **Preload minimal** (`preload.cjs`) : `contextIsolation:true`, `nodeIntegration:false`, surface IPC réduite à 6 méthodes
- **SQL bindé** partout dans `database_manager.py` — pas d'injection
- **Bind loopback** : Flask sur `127.0.0.1` (`flask_api.py:119`)
- **Single instance** Electron (`main.cjs:9-30`) + fenêtre hide-on-close = modèle "app résidente tray" cohérent
- **Threads daemon** pour transcription → l'API reste nominalement responsive

### Ce qui n'est pas bien fait

- **Bypass Electron** : le renderer parle HTTP à Flask ; Electron ne fait que spawner Python — pas de supervision, pas de healthcheck, pas d'IPC unifié
- **Backend lancé à deux endroits** : `main.cjs:301` **et** les scripts `.bat` → doublon port 5000 (B2)
- **DB en chemin relatif** → fragmentée selon le CWD de lancement (B3)
- **Polling plutôt qu'événementiel** : 3 timers HTTP permanents (P1)
- **`BackendLogic` god object** avec référence circulaire `HotkeyManager.app`
- **Apparence persistée côté backend** : préférences d'affichage dans SQLite derrière Flask → synchronisation fragile (lock 3 s `App.jsx:111`)

## Dépendances réelles vs déclarées

| Utilisé | Déclaré `requirements.txt` | Écart |
|---------|---------------------------|-------|
| sounddevice | ✅ | ok |
| openai-whisper + torch | ✅ | ok |
| flask, flask-cors | ✅ | ok |
| pynput, pyautogui, pycaw, comtypes | ✅ | ok (pycaw/comtypes importés nulle part — à vérifier) |
| **pyperclip** | ❌ **absent** | `text_injector.py:2` l'importe — crash si manquant |
| pyaudio | ✅ déclaré | **jamais importé** — install lourd inutile |
| **faster-whisper** | ❌ absent | requis par `speech_recognizer_optimized.py` (non branché) |

## Cycle de vie processus

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant E as Electron main
    participant F as Flask backend
    participant R as React renderer
    U->>E: lance app
    E->>F: spawn python flask_api.py
    Note over F: load_model('small')<br/>~5-30 s GIL-bloqué
    E->>R: createWindow + Widget + Tray (parallèle, sans attendre F)
    R->>F: GET /api/status @500ms
    Note over R,F: erreurs tant que F pas prêt (apiErrorCount)
    U->>E: Ctrl+Alt (pynput global)
    F->>F: start_hold_recording → thread audio
    U->>E: relâche
    F->>F: stop → WAV temp → transcribe (GIL saturé)
    Note over R,F: polling en timeout pendant transcription → "lag"
    F->>OS: inject_text (clipboard + Ctrl+V)
    F->>F: save_transcription → sqlite
```
