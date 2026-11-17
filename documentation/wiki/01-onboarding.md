# 01 — Onboarding : démarrer The Scrybe

## Prérequis (réels)

- Windows 10/11 (pynput, pyautogui, registre, `.bat/.vbs` sont Windows-only)
- Python 3.8+ avec `.venv/` à la **racine** (créé par `setup.bat`)
- Node.js 18+ (`frontend/node_modules` via `npm install`)
- Micro fonctionnel ; ~2 Go RAM libre pour le modèle Whisper `small`
- Premier lancement : téléchargement du modèle Whisper dans `~/.cache/whisper_models` (~500 Mo pour `small`)

## Installation

```bat
setup.bat          REM crée .venv + pip install backend/requirements.txt
cd frontend && npm install
```

## Démarrage — ⚠️ une seule méthode à la fois

| Méthode | Effet | Statut |
|---------|-------|--------|
| `run_scybe.bat` ou `Desk-top.bat` | `npm start` → vite + electron ; **Electron démarre le backend** (`main.cjs:301`) | ✅ Recommandé — pas de doublon |
| `start-dev.bat` | Démarre Flask **puis** `npm run electron` → Electron **re-spawne** Flask → conflit port 5000 | ⚠️ Bug B2 connu |
| Manuel : `python backend\flask_api.py` + `npm run dev` (vite seul, pas electron) | Backend seul + UI web | ✅ pour dev frontend |

**Règle d'or** : soit un script `.bat` orchestre, soit `main.cjs` orchestre — **jamais les deux**. Le backend démarré par Electron tourne avec `cwd=frontend/` → c'est pourquoi la vraie DB est `frontend/voice_dictation.db`.

## Utilisation

1. L'app démarre **invisible** : seule l'icône tray + le widget flottant apparaissent (`main.cjs:65` `show:false`, `skipTaskbar:true`)
2. Clic droit tray → "Ouvrir Scybe" pour la fenêtre principale
3. `Ctrl+Alt` maintenu → dicte ; relâcher → transcription injectée via Ctrl+V dans l'app ayant le focus
4. Fermer la fenêtre = **masquer**, pas quitter (`main.cjs:85-91`) ; quitter via tray → "Quitter"

## Vérifications rapides

```bat
curl http://localhost:5000/api/status   REM backend vivant ?
cd frontend && npm run lint             REM lint React
```

## Pièges fréquents

- **"Erreur API" au démarrage** : Whisper charge ~5-30 s avant que Flask réponde — attendre, c'est normal (P4)
- **Historique vide** : vous avez lancé via une méthode différente → DB différente (B3)
- **Enregistrement bloqué** : push-to-block ne s'arrête pas (B1) — utiliser le bouton UI
- **Port 5000 occupé** : `taskkill /f /im python.exe` avant relance
