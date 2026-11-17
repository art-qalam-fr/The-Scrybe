const noop = () => {};

export class ElectronDesktopAdapter {
    constructor(electronApi = globalThis.window?.electronAPI) {
        this.api = electronApi || {};
    }

    get kind() { return 'electron'; }
    minimize() { return this.api.minimizeWindow?.(); }
    maximize() { return this.api.maximizeWindow?.(); }
    close() { return this.api.closeWindow?.(); }
    resizeToContent(width, height) { return this.api.resizeToContent?.(width, height); }
    setWidgetOpacity(opacity) { return this.api.setWidgetOpacity?.(opacity); }
    getAutostart() { return this.api.getAutostart?.(); }
    setAutostart(enabled) { return this.api.setAutostart?.(enabled); }
    onNavigate(callback) { return this.api.onNavigate?.(callback) || noop; }
    getPendingNavigate() { return this.api.getPendingNavigate?.(); }
}

export class WebMockAdapter {
    constructor({ onNavigate } = {}) {
        this.listeners = new Set();
        if (onNavigate) this.listeners.add(onNavigate);
    }

    get kind() { return 'web-mock'; }
    minimize() {}
    maximize() {}
    close() {}
    resizeToContent() {}
    setWidgetOpacity() {}
    async getAutostart() { return false; }
    async setAutostart() { return false; }
    onNavigate(callback) {
        if (typeof callback !== 'function') return noop;
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    getPendingNavigate() { return null; }
    emitNavigate(tab) { this.listeners.forEach((callback) => callback(tab)); }
}

export function createPlatformAdapter({ windowObject = globalThis.window } = {}) {
    return windowObject?.electronAPI
        ? new ElectronDesktopAdapter(windowObject.electronAPI)
        : new WebMockAdapter();
}
