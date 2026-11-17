@echo off
echo ========================================
echo   The Scrybe - Installation
echo ========================================
echo.

REM Vérifier Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python n'est pas installe!
    echo Veuillez installer Python depuis https://python.org
    pause
    exit /b 1
)

REM Vérifier Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js n'est pas installe!
    echo Veuillez installer Node.js depuis https://nodejs.org
    pause
    exit /b 1
)

echo [INFO] Creation de l'environnement virtuel Python...
python -m venv .venv

echo [INFO] Activation de l'environnement virtuel...
call .venv\Scripts\activate

echo [INFO] Installation des dependances Python...
pip install -r backend\requirements.txt

echo [INFO] Installation des dependances Node.js...
cd frontend
npm install
cd ..

echo.
echo ========================================
echo   Installation terminee!
echo ========================================
echo.
echo Pour lancer l'application en developpement:
echo   start-dev.bat
echo.
pause
