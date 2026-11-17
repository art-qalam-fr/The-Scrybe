# The Scrybe - Dépannage

## Problèmes courants et solutions

### 1. Erreurs de connexion au backend (`ERR_CONNECTION_REFUSED`)

**Cause**: Le backend Python n'est pas démarré.

**Solution**:
```bash
# Option 1: Utiliser le script d'installation
setup.bat

# Option 2: Démarrer manuellement le backend
cd backend
..\.venv\Scripts\python.exe flask_api.py

# Puis dans un autre terminal, démarrer le frontend
cd frontend
npm run electron
```

### 2. Avertissement de sécurité Electron (CSP)

**Cause**: Pas de Content Security Policy configurée.

**Solution**: ✅ **Déjà corrigé** dans la version actuelle. La CSP a été ajoutée à `main.cjs`.

### 3. React DevTools manquant

**Solution optionnelle** pour le développement:
```bash
cd frontend
npm install --save-dev react-devtools
```

### 4. Dépendances Python manquantes

**Symptômes**: Erreurs d'import dans le backend.

**Solution**:
```bash
# Vérifier les dépendances
python check-deps.py

# Ou installer manuellement
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

### 5. Environnement virtuel non trouvé

**Solution**:
```bash
# Créer l'environnement virtuel
python -m venv .venv

# L'activer
.venv\Scripts\activate

# Installer les dépendances
pip install -r backend\requirements.txt
```

## Scripts pratiques

### `setup.bat`
- Crée l'environnement virtuel Python
- Installe toutes les dépendances (Python + Node.js)
- À exécuter une seule fois après le clonage

### `start-dev.bat`
- Démarre le backend Python
- Démarre le frontend Electron
- Arrête proprement le backend à la fermeture

### `check-deps.py`
- Vérifie si toutes les dépendances Python sont installées
- Installe automatiquement celles qui manquent

## Structure du projet

```
The-scrybe-Electron/
├── backend/           # API Flask Python
│   ├── flask_api.py   # Point d'entrée du backend
│   └── requirements.txt
├── frontend/          # Application Electron/React
│   ├── electron/      # Code Electron principal
│   └── src/           # Code React
├── .venv/             # Environnement virtuel Python
├── setup.bat          # Script d'installation
├── start-dev.bat      # Script de démarrage dev
└── check-deps.py      # Vérification des dépendances
```

## Ports utilisés

- **5000**: Backend Flask API
- **5173**: Frontend dev server (Vite)

Assurez-vous que ces ports sont disponibles!
