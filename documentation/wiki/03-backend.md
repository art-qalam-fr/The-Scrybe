# 03 — Backend Python (deep dive)

## `flask_api.py` (119 l.) — routes

| Route | Méthode | Handler |
|-------|---------|---------|
| `/api/status` | GET | `logic.get_status()` |
| `/api/devices` | GET | `logic.list_devices()` → `sd.query_devices()` |
| `/api/device` | POST | `set_device(id)` |
| `/api/settings/quality` | POST | `set_quality(tiny…large)` → reload modèle en thread |
| `/api/settings/language` | POST | `set_language` |
| `/api/shortcuts` | GET/POST | load/save raccourcis |
| `/api/settings/theme` | POST | `set_theme` → persist SQLite |
| `/api/start_recording`, `/stop_recording`, `/toggle_recording` | POST | enregistrement |
| `/api/history` | GET | 50 dernières transcriptions |
| `/api/delete_transcription/<id>` | DELETE | |
| `/api/languages` | GET | 7 langues codées en dur |

⚠️ `request.get_json()` non vérifié → 500 sur corps vide. `CORS(app)` ouvert à `*`. Logging werkzeug réduit à ERROR (l.10) — trace des requêtes masquée.

## `backend_logic.py` (234 l.) — orchestrateur

`BackendLogic` instancié au niveau module (`flask_api.py:23`) → **tout est initialisé à l'import** : DB, Whisper (~5-30 s), pynput listener.

- `stop_recording()` (l.168-198) : thread daemon → `audio_recorder.stop_recording()` → `transcribe` → `save_transcription` → `inject_text`
- `transcription_history` (l.75,185) : rempli jamais lu — dead code + croissance mémoire
- Appearance : `json.loads(saved.replace("'",'"'))` (l.41) — fragile, mixe `str(dict)` et JSON

## `audio_recorder.py` (77 l.)

- `sounddevice.InputStream` 16 kHz mono int16, chunks 1024, dans un thread
- Frames accumulées dans `self.frames` **sans lock** (écriture thread A / concaténation thread B)
- `stop_recording` : `join(timeout=0.5)` — si le stream tarde → WAV tronqué, thread zombie
- `try` ligne 30 englobe `def record()` — ne protège pas l'exécution
- WAV temp `NamedTemporaryFile(delete=False)` → supprimé par `speech_recognizer.transcribe` ; fuite si exception avant

## `speech_recognizer.py` (84 l.)

- `load_model` via `model_loader.py` → cache `~/.cache/whisper_models`
- Options : `beam_size:1`, `best_of:1`, `temperature:0`, `fp16` si CUDA
- Liste `non_latin_scripts` (l.40-45) avec doublons ; si langue non-latine → `beam_size:5` (ralentit)
- `transcribe` supprime le WAV après usage

## `speech_recognizer_optimized.py` (118 l.) — ⚠️ NON UTILISÉ

- faster-whisper + CTranslate2 `int8` — ~4× plus rapide, moins de RAM
- Interface compatible (`transcribe(audio_path)`), + `set_model`, `set_language`, `get_model_info`
- **Pour l'activer** : `pip install faster-whisper`, remplacer l'import dans `backend_logic.py:7`, adapter `set_quality`/`set_language` (méthodes existent)

## `hotkey_manager.py` (149 l.) — pynput global

- Listener clavier système ; `current_keys` = set des touches pressées
- `_check_shortcut_match` : comparaison complexe modificateurs (ctrl/alt/shift gauche+droite)
- **Bug B1** (l.93) : `elif block_match and not self.is_recording:` → push-to-block ne peut jamais se désactiver. Fix : `elif block_match:` puis toggle sur `push_to_block_active`
- `except: pass` ×3 — erreurs invisibles
- `editing_shortcut` flag consulté (l.81) mais jamais positionné côté backend → la saisie de raccourcis dans l'UI ne suspend pas les hotkeys

## `text_injector.py` (41 l.)

- `pyperclip.copy(text)` → `pyautogui.hotkey('ctrl','v')` → `sleep(0.1)`
- Écrase le presse-papiers utilisateur sans restauration (S2)
- `pyautogui.PAUSE=0.1` global — ralentit toute automation
- `pyperclip` absent de requirements.txt

## `database_manager.py` (196 l.)

- `db_path='voice_dictation.db'` **relatif au CWD** → DB différente selon launcher (B3)
- Tables : `transcriptions(id,text,language,timestamp,metadata)`, `settings(key,value)`
- `metadata` stocké en `str(dict)` Python, lu via `ast.literal_eval` dans `migrate_existing_data` — incohérent avec le `json.dumps` utilisé pour appearance
- Prints `[DEBUG]` lignes 151,157 à chaque lecture d'historique
- `SELECT *` puis reformatage — OK à cette échelle

## Schéma des threads

| Thread | Créé par | Rôle | Risque |
|--------|----------|------|--------|
| Flask workers | Werkzeug | routes | bloqués par le GIL pendant l'inférence |
| pynput listener | `hotkey_manager.start()` | hotkeys globaux | callbacks mutent l'état sans lock |
| record thread | `audio_recorder.start_recording()` | capture audio | frames sans lock |
| transcribe thread | `stop_recording()` | Whisper + DB + inject | race avec `set_quality` reload |
