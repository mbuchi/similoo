// Light/dark theme toggle.
//
// The actual theme attribute (`data-theme="light|dark"` on <html>) is set
// by the inline pre-paint script in index.html — before any stylesheet
// loads, so dark-mode visitors don't see a white flash. This module:
//
//   * wires the navbar sun/moon button to flip the attribute on click
//   * persists the choice to localStorage so it survives reloads
//   * keeps the button's icon + ARIA label in sync with the current theme
//   * follows system `prefers-color-scheme` changes ONLY when the user
//     hasn't picked an explicit preference yet (no clobbering after
//     they've made a choice)
//
// If you change the storage key or attribute name, change the inline
// bootstrap in index.html to match.

const STORAGE_KEY = 'hood-theme';
const ATTR = 'data-theme';

function getStoredTheme() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v === 'light' || v === 'dark' ? v : null;
    } catch {
        return null;
    }
}

function getCurrentTheme() {
    return document.documentElement.getAttribute(ATTR) === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
    document.documentElement.setAttribute(ATTR, theme);
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // localStorage may be disabled (private mode, etc.) — fall through.
    }
    syncButton(theme);
}

function syncButton(theme) {
    const button = document.getElementById('themeToggleButton');
    if (!button) return;
    const isDark = theme === 'dark';
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute(
        'aria-label',
        isDark ? 'Switch to light mode' : 'Switch to dark mode'
    );
    button.setAttribute(
        'title',
        isDark ? 'Switch to light mode' : 'Switch to dark mode'
    );
}

export function setupThemeToggle() {
    const button = document.getElementById('themeToggleButton');
    if (!button) return;

    syncButton(getCurrentTheme());

    button.addEventListener('click', () => {
        const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    });

    // Track system preference only while the user has no explicit choice.
    // Once they flip the toggle, applyTheme writes to localStorage and the
    // `getStoredTheme()` guard below stops listening to OS-level changes.
    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e) => {
            if (getStoredTheme() !== null) return;
            applyTheme(e.matches ? 'dark' : 'light');
        };
        if (mq.addEventListener) {
            mq.addEventListener('change', onChange);
        } else if (mq.addListener) {
            mq.addListener(onChange);
        }
    }
}
