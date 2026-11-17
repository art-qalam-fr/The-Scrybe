# Technologies Utilisées - The Scrybe

*Document mis à jour : 18 février 2026*

## 🎯 Stack Technologique Complet

### Frontend (Interface Utilisateur)

#### **Electron 40.4.1**
- **Rôle** : Framework d'application desktop
- **Utilisation** : Accès natif au système, fenêtres, tray, intégration OS
- **Avantages** 
  - Multi-plateforme (Windows, macOS, Linux)
  - Accès API système (microphone, raccourcis, shell)
  - Écosystème JavaScript mature
- **Inconvénients**
  - Taille application importante (~100MB minimum)
  - Consommation mémoire élevée
  - Complexité packaging/distribution

#### **React 19.2.0**
- **Rôle** : Bibliothèque UI composants
- **Utilisation** : Interface utilisateur réactive, gestion état
- **Avantages**
  - Composants réutilisables
  - Écosystème immensément riche
  - Performance avec Virtual DOM
  - Hooks pour gestion état local
- **Inconvénients**
  - Courbe d'apprentissage
  - Surcharge pour applications simples

#### **Vite 7.3.1**
- **Rôle** : Build tool et serveur développement
- **Utilisation** : Bundle JavaScript, HMR, optimisation
- **Avantages**
  - Build ultra-rapide (ESBuild)
  - HMR quasi-instantané
  - Configuration minimale
  - Support moderne ES modules
- **Inconvénients**
  - Moins mature que Webpack
  - Plugins limités vs écosystème Webpack

#### **Lucide React 0.564.0**
- **Rôle** : Bibliothèque d'icônes
- **Utilisation** : Interface visuelle cohérente
- **Avantages**
  - Icônes vectorielles modernes
  - Tree-shaking optimisé
  - Consistance visuelle
  - Performance optimisée

#### **Axios 1.13.5**
- **Rôle** : Client HTTP
- **Utilisation** : Communication avec API backend
- **Avantages**
  - Promises natif
  - Interceptors (auth, logging)
  - Gestion erreurs robuste
  - Support navigateur legacy
- **Alternative** : Fetch API natif (réduire dépendances)

### Backend (Traitement Données)

#### **Python 3.8+**
- **Rôle** : Langage principal backend
- **Utilisation** : Logique métier, AI/ML, système integration
- **Avantages**
  - Écosystème IA/ML exceptionnel
  - Syntaxe claire, productivité élevée
  - Nombreuses bibliothèques système
  - Facilité débogage
- **Inconvénients**
  - Performance vs Go/Rust
  - GIL pour parallélisme vrai
  - Distribution plus complexe

#### **Flask + Flask-CORS**
- **Rôle** : Framework web API REST
- **Utilisation** : Endpoints API, communication frontend
- **Avantages**
  - Léger et flexible
  - Facile à démarrer
  - Extensible avec plugins
  - Documentation claire
- **Inconvénients**
  - Moins structuré que FastAPI/Django
  - Pas de validation automatique
  - Gestion async manuelle
- **Alternative recommandée** : FastAPI pour validation auto et docs Swagger

#### **OpenAI Whisper 20231117**
- **Rôle** : Reconnaissance vocale IA
- **Utilisation** : Transcription speech-to-text
- **Avantages**
  - Qualité transcription exceptionnelle
  - Support multilingue natif
  - Fonctionne entièrement hors-ligne
  - Différentes tailles modèles
- **Inconvénients**
  - Ressources intensives (CPU/GPU)
  - Taille modèles importante
  - Latence selon taille modèle
- **Modèles disponibles**
  - tiny: 39MB, ultra-rapide, qualité basique
  - base: 74MB, rapide, qualité correcte
  - small: 244MB, équilibré, **recommandé**
  - medium: 769MB, lent, haute qualité
  - large: 1550MB, très lent, qualité maximum

#### **SoundDevice 0.4.6**
- **Rôle** : Interface audio Python
- **Utilisation** : Enregistrement microphone
- **Avantages**
  - Cross-platform (Windows, macOS, Linux)
  - API simple et directe
  - Support périphériques multiples
  - Performance temps réel
- **Inconvénients**
  - Dépendances système (PortAudio)
  - Configuration parfois complexe

#### **PyAudio 0.2.13**
- **Rôle** : Interface audio Windows spécifique
- **Utilisation** : WASAPI exclusive mode
- **Avantages**
  - Accès direct matériel Windows
  - Mode exclusif (pas d'interférence)
  - Latence minimale
- **Inconvénients**
  - Windows uniquement
  - Installation complexe parfois

#### **PyAutoGUI 0.9.54**
- **Rôle** : Automatisation interface utilisateur
- **Utilisation** : Injection texte dans applications
- **Avantages**
  - Cross-platform
  - Simulation clavier/souris
  - Support clipboard
- **Inconvénients**
  - Fiabilité variable selon applications
  - Sécurité Windows peut bloquer

#### **Pynput 1.7.6**
- **Rôle** : Détection raccourcis clavier globaux
- **Utilisation** : Push-to-talk, push-to-block
- **Avantages**
  - Hooks système natifs
  - Support combinaisons touches
  - Cross-platform
- **Inconvénients**
  - Permissions administrateur parfois
  - Détection antivirus possible

#### **PyCAW 20230407**
- **Rôle** : Contrôle audio Windows
- **Utilisation** : Gestion volumes système
- **Avantages**
  - API Windows Audio native
  - Contrôle précis volumes
- **Inconvénients**
  - Windows uniquement
  - Complexité COM objects

### Stockage et Persistance

#### **SQLite 3**
- **Rôle** : Base de données embarquée
- **Utilisation** : Stockage transcriptions, configuration
- **Avantages**
  - Zéro configuration
  - Portable (fichier unique)
  - Performance excellente pour usage local
  - Support ACID transactions
- **Inconvénients**
  - Pas de concurrence multi-utilisateurs
  - Limitations vs PostgreSQL/MySQL

### Développement et Build

#### **Node.js 18+**
- **Rôle** : Runtime JavaScript frontend
- **Utilisation** : Build, développement, outils
- **Avantages**
  - Écosystème npm immense
  - Performance V8
  - Support moderne ES modules

#### **ESLint 9.39.1**
- **Rôle** : Linter JavaScript
- **Utilisation** : Qualité code, cohérence
- **Configuration** : Standard + React hooks

#### **Concurrently 9.2.1**
- **Rôle** : Gestion processus multiples
- **Utilisation** : Lancement simultané dev server + Electron

## 🔗 Intégrations Système

### Windows Specific

#### **PowerShell Scripts**
- **Desk-top.vbs** : Intégration menu contextuel bureau
- **Desk-top-settings.vbs** : Accès rapide paramètres
- **Desk-top.bat** : Alternative batch

#### **Windows Registry**
- Clés `HKCU:\Software\Classes\DesktopBackground\Shell\TheScrybe`
- Intégration clic droit bureau
- Menus contextuels personnalisés

#### **Windows Features**
- **Startup folder** : Démarrage automatique
- **Tray icon** : Icône barre système
- **Single instance** : Éviter doublons application
- **File associations** : Signal files pour développement

## 📦 Gestion Dépendances

### Frontend (package.json)
```json
{
  "dependencies": {
    "axios": "^1.13.5",        // HTTP client
    "lucide-react": "^0.564.0", // Icônes
    "react": "^19.2.0",         // UI framework
    "react-dom": "^19.2.0"      // DOM rendering
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.1.1", // React plugin
    "electron": "^40.4.1",           // Desktop framework
    "vite": "^7.3.1"                 // Build tool
  }
}
```

### Backend (requirements.txt)
```python
pynput>=1.7.6          # Global hotkeys
sounddevice>=0.4.6      # Audio recording
pyaudio>=0.2.13         # Windows WASAPI
openai-whisper>=20231117 # Speech recognition
pyautogui>=0.9.54       # Text injection
pycaw>=20230407          # Windows audio control
comtypes>=1.2.0         # COM interface
torch>=2.0.0            # ML framework (Whisper)
numpy>=1.24.0           # Audio processing
soundfile>=0.12.1       # Audio files
flask                    # Web API
flask-cors              # Cross-origin requests
```

## 🔄 Flux de Données

### Enregistrement Vocal
```
Microphone → SoundDevice → Fichier WAV → Whisper → Texte → SQLite + Injection
```

### Communication Frontend-Backend
```
React Component → Axios HTTP → Flask API → BackendLogic → Python Modules
```

### État Synchronisé
```
BackendLogic → API Status → React Polling → UI Update
```

## 🚀 Alternatives Technologiques

### Pour Production Future

#### Frontend Alternatives
- **Tauri** : Alternative plus légère à Electron (~10MB vs ~100MB)
- **Flutter Desktop** : UI performante, single codebase
- **PWA** : Installation via navigateur, pas de desktop requis

#### Backend Alternatives
- **FastAPI** : Validation auto, docs Swagger, performance
- **Go** : Performance supérieure, déploiement simple
- **Rust** : Performance maximale, sécurité mémoire

#### Reconnaissance Vocale
- **Vosk** : Alternative lightweight à Whisper
- **Coqui STT** : Open source, modèles personnalisables
- **Azure Speech** : Cloud-based (si hors-ligne non requis)

## 📊 Analyse Licensing

### Open Source Used
- **MIT License** : React, Vite, Axios, Lucide
- **Apache 2.0** : PyTorch, Whisper
- **BSD/GNU** : Python libraries

### Compatibility
- ✅ **Commercial use** : Toutes les dépendances
- ✅ **Modification** : Toutes les dépendances
- ✅ **Distribution** : Toutes les dépendances
- ⚠️ **Attribution** : Conserver licences dans distribution

## 🎯 Recommandations Technologiques

### Court Terme (Maintenir stack actuel)
1. **Stabiliser** : Finaliser implémentation actuelle
2. **Optimiser** : Performance Whisper, communication
3. **Sécuriser** : Validation inputs, chiffrement

### Moyen Terme (Évolutions contrôlées)
1. **TypeScript** : Robustesse code frontend
2. **FastAPI** : Remplacer Flask pour meilleure API
3. **WebSocket** : Communication temps réel

### Long Terme (Architecture moderne)
1. **Tauri evaluation** : Si taille package critique
2. **Go microservices** : Si performance critique
3. **Cloud models** : Si features avancées requises

Le stack technologique actuel représente un excellent équilibre entre performance, productivité développement, et fonctionnalités. Les choix sont cohérents avec les objectifs d'une application de dictée vocale hors-ligne.
