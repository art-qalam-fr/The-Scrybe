# Wiki — The Scrybe

*Wiki technique vérifié contre le code réel (audit 2026-02-19). Toute affirmation renvoie à un fichier:ligne.*

## Ordre de lecture recommandé

| # | Document | Contenu | Public |
|---|----------|---------|--------|
| 0 | Ce fichier | Index + glossaire | Tous |
| 1 | [01-onboarding.md](01-onboarding.md) | Démarrage réel, prérequis, commandes | Nouveau venu |
| 2 | [02-architecture.md](02-architecture.md) | Vue d'ensemble, diagrammes, flux de données | Tous |
| 3 | [03-backend.md](03-backend.md) | Deep dive Python/Flask/Whisper | Dev backend |
| 4 | [04-frontend-electron.md](04-frontend-electron.md) | Deep dive React + processus Electron | Dev frontend |
| 5 | [05-cycle-dictee.md](05-cycle-dictee.md) | Séquence complète d'une dictée (raccourci → texte injecté) | Dev/debug |
| 6 | [06-limites-connues.md](06-limites-connues.md) | Bugs et dette confirmés par l'audit | Tous |

## Fichiers clés du projet

| Chemin | Rôle | Lignes |
|--------|------|--------|
| `backend/flask_api.py` | Routes REST `/api/*` | 119 |
| `backend/backend_logic.py` | Orchestrateur singleton | 234 |
| `backend/audio_recorder.py` | Capture micro (sounddevice) | 77 |
| `backend/speech_recognizer.py` | Whisper vanilla (utilisé) | 84 |
| `backend/speech_recognizer_optimized.py` | faster-whisper (**non branché**) | 118 |
| `backend/hotkey_manager.py` | Raccourcis globaux (pynput) | 149 |
| `backend/text_injector.py` | Clipboard + Ctrl+V | 41 |
| `backend/database_manager.py` | SQLite (chemin relatif) | 196 |
| `frontend/src/App.jsx` | UI principale (4 onglets) | 651 |
| `frontend/src/Widget.jsx` | Widget flottant (10 templates SVG) | 308 |
| `frontend/electron/main.cjs` | Processus principal (tray, spawn backend) | 385 |
| `frontend/electron/preload.cjs` | Bridge `electronAPI` restreint | 22 |
| `frontend/src/translations.js` | FR/EN/ES/DE/IT/JA/ZH | 350 |

## Glossaire

- **Push-to-Talk (PTT)** : maintenir `Ctrl+Alt` → enregistrement, relâcher → transcription
- **Push-to-Block** : `Ctrl+Shift` toggle enregistrement — **⚠️ bug : ne peut pas s'arrêter (B1)**
- **Widget** : fenêtre `alwaysOnTop` 80×80 affichant un template SVG animé
- **Appearance** : dict persisté dans SQLite `settings` (clé `appearance`, JSON)
- **Tray** : icône zone de notification, seule interface visible au démarrage (fenêtre `show:false`)

## Règles du wiki

- Chaque affirmation doit citer `fichier:ligne` — pas de doc "aspirationnelle"
- Une affirmation contredite par le code est un bug de doc → corriger le doc ou le code, pas les ignorer
- `audit_analyse/` → déplacé dans `_backup/audit/` ; `PRD/` → `_dev/prd/` (interne, hors repo)
