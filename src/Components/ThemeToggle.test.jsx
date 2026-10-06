import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ThemeToggle from './ThemeToggle';

// needed for act() in React 19
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function renderToggle(theme, setTheme = jest.fn()) {
    act(() => {
        root.render(<ThemeToggle theme={theme} setTheme={setTheme} />);
    });
    return setTheme;
}

const buttons = () => [...container.querySelectorAll('button')];
const button = (label) => buttons().find((item) => item.textContent.trim() === label);

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test('shows light, dark and colorblind buttons in a labelled group', () => {
    renderToggle('dark');
    expect(container.querySelector('[role="group"]').getAttribute('aria-label')).toBe('Color theme');
    expect(buttons().map((item) => item.textContent.trim())).toEqual(['Light', 'Dark', 'Colorblind']);
});

test('marks only the current theme as pressed', () => {
    renderToggle('colorblind');
    expect(button('Colorblind').getAttribute('aria-pressed')).toBe('true');
    expect(button('Light').getAttribute('aria-pressed')).toBe('false');
    expect(button('Dark').getAttribute('aria-pressed')).toBe('false');
});

test('clicking a button asks for that theme', () => {
    const setTheme = renderToggle('dark');
    act(() => {
        button('Light').click();
    });
    expect(setTheme).toHaveBeenCalledWith('light');
});
