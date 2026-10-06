import fs from 'fs';
import path from 'path';
import { THEME_KEY, THEMES, getInitialTheme, applyTheme, changeTheme } from './theme';

// jsdom has no matchMedia
function mockMatchMedia({ light = false, reducedMotion = false } = {}) {
    window.matchMedia = jest.fn((query) => ({
        matches:
            (query === '(prefers-color-scheme: light)' && light) ||
            (query === '(prefers-reduced-motion: reduce)' && reducedMotion)
    }));
}

function blockStorage() {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('storage blocked');
    });
}

beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.startViewTransition;
    delete window.matchMedia;
    jest.restoreAllMocks();
});

test('offers dark, light and colorblind themes', () => {
    expect(THEMES).toEqual(['dark', 'light', 'colorblind']);
});

describe('getInitialTheme', () => {
    test('uses the saved theme', () => {
        localStorage.setItem(THEME_KEY, 'colorblind');
        expect(getInitialTheme()).toBe('colorblind');
    });

    test('a saved theme beats the OS setting', () => {
        mockMatchMedia({ light: true });
        localStorage.setItem(THEME_KEY, 'dark');
        expect(getInitialTheme()).toBe('dark');
    });

    test('follows an OS that prefers light when nothing is saved', () => {
        mockMatchMedia({ light: true });
        expect(getInitialTheme()).toBe('light');
    });

    test('is dark when nothing is saved and the OS has no light preference', () => {
        mockMatchMedia({ light: false });
        expect(getInitialTheme()).toBe('dark');
    });

    test('is dark when the browser cannot report the OS setting', () => {
        expect(getInitialTheme()).toBe('dark');
    });

    test('ignores a saved value that is not a theme', () => {
        localStorage.setItem(THEME_KEY, 'neon-pink');
        expect(getInitialTheme()).toBe('dark');
    });

    test('does not crash when storage is blocked', () => {
        mockMatchMedia({ light: true });
        blockStorage();
        expect(getInitialTheme()).toBe('light');
    });
});

describe('applyTheme', () => {
    test('puts the theme on the page', () => {
        applyTheme('light');
        expect(document.documentElement.dataset.theme).toBe('light');
    });

    test('does not save anything, so a first-time visitor keeps following the OS setting', () => {
        applyTheme('light');
        expect(localStorage.getItem(THEME_KEY)).toBeNull();
    });
});

describe('changeTheme', () => {
    test('asks for the theme and saves it', () => {
        const setTheme = jest.fn();
        changeTheme('colorblind', setTheme);
        expect(setTheme).toHaveBeenCalledWith('colorblind');
        expect(localStorage.getItem(THEME_KEY)).toBe('colorblind');
    });

    test('ignores a theme name it does not know', () => {
        const setTheme = jest.fn();
        changeTheme('neon-pink', setTheme);
        expect(setTheme).not.toHaveBeenCalled();
        expect(localStorage.getItem(THEME_KEY)).toBeNull();
    });

    test('still changes the theme when storage is blocked', () => {
        blockStorage();
        const setTheme = jest.fn();
        changeTheme('light', setTheme);
        expect(setTheme).toHaveBeenCalledWith('light');
    });

    test('cross-fades with the View Transitions API, with the new theme on the page before it returns', () => {
        document.startViewTransition = jest.fn((update) => update());
        const setTheme = jest.fn();
        changeTheme('light', setTheme);
        expect(document.startViewTransition).toHaveBeenCalledTimes(1);
        expect(document.documentElement.dataset.theme).toBe('light');
        expect(setTheme).toHaveBeenCalledWith('light');
    });

    test('changes instantly for people who prefer reduced motion', () => {
        mockMatchMedia({ reducedMotion: true });
        document.startViewTransition = jest.fn((update) => update());
        const setTheme = jest.fn();
        changeTheme('light', setTheme);
        expect(document.startViewTransition).not.toHaveBeenCalled();
        expect(setTheme).toHaveBeenCalledWith('light');
    });
});

describe('first-paint script in public/index.html', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const runScript = () => {
        delete document.documentElement.dataset.theme;
        new Function(script)();
        return document.documentElement.dataset.theme;
    };

    test('uses the same storage key and theme names as theme.js', () => {
        expect(script).toContain(`'${THEME_KEY}'`);
        THEMES.forEach((theme) => expect(script).toContain(`'${theme}'`));
    });

    test.each([
        ['a saved colorblind theme', { saved: 'colorblind', light: true }],
        ['a saved dark theme with an OS that prefers light', { saved: 'dark', light: true }],
        ['a saved light theme', { saved: 'light', light: false }],
        ['nothing saved, OS prefers light', { light: true }],
        ['nothing saved, OS has no preference', { light: false }],
        ['a saved value that is not a theme', { saved: 'neon-pink', light: true }],
        ['blocked storage', { blocked: true, light: true }]
    ])('picks the same theme as getInitialTheme for %s', (name, { saved, light, blocked }) => {
        mockMatchMedia({ light });
        if (saved) localStorage.setItem(THEME_KEY, saved);
        if (blocked) blockStorage();
        const fromScript = runScript();
        expect(fromScript).toBe(getInitialTheme());
    });
});
