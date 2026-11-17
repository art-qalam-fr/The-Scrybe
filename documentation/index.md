# The Scrybe — Documentation

Bienvenue dans la documentation technique de The Scrybe, assistant de dictée vocale hors-ligne (Electron/React + Python/Whisper).

> **Audit du 2026-02-19** : cette documentation a été vérifiée contre le code réel (conformité ~75%). Les erreurs relevées sont détaillées dans `interne (_backup/audit)`. Le wiki ci-dessous est la référence à jour.

## � Wiki (référence à jour — vérifiée contre le code)

| Document | Contenu |
|----------|---------|
| [wiki/00-README-WIKI.md](./wiki/00-README-WIKI.md) | Index, fichiers clés, glossaire |
| [wiki/01-onboarding.md](./wiki/01-onboarding.md) | Démarrage réel, pièges connus |
| [wiki/02-architecture.md](./wiki/02-architecture.md) | Architecture réelle + diagrammes |
| [wiki/03-backend.md](./wiki/03-backend.md) | Deep dive Python/Flask/Whisper |
| [wiki/04-frontend-electron.md](./wiki/04-frontend-electron.md) | Deep dive React + Electron |
| [wiki/05-cycle-dictee.md](./wiki/05-cycle-dictee.md) | Trace complète d'une dictée |
| [wiki/06-limites-connues.md](./wiki/06-limites-connues.md) | Bugs et dette confirmés |

## 📚 Documents de référence et de diffusion

- [PRESENTATION_PROJET_XZ_ART_QALAM.md](./PRESENTATION_PROJET_XZ_ART_QALAM.md) — Dossier complet de présentation, production, guide de diffusion `.tar.xz`, et vitrine Art-qalam.

## 📚 Documents existants (à corriger — voir audit)

### 🚀 [README.md](../README.md)
Guide utilisateur/développeur. ⚠️ Corrections à apporter : Push-to-Block (toggle), `logs/`, `LICENSE`, installeur fictifs.

### 📖 [Analyse Technique](./analyse-technique.md)
Architecture et conception (~90% conforme — le plus fiable des docs historiques).

### 🔧 [Technologies Utilisées](./technologies-utilisees.md)
Stack et versions (~80% conforme — présente des dépendances non utilisées comme actives).

### ⚡ [Optimisations Possibles](./optimisations-possibles.md)
Feuille de route d'amélioration (~85% conforme — propositions honnêtes, métriques inventées).

### ⚠️ PERFORMANCE_IMPROVEMENTS.md — archivé
**Document non fiable (~35%)**, déplacé dans `_backup/archive/docs (hors repo)` lors du clean garden — la section "optimisations implémentées" décrivait des changements absents du code. La réalité mesurée est dans `AUDIT_GLOBAL.md` (interne, _backup/audit — hors repo).

## 🔍 Audit & Produit

- `AUDIT_GLOBAL.md` (interne, _backup/audit — hors repo) — audit complet (bugs, perf, sécurité)
- `CLEAN_GARDEN_PLAN.md` (interne, _backup/audit) — plan de tri du dépôt
- `PRD-scrybe-v1.md` (interne, _dev/prd) — roadmap des modifications

## 📊 État réel du projet (2026-02-19)

- **Frontend** : React 19.2.0 + Electron 40.4.1 — fonctionnel, polling HTTP intensif
- **Backend** : Python Flask + openai-whisper — fonctionnel, faster-whisper dispo non branché
- **Tests** : aucun framework (3 scripts ad-hoc cassés)
- **Bugs critiques connus** : 3 (push-to-block, double backend, DB dupliquée)
- **Documentation** : wiki à jour ; docs historiques à corriger
