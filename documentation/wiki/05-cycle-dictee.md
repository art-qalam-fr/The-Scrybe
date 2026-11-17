# 05 — Cycle de vie d'une dictée (trace complète)

## Push-to-Talk (Ctrl+Alt)

```mermaid
sequenceDiagram
    participant K as pynput listener<br/>(hotkey_manager)
    participant BL as BackendLogic
    participant AR as AudioRecorder
    participant SR as SpeechRecognizer
    participant DB as SQLite
    participant TI as TextInjector
    participant UI as React (poll 500ms)

    Note over K: Ctrl+Alt pressé
    K->>K: _check_shortcut_match('push_to_talk') ✓
    K->>BL: start_hold_recording()
    BL->>AR: start_recording() → thread InputStream
    Note over AR: frames[] accumulé<br/>(pas de lock ⚠️)
    BL-->>UI: status "🔴 Enregistrement (PTT)..." (au prochain poll)
    Note over K: Ctrl ou Alt relâché
    K->>K: match PTT ✗ → is_recording=False
    K->>BL: stop_hold_recording() → stop_recording()
    BL->>AR: stop_recording() → join(0.5s) → WAV temp
    BL->>SR: transcribe(wav) [thread daemon]
    Note over SR: PyTorch sature le GIL<br/>⚠️ Flask lent → polls en timeout<br/>c'est ici que ça "rame"
    SR-->>BL: texte
    BL->>DB: save_transcription
    BL->>TI: inject_text → clipboard écrasé + Ctrl+V
    BL-->>UI: status "Prêt" ; UI fetch /api/history
```

## Push-to-Block (Ctrl+Shift) — ⚠️ B1

- 1re pression : `block_match and not is_recording` → `push_to_block_active=True`, enregistrement démarre
- 2e pression : `is_recording=True` → la branche `elif` ne s'exécute **jamais** → **impossible d'arrêter par le raccourci**
- Contournement actuel : bouton Stop dans l'UI (POST `/api/stop_recording`)
- Fix proposé : `elif block_match:` puis `if self.push_to_block_active: stop else: start` — voir PRD batch 1

## Via l'UI (bouton micro)

`App.jsx:177` → POST `/api/toggle_recording` → `BackendLogic.toggle_recording` → mêmes chemins start/stop. `fetchHistory` relancé à +2 s (l.182) en plus du poll 10 s.

## Où ça peut casser (checklist debug)

| Symptôme | Vérifier |
|----------|----------|
| Rien ne s'enregistre | `sd.query_devices()` — device valide ? log "Erreur enregistrement" |
| Status figé "Enregistrement" | thread record mort (B4) — `is_recording` jamais reset |
| Transcription vide | WAV supprimé avant transcription ? `transcribe` retourne "" silencieusement |
| Texte pas injecté | focus de la fenêtre cible ? clipboard verrouillé ? log TextInjector |
| Historique vide | mauvaise DB (B3) — vérifier le CWD du backend |
| "Erreur API" persistante | port 5000 occupé par un python orphelin (B2) — `taskkill /f /im python.exe` |
