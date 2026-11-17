const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    setWidgetOpacity: (opacity) => ipcRenderer.send('set-widget-opacity', opacity),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    resizeToContent: (width, height) => ipcRenderer.send('resize-to-content', { width, height }),
    getAutostart: () => ipcRenderer.invoke('get-autostart'),
    setAutostart: (enable) => ipcRenderer.invoke('set-autostart', enable),
    onNavigate: (callback) => {
        const handler = (_event, tab) => {
            if (typeof callback === 'function') {
                callback(tab);
            }
        };
        ipcRenderer.on('navigate', handler);
        // Retourne une fonction de nettoyage
        return () => ipcRenderer.removeListener('navigate', handler);
    },
    // Permet de vérifier si un message de navigation est en attente
    getPendingNavigate: () => ipcRenderer.sendSync('get-pending-navigate')
});
