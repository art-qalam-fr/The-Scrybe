// Tokens portables extraits de la charte Electron existante.
// Ce module ne modifie pas App.css : il prépare la future UI React.

export const themeTokens = Object.freeze({
    glass: { primary: '#a855f7', secondary: '#6366f1' },
    light: { primary: '#3498db', secondary: '#2980b9' },
    dark: { primary: '#7f8c8d', secondary: '#ecf0f1' },
    frosted: { primary: '#bdc3c7', secondary: '#95a5a6' },
    blue: { primary: '#2980b9', secondary: '#3498db' },
    green: { primary: '#27ae60', secondary: '#2ecc71' },
    amber: { primary: '#f39c12', secondary: '#e67e22' },
    violet: { primary: '#8e44ad', secondary: '#9b59b6' },
    teal: { primary: '#16a085', secondary: '#1abc9c' },
    sunset: { primary: '#e67e22', secondary: '#c0392b' }
});

export const cssVariableNames = Object.freeze([
    '--cur-bg', '--cur-opacity', '--cur-blur', '--cur-radius',
    '--cur-border-color', '--cur-border-width', '--icon-color-primary',
    '--icon-color-secondary', '--icon-color-recording', '--icon-color-transcribing'
]);

export const defaultDesignTokens = Object.freeze({
    background: '#1a5276',
    opacity: 70,
    blur: 10,
    radius: 12,
    borderColor: '#2e86c1',
    borderStyle: 'thin',
    transition: 'all 0.25s ease'
});

export function getThemeTokens(themeVariant = 'glass') {
    return themeTokens[themeVariant] || themeTokens.glass;
}
