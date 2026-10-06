import { flushSync } from 'react-dom';

export const THEME_KEY = 'theme';
export const THEMES = ['dark', 'light', 'colorblind'];

const FALLBACK_THEME = 'dark';

const isTheme = (value) => THEMES.includes(value);

function prefers(query) {
    return Boolean(window.matchMedia && window.matchMedia(query).matches);
}

// index.html has a copy of this for the first paint, keep them in sync
export function getInitialTheme() {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (isTheme(saved)) return saved;
    } catch (error) {
        // storage blocked
    }
    return prefers('(prefers-color-scheme: light)') ? 'light' : FALLBACK_THEME;
}

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

// only saved when someone picks a theme, so first-time visitors keep following the OS
function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
        // storage blocked
    }
}

// css transitions can't fade gradients, so cross-fade the whole page with view transitions
// (instant if the browser doesn't have them or reduced motion is on)
export function changeTheme(theme, setTheme) {
    if (!isTheme(theme)) return;
    saveTheme(theme);

    if (document.startViewTransition && !prefers('(prefers-reduced-motion: reduce)')) {
        // the new theme has to be on the page when this callback returns
        document.startViewTransition(() => {
            applyTheme(theme);
            flushSync(() => setTheme(theme));
        });
    } else {
        setTheme(theme);
    }
}
