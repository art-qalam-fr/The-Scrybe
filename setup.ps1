# Script PowerShell pour installer The Scrybe
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  The Scrybe - Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] Python trouvé: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERREUR] Python n'est pas installé!" -ForegroundColor Red
    Write-Host "Veuillez installer Python depuis https://python.org" -ForegroundColor Yellow
    pause
    exit 1
}

# Vérifier Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js trouvé: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERREUR] Node.js n'est pas installé!" -ForegroundColor Red
    Write-Host "Veuillez installer Node.js depuis https://nodejs.org" -ForegroundColor Yellow
    pause
    exit 1
}

# Créer l'environnement virtuel Python
Write-Host "[INFO] Création de l'environnement virtuel Python..." -ForegroundColor Yellow
python -m venv .venv
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Impossible de créer l'environnement virtuel" -ForegroundColor Red
    pause
    exit 1
}

# Activer l'environnement virtuel et installer les dépendances
Write-Host "[INFO] Installation des dépendances Python..." -ForegroundColor Yellow
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Impossible d'installer les dépendances Python" -ForegroundColor Red
    pause
    exit 1
}

# Installer les dépendances Node.js
Write-Host "[INFO] Installation des dépendances Node.js..." -ForegroundColor Yellow
Set-Location frontend
npm install
Set-Location ..
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Impossible d'installer les dépendances Node.js" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Installation terminée!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Pour lancer l'application en développement:" -ForegroundColor Cyan
Write-Host "  .\start-dev.bat" -ForegroundColor White
Write-Host ""
Write-Host "Ou le launcher simple (identique a Desk-top):" -ForegroundColor Cyan
Write-Host "  .\run_scybe.bat" -ForegroundColor White
Write-Host ""
pause
