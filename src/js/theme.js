// Cross-app theme persistence — inline equivalent of @aireon/shared's themeStore.
//
// Each Aireon app lives on its own subdomain (`<app>.aireon.ch`), so the old
// `localStorage['similoo-theme']` never synced across apps. The contract that
// makes the choice carry suite-wide is the COOKIE: `aireon_theme`, scoped to
// `.aireon.ch` (shared by every `*.aireon.ch` app). @aireon/shared writes the
// same cookie/format, so this interoperates with apps that already use the
// shared store. similoo is far behind on @aireon/shared (v1.37.0, which does not
// yet export the theme store), so we inline the ~equivalent here. (Member
// cross-device profile sync is the only thing skipped versus the shared store;
// the cross-app cookie is the core requirement.)

const COOKIE = 'aireon_theme';

// Only set the Domain attribute on real *.aireon.ch hosts; on localhost / Vercel
// preview hosts we fall back to a host-only cookie (still fine for that origin).
function cookieDomain() {
    const h = location.hostname;
    return h === 'aireon.ch' || h.endsWith('.aireon.ch') ? '.aireon.ch' : null;
}

// Stored choice: the cross-app cookie wins over the legacy localStorage mirror.
// Returns 'light' | 'dark' | null (no stored choice).
export function getStoredTheme() {
    const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    let v;
    try {
        v = m ? decodeURIComponent(m[1]) : localStorage.getItem('similoo-theme');
    } catch {
        v = m ? decodeURIComponent(m[1]) : null;
    }
    return v === 'light' || v === 'dark' ? v : null;
}

// Persist a theme choice across the suite: the shared `.aireon.ch` cookie + the
// localStorage mirror + the `.dark` class (the shared glass.css keys its dark
// tokens on `.dark`). similoo's own CSS keys on `<html data-theme>`, which the
// caller stamps; we mirror `.dark` here so glassed surfaces track the theme too.
export function setTheme(theme) {
    const parts = [`${COOKIE}=${theme}`, 'Path=/', 'Max-Age=31536000', 'SameSite=Lax'];
    const d = cookieDomain();
    if (d) parts.push(`Domain=${d}`);
    if (location.protocol === 'https:') parts.push('Secure');
    document.cookie = parts.join('; ');
    try {
        localStorage.setItem('similoo-theme', theme);
    } catch {}
    document.documentElement.classList.toggle('dark', theme === 'dark');
}

// Resolve at boot: stored choice → OS preference → app default. Stamps both the
// `<html data-theme>` attribute (similoo's own CSS) and the `.dark` class
// (shared glass tokens), and returns the resolved theme. Preserves similoo's
// historical default of OS-pref-with-light-fallback when `appDefault` is 'light'.
export function initTheme(appDefault = 'light') {
    let theme = getStoredTheme();
    if (!theme) {
        const prefersDark =
            window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : appDefault;
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    return theme;
}
