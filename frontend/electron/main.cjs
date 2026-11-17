const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const isDev = !app.isPackaged;

// Nom d'app dédié AVANT tout usage : sinon app.getName()='frontend' (nom
// package.json) et le profil userData devient %APPDATA%/frontend — partagé
// avec TOUTE autre app Electron scaffoldée "frontend" -> verrous de cache,
// "Network service crashed", renderer qui ne charge jamais, fenêtre
// transparente qui ne peint rien. Isolé : %APPDATA%/the-scrybe.
app.setName('the-scrybe');
// En développement, isoler le profil Chromium du profil utilisateur. Un
// cache verrouillé/corrompu pouvait retarder le démarrage de plusieurs
// minutes et empêcher le renderer de peindre. Aucun réglage utilisateur
// n'est supprimé : la production continue d'utiliser the-scrybe.
if (isDev && process.env.APPDATA) {
    app.setPath('userData', path.join(process.env.APPDATA, `the-scrybe-dev-${process.pid}`));
}

// --- Logs persistants : %APPDATA%/the-scrybe/logs/electron.log (rotation 5 Mo) ---
// userData et non le dossier d'installation : resources/logs est non inscriptible
// sous Program Files, ce qui tuait silencieusement tout le logging en installe.
try {
    const LOG_DIR = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const logFile = path.join(LOG_DIR, 'electron.log');
    try {
        if (fs.statSync(logFile).size > 5 * 1024 * 1024) {
            fs.renameSync(logFile, logFile + '.1');
        }
    } catch (e) { /* pas de fichier = pas de rotation */ }
    // appendFileSync et non createWriteStream : le stream bufferise ~16 Ko et
    // les logs restent invisibles tant que le buffer n'est pas vidé — inutile
    // pour déboguer un freeze en temps réel.
    const toFile = (args) => {
        try {
            fs.appendFileSync(logFile, new Date().toISOString() + ' ' +
                args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n');
        } catch (e) {}
    };
    for (const m of ['log', 'info', 'warn', 'error']) {
        const orig = console[m].bind(console);
        console[m] = (...a) => { orig(...a); toFile(a); };
    }
    process.on('uncaughtException', (e) => {
        toFile(['UNCAUGHT', e.stack || String(e)]);
    });
    process.on('unhandledRejection', (e) => {
        toFile(['UNHANDLED_REJECTION', (e && e.stack) || String(e)]);
    });
} catch (e) { /* le logging ne doit jamais empêcher le démarrage */ }

// SCRYBE_DISABLE_GPU=1 : secours diagnostic — désactive l'accélération
// matérielle si le service réseau/renderer crash (driver GPU, fenêtre
// transparente + vieille carte). Doit être appelé AVANT app ready.
if (process.env.SCRYBE_DISABLE_GPU === '1') {
    app.disableHardwareAcceleration();
}

// Single instance lock - empêche les instances multiples
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    // app.exit() est SYNCHRONE : app.quit() est async et whenReady() pouvait
    // encore s'exécuter -> la 2e instance spawnait un second backend Python
    // (double listener hotkeys + double bind du port 5000 sous Windows).
    app.exit(0);
}

// Gestion de la seconde instance - ouvre la fenêtre existante au lieu de créer une nouvelle
app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Une autre instance a essayé de démarrer, on focus la fenêtre existante
    if (mainWindow) {
        showMainWindow();
        // Vérifier si l'argument --open-settings est présent
        if (commandLine.includes('--open-settings')) {
            pendingNavigate = 'settings'; // Stocker pour le renderer
            try {
                mainWindow.webContents.send('navigate', 'settings');
            } catch (e) {
                // ignore
            }
        }
    }
});

let mainWindow;
let widgetWindow;
let tray = null;
let pythonProcess = null;
let isQuitting = false;
let pendingNavigate = null; // Stocke la navigation en attente (ex: 'settings')
let signalCheckInterval = null; // Interval pour vérifier le fichier signal

// Vérifier le fichier signal pour les demandes de navigation (développement)
function checkSignalFile() {
    try {
        const signalPath = path.join(app.getAppPath(), '..', '.scrybe-open-settings');
        if (fs.existsSync(signalPath)) {
            const content = fs.readFileSync(signalPath, 'utf8').trim();
            fs.unlinkSync(signalPath); // Supprimer après lecture
            
            if (content === 'settings' && mainWindow) {
                showMainWindow();
                pendingNavigate = 'settings';
                try {
                    mainWindow.webContents.send('navigate', 'settings');
                } catch (e) {}
            }
        }
    } catch (e) {
        // ignore
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        minWidth: 700,
        minHeight: 480,
        show: false, // Hidden on startup as requested
        skipTaskbar: true, // Not in taskbar
        frame: false,
        // SCRYBE_OPAQUE=1 : debug — désactive la transparence.
        // SCRYBE_DISABLE_GPU=1 : rendu logiciel — la transparence ne PEUT PAS
        // fonctionner sans accélération GPU (DirectComposition requis) :
        // une fenêtre transparente en mode logiciel ne peint rien du tout.
        transparent: process.env.SCRYBE_OPAQUE !== '1' && process.env.SCRYBE_DISABLE_GPU !== '1',
        title: 'The Scybe',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            // Fenêtre tray : le renderer reste actif même caché — sinon il est
            // suspendu et l'UI met des secondes à répondre quand on la montre
            backgroundThrottling: false,
        },
    });

    const url = isDev
        ? `http://localhost:5173/?electron_boot=${Date.now()}`
        : `file://${path.join(__dirname, '../dist/index.html')}`;

    let loadRetries = 0;
    console.log(`[Win] mainWindow créée, chargement ${url}`);
    mainWindow.loadURL(url);

    // Télémétrie cycle de vie — sans ça on débogue les fenêtres invisibles à l'aveugle
    mainWindow.webContents.on('did-finish-load', async () => {
        console.log('[Win] mainWindow did-finish-load');
        // did-finish-load signifie seulement que le document est chargé, pas
        // que React a réussi son montage. Vérifier le root pour détecter un
        // renderer blanc/crashé et recharger une seule fois avec une URL fraîche.
        try {
            const rootLength = await mainWindow.webContents.executeJavaScript(
                'document.getElementById("root")?.innerHTML?.length || 0', true);
            console.log(`[Win] mainWindow root length=${rootLength}`);
            if (!rootLength && !mainWindow.__blankRecoveryAttempted) {
                mainWindow.__blankRecoveryAttempted = true;
                console.error('[Win] mainWindow blank renderer — reload recovery');
                setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.loadURL(`http://localhost:5173/?electron_recovery=${Date.now()}`);
                    }
                }, 500);
            }
        } catch (error) {
            console.error(`[Win] mainWindow DOM probe failed: ${error.message}`);
        }
    });
    mainWindow.webContents.on('did-fail-load', (e, code, desc) => console.error(`[Win] mainWindow did-fail-load ${code} ${desc}`));
    mainWindow.webContents.on('console-message', (e) => {
        try { console.log(`[Renderer:main] ${e.message}`); } catch (x) {}
    });
    mainWindow.on('ready-to-show', () => {
        console.log('[Win] mainWindow ready-to-show');
        // Afficher après peinture : une fenêtre show:false restait sinon
        // entièrement dépendante du tray, ce qui donnait l'impression que
        // l'application ne s'était pas lancée.
        showMainWindow();
    });
    mainWindow.on('show', () => console.log('[Win] mainWindow show'));
    mainWindow.on('hide', () => console.log('[Win] mainWindow hide'));
    mainWindow.on('focus', () => console.log('[Win] mainWindow focus'));
    mainWindow.on('closed', () => console.log('[Win] mainWindow closed'));

    // Si le dev server n'est pas prêt (ou a crashé), retenter au lieu de
    // laisser une page morte affichée indéfiniment
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
        console.error(`loadURL failed (${errorCode} ${errorDesc})`);
        if (loadRetries < 10) {
            loadRetries++;
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.loadURL(url);
                }
            }, 1500);
        }
    });
    mainWindow.webContents.on('did-finish-load', () => { loadRetries = 0; });

    // Si le renderer meurt, recréer une fenêtre propre plutôt que garder un cadavre
    mainWindow.webContents.on('render-process-gone', () => {
        console.error('Renderer crashed, recreating window');
        if (mainWindow) { mainWindow.destroy(); mainWindow = null; }
        createWindow();
    });
    mainWindow.webContents.on('unresponsive', () => {
        console.error('Renderer unresponsive, reloading');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.reload();
        }
    });

    // Prevent window from being destroyed on close, just hide it
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });

    if (isDev) {
        // mainWindow.webContents.openDevTools();
    }
}

// La fenêtre suit le contenu : le renderer mesure la hauteur de l'onglet actif
// et demande un ajustement (borné pour éviter les fenêtres absurdes).
ipcMain.on('resize-to-content', (event, size) => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMaximized() || mainWindow.isMinimized()) return;
    const w = Math.min(Math.max(Math.round(size?.width) || 1000, 700), 1400);
    const h = Math.min(Math.max(Math.round(size?.height) || 800, 480), 1000);
    mainWindow.setContentSize(w, h);
});

function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
    if (mainWindow.isMinimized()) mainWindow.restore();
    // Focus-stealing prevention Windows : on épingle au premier plan, on
    // montre, on focus, PUIS on relâche alwaysOnTop APRÈS un délai — sinon le
    // SetWindowPos(NOTOPMOST) synchrone renvoie la fenêtre au fond de la pile
    // Z et l'utilisateur ne voit rien (clic suivant -> hide() -> "tray mort").
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.focus();
    try {
        console.log(`[Win] mainWindow shown bounds=${JSON.stringify(mainWindow.getBounds())}`);
    } catch (_) {}
    setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
        }
    }, 800);
}

function createWidgetWindow() {
    if (widgetWindow) return;

    widgetWindow = new BrowserWindow({
        width: 80,
        height: 80,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        frame: false,
        // SCRYBE_OPAQUE=1 / SCRYBE_DISABLE_GPU=1 : la transparence exige
        // DirectComposition (GPU). Sans GPU, fenêtre transparente = invisible.
        transparent: process.env.SCRYBE_OPAQUE !== '1' && process.env.SCRYBE_DISABLE_GPU !== '1',
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        hasShadow: false,
        // Le widget ne doit JAMAIS prendre le focus clavier : sinon un clic
        // dessus vole le focus au champ cible de l'utilisateur, et le Ctrl+V
        // d'injection part dans le widget au lieu de l'application externe.
        focusable: false
    });
    widgetWindow.setFocusable(false);

    const url = isDev
        ? `http://localhost:5173/?window=widget&electron_boot=${Date.now()}`
        : `file://${path.join(__dirname, '../dist/index.html?window=widget')}`;

    console.log(`[Win] widgetWindow créée, chargement ${url}`);
    widgetWindow.loadURL(url);

    widgetWindow.webContents.on('did-finish-load', async () => {
        console.log('[Win] widgetWindow did-finish-load');
        try {
            const rootLength = await widgetWindow.webContents.executeJavaScript(
                'document.getElementById("root")?.innerHTML?.length || 0', true);
            console.log(`[Win] widgetWindow root length=${rootLength}`);
            if (!rootLength && !widgetWindow.__blankRecoveryAttempted) {
                widgetWindow.__blankRecoveryAttempted = true;
                console.error('[Win] widgetWindow blank renderer — reload recovery');
                setTimeout(() => {
                    if (widgetWindow && !widgetWindow.isDestroyed()) {
                        widgetWindow.loadURL(`http://localhost:5173/?window=widget&electron_recovery=${Date.now()}`);
                    }
                }, 500);
            }
        } catch (error) {
            console.error(`[Win] widgetWindow DOM probe failed: ${error.message}`);
        }
    });
    // Même retry que la fenêtre principale : si Vite n'est pas prêt au boot,
    // sinon le widget restait indéfiniment sur une page morte
    let widgetRetries = 0;
    widgetWindow.webContents.on('did-fail-load', (e, code, desc) => {
        console.error(`[Win] widgetWindow did-fail-load ${code} ${desc}`);
        if (widgetRetries < 10) {
            widgetRetries++;
            setTimeout(() => {
                if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.loadURL(url);
            }, 1500);
        }
    });
    widgetWindow.webContents.on('did-finish-load', () => { widgetRetries = 0; });
    widgetWindow.webContents.on('console-message', (e) => {
        try { console.log(`[Renderer:widget] ${e.message}`); } catch (x) {}
    });
    widgetWindow.webContents.on('render-process-gone', (e, d) => console.error(`[Win] widget renderer gone: ${JSON.stringify(d)}`));
    widgetWindow.on('closed', () => {
        console.log('[Win] widgetWindow closed');
        widgetWindow = null;
    });
}

function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');

    // Check if icon exists on disk
    if (!fs.existsSync(iconPath)) {
        console.error("CRITICAL: Tray icon not found at", iconPath);
        // Fallback to a generated colored rectangle to avoid empty tray
        tray = new Tray(nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALElEQVR42mNkYPh/BEYAnX+G/0fBCIDhcB4DA0ZGRgaG/0fBCIDhcB4DA0ZGRAA59B/hN2fNowAAAABJRU5ErkJggg=='));
    } else {
        const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
        tray = new Tray(image);
    }

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Ouvrir Scybe', click: () => {
                showMainWindow();
            }
        },
        {
            label: 'Widget (Afficher/Masquer)', click: () => {
                if (widgetWindow) widgetWindow.close(); else createWidgetWindow();
            }
        },
        {
            label: 'Parametres', click: () => {
                showMainWindow();
                pendingNavigate = 'settings'; // Stocker pour le renderer
                try {
                    mainWindow.webContents.send('navigate', 'settings');
                } catch (e) {
                    // ignore
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quitter', click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('The Scrybe');
    tray.setContextMenu(contextMenu);

    // Clic gauche : toggle de la fenêtre (convention Windows pour les apps tray).
    // Avant, seul le double-clic était géré -> l'icône semblait morte au clic.
    tray.on('click', () => {
        console.log(`[Tray] click — mainWindow=${!!mainWindow} visible=${mainWindow && !mainWindow.isDestroyed() ? mainWindow.isVisible() : 'n/a'}`);
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            showMainWindow();
        }
    });
}

async function startPythonBackend() {
    // Si un backend orphelin tourne encore (Electron précédent tué sans
    // nettoyage), le réutiliser plutôt que doubler : double-bind du port 5000
    // + double listener pynput = hotkeys traitées deux fois.
    try {
        const res = await fetch('http://127.0.0.1:5000/api/status', { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
            console.log('[Backend] Instance existante détectée sur :5000, réutilisation');
            return;
        }
    } catch (e) {
        // pas de backend -> on lance
    }

    const rootDir = path.join(app.getAppPath(), '..');
    let backendExe, backendArgs, backendCwd;
    if (app.isPackaged) {
        // Mode installe : backend gele PyInstaller dans resources/backend/.
        // DB/logs partent dans %LOCALAPPDATA%/TheScrybe (cf. backend/paths.py).
        backendExe = path.join(process.resourcesPath, 'backend', 'scrybe-backend.exe');
        backendArgs = [];
        backendCwd = path.dirname(backendExe);
    } else {
        const backendPath = path.join(rootDir, 'backend', 'flask_api.py');
        // Binaire renommé : le backend apparaît comme "scrybe-backend.exe" dans
        // les scanners de ports (Cerber Security Shield) au lieu de "python.exe".
        // Repli sur python.exe si la copie n'a pas encore été créée.
        const scrybePy = path.join(rootDir, '.venv', 'Scripts', 'scrybe-backend.exe');
        backendExe = fs.existsSync(scrybePy)
            ? scrybePy
            : path.join(rootDir, '.venv', 'Scripts', 'python.exe');
        backendArgs = [backendPath];
    }

    console.log(`Starting Python Backend with: ${backendExe}`);

    pythonProcess = spawn(backendExe, backendArgs, {
        env: { ...process.env, PORT: '5000', PYTHONIOENCODING: 'utf-8' },
        cwd: backendCwd,
        windowsHide: true,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    pythonProcess.on('error', (err) => {
        console.error(`[Backend SPAWN FAILED]: ${err.stack || err}`);
    });
    pythonProcess.on('exit', (code, signal) => {
        console.log(`[Backend] exited code=${code} signal=${signal}`);
    });

    pythonProcess.stdout.on('data', (data) => {
        console.log(`[Backend]: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        // Ignore noisy polling logs
        if (output.includes('GET /api/status') || output.includes('GET /api/history')) {
            return;
        }
        if (output.includes('Traceback') || output.includes('Error:')) {
            console.error(`[Backend ERROR]: ${data}`);
        } else {
            console.info(`[Backend]: ${data}`);
        }
    });
}

function runPowershell(scriptContent) {
    return new Promise((resolve) => {
        const tempPath = path.join(os.tmpdir(), `scrybe_${Date.now()}.ps1`);
        try {
            fs.writeFileSync(tempPath, scriptContent, { encoding: 'utf8' });
            exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPath}"`, (error, stdout, stderr) => {
                if (error) console.error('PowerShell Error:', error);
                if (stderr) console.error('PowerShell Stderr:', stderr);
                try {
                    fs.unlinkSync(tempPath);
                } catch (e) {
                    // ignore cleanup errors
                }
                resolve({ success: !error });
            });
        } catch (e) {
            console.error('Failed to write temp PowerShell file:', e);
            resolve({ success: false });
        }
    });
}

async function ensureDesktopContextMenu() {
    if (process.platform !== 'win32') {
        return;
    }

    try {
        const rootDir = path.join(app.getAppPath(), '..');
        const vbsPath = path.join(rootDir, 'Desk-top.vbs');
        const vbsSettingsPath = path.join(rootDir, 'Desk-top-settings.vbs');
        const batPath = path.join(rootDir, 'Desk-top.bat');

        let appCommand = null;
        if (fs.existsSync(vbsPath)) {
            const vbs = `"${vbsPath.replace(/\\/g, '\\\\')}"`;
            appCommand = `wscript.exe ${vbs}`;
        } else if (fs.existsSync(batPath)) {
            appCommand = `"${batPath.replace(/\\/g, '\\\\')}"`;
        } else {
            console.warn('Desktop context menu: no launcher script found, skipping shell integration');
            return;
        }

        // Pour les paramètres, utiliser le script VBS dédié
        let settingsCommand = null;
        if (fs.existsSync(vbsSettingsPath)) {
            const vbsSet = `"${vbsSettingsPath.replace(/\\/g, '\\\\')}"`;
            settingsCommand = `wscript.exe ${vbsSet}`;
        }

        const keyPath = 'HKCU:\\Software\\Classes\\DesktopBackground\\Shell\\TheScrybe';

        const psCmd = `
          $key = "${keyPath}"
          if (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
          Set-ItemProperty -Path $key -Name "MUIVerb" -Value "The Scrybe"
          Set-ItemProperty -Path $key -Name "SubCommands" -Value ""

          $shellKey = "$key\\Shell"
          if (!(Test-Path $shellKey)) { New-Item -Path $shellKey -Force | Out-Null }

          $openKey = "$shellKey\\01_Open"
          if (!(Test-Path $openKey)) { New-Item -Path $openKey -Force | Out-Null }
          Set-ItemProperty -Path $openKey -Name "(default)" -Value "Ouvrir The Scrybe"
          $openCmd = "$openKey\\command"
          if (!(Test-Path $openCmd)) { New-Item -Path $openCmd -Force | Out-Null }
          Set-ItemProperty -Path $openCmd -Name "(default)" -Value '${appCommand}'

          ${settingsCommand ? `
          $settingsKey = "$shellKey\\02_Settings"
          if (!(Test-Path $settingsKey)) { New-Item -Path $settingsKey -Force | Out-Null }
          Set-ItemProperty -Path $settingsKey -Name "(default)" -Value "Parametres"
          $settingsCmd = "$settingsKey\\command"
          if (!(Test-Path $settingsCmd)) { New-Item -Path $settingsCmd -Force | Out-Null }
          Set-ItemProperty -Path $settingsCmd -Name "(default)" -Value '${settingsCommand}'
          ` : ''}
        `;

        await runPowershell(psCmd);
    } catch (e) {
        console.error('Failed to ensure desktop context menu:', e);
    }
}

app.whenReady().then(async () => {
    startPythonBackend();
    createWindow();
    createWidgetWindow();
    createTray();
    await ensureDesktopContextMenu();

    // En développement, surveiller le fichier signal pour les demandes de navigation
    if (isDev) {
        signalCheckInterval = setInterval(checkSignalFile, 1000);
    }

    if (process.env && process.env.SCRYBE_OPEN_SETTINGS === '1') {
        if (mainWindow) {
            mainWindow.once('ready-to-show', () => {
                showMainWindow();
                try { mainWindow.webContents.send('navigate', 'settings'); } catch (e) {}
            });
        }
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // We stay running in tray
    }
});

app.on('will-quit', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
});

// ipcMain.on('set-widget-opacity', (event, opacity) => {
//     if (widgetWindow) {
//         widgetWindow.setOpacity(opacity);
//     }
// });

ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.hide();
});

// Handler pour récupérer la navigation en attente (utilisé par le renderer au démarrage)
ipcMain.on('get-pending-navigate', (event) => {
    event.returnValue = pendingNavigate;
    pendingNavigate = null; // Consommé
});

ipcMain.handle('get-autostart', async () => {
    const settings = app.getLoginItemSettings();
    return { enabled: !!settings.openAtLogin };
});

ipcMain.handle('set-autostart', async (event, enable) => {
    if (process.platform !== 'win32') {
        return { enabled: false };
    }
    app.setLoginItemSettings({
        openAtLogin: !!enable,
        path: process.execPath
    });
    const settings = app.getLoginItemSettings();
    return { enabled: !!settings.openAtLogin };
});
