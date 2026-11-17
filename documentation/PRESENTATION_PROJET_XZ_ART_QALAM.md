# The Scrybe — Dossier de Présentation, Production et Guide de Diffusion

> Document de référence officiel pour la préparation de la diffusion en archive `.tar.xz`, la mise à jour de la documentation du guide utilisateur/technique, et la configuration de la version vitrine (façade) pour l'organisation Art-qalam.

---

## 1. Fiche d'Identité et Synthèse du Projet

- **Nom du Projet** : The Scrybe (The-scrybe-Electron)
- **Nature** : Assistant de bureau pour dictée vocale temps réel avec reconnaissance vocale par IA locale.
- **Philosophie** : Souveraineté totale des données, 100 % hors-ligne, zéro dépendance cloud, respect absolu de la vie privée.
- **Cible Système Actuelle** : Windows 10 / Windows 11 (64-bit).
- **Architecture** : Découplage strict Frontend Electron/React et Backend Python/Flask.

---

## 2. Analyse Complète des Fonctionnalités

### 2.1. Reconnaissance Vocale et Transcription Locale par IA
- **Moteur d'inférence embarqué** :
  - **OpenAI Whisper** (modèles standard vanilla) avec repli et support multi-modèles.
  - **faster-whisper** (moteur optimisé basé sur CTranslate2 en quantification int8), réduisant l'empreinte mémoire et multipliant la vitesse de traitement par un facteur d'environ 4.
- **Multilinguisme natif** :
  - Détection automatique ou sélection manuelle parmi 7 langues principales : Français, Anglais, Espagnol, Allemand, Italien, Japonais, Chinois.
  - Adaptation dynamique du paramètre `beam_size` pour les alphabets non-latins afin de garantir la précision phonétique et lexicale.
- **Granularité des modèles de transcription** :
  - `tiny` (~39 Mo) : Détection ultra-rapide pour configurations modestes.
  - `base` (~74 Mo) : Vitesse élevée, adapté aux commandes directes.
  - `small` (~244 Mo) : Modèle équilibré par défaut, recommandé pour la dictée courante.
  - `medium` (~769 Mo) : Précision accrue pour vocabulaires spécialisés.
  - `large` (~1,55 Go) : Précision maximale pour contextes techniques ou médicaux complexes.

### 2.2. Modes de Déclenchement de la Dictée
- **Push-to-Talk (Maintien pour parler)** :
  - Raccourci global système par défaut : `Ctrl + Alt`.
  - Fonctionnement : L'utilisateur maintient la combinaison enfoncée pendant la prise de parole. Le relâchement coupe immédiatement l'enregistrement audio, déclenche la transcription et injecte le texte.
- **Push-to-Block / Toggle (Bascule marche/arrêt)** :
  - Raccourci global système par défaut : `Ctrl + Shift`.
  - Fonctionnement : Une première frappe active l'enregistrement en continu (mains libres). Une seconde frappe clôture la séquence et lance l'injection.
- **Contrôle Graphique** :
  - Déclencheur manuel accessible depuis le Dashboard principal ou via le Widget flottant.

### 2.3. Injection Universelle de Texte
- Le texte transcrit est inséré directement au point d'insertion du curseur dans l'application active (traitement de texte, navigateur web, client de messagerie, éditeur de code, terminal).
- Mécanisme : Transmission sécurisée dans le presse-papiers (`pyperclip`) suivie d'une simulation de combinaison de touches Win32 (`pyautogui.hotkey('ctrl', 'v')`).

### 2.4. Interface Utilisateur et Widget Flottant
- **Dashboard Principal** :
  - Navigation par onglets : Accueil/Dictée, Historique des transcriptions, Apparence/Thèmes, Paramètres système.
  - Affichage dynamique de l'état système via indicateur coloré (Repos = Vert, Écoute = Rouge, Transcription = Bleu).
  - Gestion de l'historique local avec horodatage, métadonnées et suppression sélective d'entrées.
- **Widget Satellite Flottant** :
  - Fenêtre miniature 80x80 pixels sans bordure, transparente, épinglée au premier plan (`always-on-top`).
  - Galerie de 13 templates graphiques animés (formes circulaires, radar, ondes audio, minimalistes).
  - Pilotage de l'opacité, des bordures et du flou d'arrière-plan.
- **Chantier de Modernisation (React Flow)** :
  - Transition en cours depuis l'interface historique vers une architecture modulaire (`reactflow-migration/`).
  - Vue de pipeline nodale interactive via `@xyflow/react` v12 illustrant le parcours de la donnée en direct : Entrée Audio -> Buffer -> Moteur Whisper -> Base SQLite -> Injection Système.
  - Consommation des statuts via flux SSE (`/events`) réduisant drastiquement le polling HTTP résiduel.

### 2.5. Intégration Système Windows
- **Barre d'état (System Tray)** : Minimisation discrète avec menu contextuel (Ouvrir, Afficher Widget, Paramètres, Quitter).
- **Menu contextuel du Bureau** : Entrée dédiée enregistrée dans le Registre Windows (`HKCU\Software\Classes\DesktopBackground\Shell\TheScrybe`) pour lancer l'application d'un clic droit sur le fond d'écran.
- **Démarrage automatique** : Option configurable pour lancer l'exécutable à l'ouverture de session Windows.

---

## 3. Guide de Production, Build et Distribution

### 3.1. Architecture d'Exécution et Chaîne de Démarrage
Pour assurer la stabilité et éviter les collisions de ports en phase de développement et d'exécution locale, la chaîne de scripts orchestre les composants comme suit :

1. **Vérification d'intégrité** : `start-dev.bat` valide l'existence de `.venv\Scripts\python.exe` et des modules Node dans `frontend\node_modules`.
2. **Identification des binaires (`ensure-scrybe-binaries.cmd`)** : Création de copies d'exécutables dédiées (`scrybe-vite.exe`, `scrybe-backend.exe`, `scrybe-desktop.exe`) permettant une identification explicite dans les outils d'audit système.
3. **Assainissement des ports (`free-port.ps1`)** :
   - Port `5173` : Serveur Vite pour le frontend React.
   - Port `5000` : Serveur API Flask pour le backend Python.
   - Les processus orphelins résiduels appartenant à The Scrybe sont purgés automatiquement.
4. **Manifeste de sécurité (`logs/scrybe-ports.json`)** : Génération d'un inventaire horodaté associant chaque port à son binaire et son rôle.
5. **Orchestration des processus** : Lancement de Vite, attente du code HTTP 200 sur `http://localhost:5173`, puis démarrage du processus Electron qui instancie le backend Python.

### 3.2. Spécifications pour le Packaging Autonome
Dans sa version finale distribuée, The Scrybe doit s'affranchir de l'interpréteur Python externe et de Node.js installés chez le client :
- **Backend Standalone (PyInstaller)** :
  - Empaqueter `backend/flask_api.py` en un exécutable autonome (`scrybe-backend.exe`).
  - Embarquer les bibliothèques CTranslate2, sounddevice, torch CPU minimal ou runtime C++, et les fichiers de modèles de base.
- **Frontend Standalone (Vite + electron-builder)** :
  - Compilation des assets de production via `npm run build` dans `frontend/dist`.
  - Configuration de `electron-builder.yml` pour générer un installateur Windows NSIS ou une archive binaire portable.
  - Déclaration de l'exécutable Python standalone dans les `extraResources` d'Electron.
- **Signature de Code** : Signature numérique du binaire pour lever les alertes SmartScreen de Windows.

### 3.3. Procédure de Compilation et Diffusion en Archive `.tar.xz`
Le format `.tar.xz` (compression LZMA2) assure un taux de compression supérieur sur les binaires volumineux et les bibliothèques d'inférence :

```bash
# Exemple de commande de génération de l'archive de distribution propre
tar -cvf The-Scrybe-v1.0.0-windows-x64.tar \
    --exclude="The-scrybe-Electron/.agent" \
    --exclude="The-scrybe-Electron/.venv" \
    --exclude="The-scrybe-Electron/frontend/node_modules" \
    --exclude="The-scrybe-Electron/.git" \
    --exclude="The-scrybe-Electron/.env" \
    --exclude="The-scrybe-Electron/logs/*.log" \
    The-scrybe-Electron/

xz -9e The-Scrybe-v1.0.0-windows-x64.tar
```

### 3.4. Protocole d'Assainissement pour la Version Façade (Organisation Art-qalam)
Pour publier une vitrine propre et sécurisée du projet au sein de l'organisation Art-qalam, les règles suivantes sont obligatoires :

1. **Exclusions strictes de sécurité** :
   - Interdiction formelle de pousser le dossier `.agent/` (contient le bus de communication, l'orchestrateur Hephaistos, les mémoires et configurations internes).
   - Suppression de `.env`, des certificats privés de test, des dumps de cache (`semantic-cache-data/`, `memory-database`).
   - Nettoyage des dossiers de rapports internes (`audit_analyse/agent_reports/`, `_archive/`).
2. **Nettoyage de code et dépendances** :
   - Figer un `package.json` et un `requirements.txt` épurés de tout composant fantôme (suppression des références orphelines à pyaudio, pycaw, comtypes).
   - Remplacer les chemins système absolus Windows (`F:\...`) par des chemins relatifs dynamiques (`process.cwd()` ou `__dirname`).
3. **Politique de validation** :
   - La version façade doit être préparée dans un répertoire de staging isolé.
   - Aucun envoi vers un remote Git externe ne doit être effectué sans ordre explicite.

---

## 4. Guide Opérationnel d'Utilisation

### 4.1. Configuration Requise
- **Système** : Windows 10 ou 11 (64-bit).
- **Processeur** : CPU 4 cœurs minimum (AVX2 recommandé pour l'inférence locale rapide).
- **Mémoire Vive** : 8 Go de RAM conseillés (4 Go minimum pour le modèle `tiny` ou `base`).
- **Périphérique d'entrée** : Tout microphone USB, analogique ou intégré reconnu par Windows.

### 4.2. Démarrage et Cycle de Vie
1. Exécuter le script lanceur `Desk-top.bat` ou le raccourci créé sur le bureau.
2. Patienter pendant l'initialisation du backend et le chargement du modèle d'IA en RAM (environ 15 à 30 secondes selon le modèle sélectionné).
3. L'indicateur visuel passe au vert sur le Dashboard ou le Widget : le système est prêt à capturer.
4. L'application se replie dans la zone de notification (systray) lors du clic sur la croix de fermeture, maintenant le service de capture actif en permanence.

### 4.3. Guide de Dictée au Clavier
- **Saisie Rapide (Push-to-Talk)** :
  1. Positionner le curseur dans l'application cible (Word, Notepad, Slack, VSCode, navigateur, etc.).
  2. Presser et maintenir la combinaison `Ctrl + Alt`.
  3. Parler clairement dans le microphone.
  4. Relâcher les touches. Le texte s'écrit automatiquement au niveau du curseur.
- **Saisie Mains Libres (Push-to-Block)** :
  1. Presser une fois la combinaison `Ctrl + Shift`. L'enregistrement démarre (voyant rouge).
  2. Dicter le texte sans contrainte de maintien.
  3. Presser à nouveau `Ctrl + Shift` pour arrêter l'enregistrement et déclencher l'injection du texte.

### 4.4. Personnalisation et Réglages
- **Qualité de Transcription** : Configurable dans l'onglet *Paramètres*. L'ajustement vers `small` offre le meilleur compromis latence/précision pour la langue française.
- **Sélection du Micro** : Permet d'isoler un micro spécifique si plusieurs cartes son sont connectées.
- **Gestion des Thèmes** : 10 thèmes prédéfinis accessibles dans l'onglet *Apparence*, avec réglage d'opacité et de flou de fond (Glassmorphism).

---

## 5. Matrice des Avantages et des Inconvénients

| Domaine | Avantages (Forces) | Inconvénients (Limites actuelles) |
|---|---|---|
| **Confidentialité & Données** | Souveraineté totale. Zéro fuite vers le cloud. Données audio et transcriptions stockées uniquement sur la machine hôte. Conforme aux normes de secret professionnel et RGPD. | Aucun partage ou synchronisation multi-postes automatique sans configuration réseau locale manuelle. |
| **Intégration & Ergonomie** | Injection universelle dans n'importe quelle fenêtre active sous Windows. Mode Push-to-Talk permettant de dicter sans lever les mains du clavier. | L'injection repose sur le presse-papiers (`Ctrl + V`), écrasant temporairement le contenu précédemment copié si non restauré. |
| **Interface Graphique** | Widget flottant personnalisable, discret et moderne. 13 templates visuels. Pipeline nodale React Flow innovante pour le monitoring en temps réel. | Coexistence de deux bases de code frontend (Legacy `App.jsx` et Migration `Shell.jsx`) nécessitant une consolidation finale. |
| **Performances & Moteur** | Intégration possible de faster-whisper (CTranslate2) pour une inférence 4x plus véloce que le modèle standard. | Consommation RAM élevée (800 Mo à 2 Go) typique des modèles d'IA locaux. Premier boot à froid exigeant (15 à 60 secondes). |
| **Portabilité** | Écosystème web standard pour l'UI (React / Vite / CSS modules). | Adhérence forte aux API Win32 pour les raccourcis globaux, l'injection clavier et le menu contextuel du bureau. Non multiplateforme en l'état. |
| **Distribution & Déploiement**| Architecture modulaire facilement convertible en exécutable standalone. | Actuellement dépendant d'un environnement Python `.venv` local ; packaging unifié `electron-builder` restant à finaliser. |

---

## 6. Plan d'Action pour la Correction de la Documentation et du README

Pour aligner la documentation officielle du projet avec la réalité technique constatée :

1. **Assainissement du README principal (`README.md`)** :
   - Supprimer toute référence à un fichier `The-Scrybe-Setup.exe` inexistant et documenter le lancement réel via `Desk-top.bat`.
   - Corriger la définition de Push-to-Block (il s'agit d'un mode toggle marche/arrêt et non d'un maintien alternatif).
   - Documenter explicitement la combinaison `Ctrl + Alt` (Push-to-Talk) et `Ctrl + Shift` (Toggle).
2. **Mise à jour du Guide et du Wiki (`documentation/wiki/`)** :
   - Intégrer les détails du nouveau Shell de migration React Flow et de la visualisation de pipeline.
   - Documenter le fonctionnement du client SSE (`eventsClient.js`) en remplacement progressif du polling HTTP 500 ms.
   - Clarifier la procédure d'activation de `faster-whisper` (`backend/speech_recognizer_optimized.py`) pour les utilisateurs recherchant la performance maximale.
3. **Consolidation de la Présentation Commerciale Art-qalam** :
   - Mettre en valeur l'argument souverain et offline comme axe majeur pour les entreprises et professionnels manipulant des données sensibles.
