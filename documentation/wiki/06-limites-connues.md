# 06 — Limites et bugs connus (état au 2026-02-19)

> Référence : les rapports internes (_backup/audit, hors repo) pour le détail fichier:ligne.

## 🔴 Critiques — corrigés en priorité (PRD batch 1)

1. **Push-to-block ne s'arrête jamais** — `hotkey_manager.py:93` (B1)
2. **Double backend port 5000** — Electron spawn + scripts `.bat` (B2)
3. **Deux SQLite `voice_dictation.db`** — vraie DB dans `frontend/` (B3)

## 🟠 Majeurs

4. Erreur du thread audio → UI figée "Enregistrement" (B4)
5. `apiErrorCount` closure stale → erreur API invisible (B5)
6. `request.get_json()` None → 500 (B6)
7. CORS `*` — n'importe quel site peut piloter l'API locale (S1)
8. Clipboard écrasé sans restauration (S2)

## 🟡 Mineurs

9. `dur="NaNs"` animation Widget (B7) · `parseInt` NaN (B8) · `bgColor.includes` crash (B9)
10. `join(timeout=0.5)` tronque l'audio + frames sans lock (B10)
11. Registre HKCU modifié à chaque boot via PowerShell Bypass (S3)
12. Dead code : `speech_recognizer_optimized`, `transcription_history`, `setWidgetOpacity`, `editing_shortcut`
13. `requirements.txt` : `-pyaudio +pyperclip +faster-whisper`, pas de pins
14. "The Scybe" vs "The Scrybe" — faute de frappe dans le titre
15. Pas de tests, pas de packaging, version 0.0.0

## Performance — pourquoi ça rame

**Cause racine** : polling HTTP (~3 req/s) contre un Flask qui partage le GIL avec PyTorch. Pendant chaque transcription, l'API est étranglée → UI qui lag + erreurs. Aggravé par : Whisper vanilla (vs faster-whisper dispo), chargement modèle synchrone au boot, double backend.

**Quick wins mesurables** : faster-whisper (~4×), SSE au lieu du polling, process dédié pour l'inférence, DB absolue, un seul launcher.

## Hors périmètre volontaire

- `.env`, `memory-database`, `semantic-cache-data`, `.agent/` — infra personnelle de l'utilisateur, non auditée pour contenu
- Comportement tray/hide-on-close — intentionnel, documenté, ne pas "corriger"
