import { DICEBEAR_URL } from './authConfig.js';
import { onAuthChange, login, logout } from './authManager.js';
import { getProfile } from './profileApi.js';
import { openProfileModal } from './profileModal.js';
import { circleUserIcon, logOutIcon, chevronDownIcon } from './icons.js';
import { t, onLocaleChange } from '../i18n.js';

let rootEl = null;
let dropdownOpen = false;
let cachedAvatarIcon = null;
let lastUser = null;

function getDisplayName(user) {
    const p = user?.profile || {};
    return p.name || p.preferred_username || p.given_name || p.email || t('auth.account');
}

function getEmail(user) {
    return user?.profile?.email || '';
}

function getInitials(user) {
    const name = (user?.profile?.name || user?.profile?.preferred_username || '').trim();
    if (name) {
        const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
        return parts.map((p) => p[0].toUpperCase()).join('');
    }
    const email = user?.profile?.email || '';
    return email ? email[0].toUpperCase() : '?';
}

function avatarMarkup(user) {
    if (cachedAvatarIcon) {
        return `<img class="auth-avatar-img" alt="${t('auth.avatar_alt')}" src="${DICEBEAR_URL(cachedAvatarIcon)}" />`;
    }
    const picture = user?.profile?.picture;
    if (picture) {
        return `<img class="auth-avatar-img" alt="${t('auth.avatar_alt')}" src="${picture}" referrerpolicy="no-referrer" />`;
    }
    return `<span class="auth-avatar-initials">${getInitials(user)}</span>`;
}

function renderLoading() {
    rootEl.innerHTML = '<div class="auth-nav-placeholder" aria-hidden="true"></div>';
}

function renderUnauthenticated() {
    rootEl.innerHTML = `
        <button type="button" class="auth-nav-button auth-login-btn" aria-label="${t('auth.sign_in')}" title="${t('auth.sign_in')}">
            ${circleUserIcon(20)}
        </button>
    `;
    rootEl.querySelector('.auth-login-btn').addEventListener('click', () => {
        login();
    });
}

function renderAuthenticated(user) {
    const displayName = getDisplayName(user);
    const email = getEmail(user);
    rootEl.innerHTML = `
        <button type="button" class="auth-nav-button auth-avatar-btn" aria-haspopup="true" aria-expanded="false">
            ${avatarMarkup(user)}
            <span class="auth-chevron">${chevronDownIcon(14)}</span>
        </button>
        <div class="auth-dropdown" role="menu" hidden>
            <div class="auth-dropdown-header">
                <div class="auth-dropdown-avatar">${avatarMarkup(user)}</div>
                <div class="auth-dropdown-meta">
                    <div class="auth-dropdown-name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</div>
                    <div class="auth-dropdown-email" title="${escapeHtml(email)}">${escapeHtml(email)}</div>
                    <div class="auth-dropdown-status">
                        <span class="auth-status-dot"><span class="auth-status-ping"></span></span>
                        ${t('auth.status_active')}
                    </div>
                </div>
            </div>
            <div class="auth-dropdown-items">
                <button type="button" class="auth-dropdown-item" data-action="profile" role="menuitem">
                    ${circleUserIcon(16)}<span>${t('auth.view_profile')}</span>
                </button>
                <button type="button" class="auth-dropdown-item auth-dropdown-item-danger" data-action="logout" role="menuitem">
                    ${logOutIcon(16)}<span>${t('auth.sign_out')}</span>
                </button>
            </div>
        </div>
    `;

    const btn = rootEl.querySelector('.auth-avatar-btn');
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
    });
    rootEl.querySelectorAll('.auth-dropdown-item').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = item.getAttribute('data-action');
            closeDropdown();
            if (action === 'profile') {
                openProfileModal();
            } else if (action === 'logout') {
                logout();
            }
        });
    });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
}

function toggleDropdown() {
    if (dropdownOpen) closeDropdown();
    else openDropdown();
}

function openDropdown() {
    const dropdown = rootEl.querySelector('.auth-dropdown');
    const btn = rootEl.querySelector('.auth-avatar-btn');
    if (!dropdown || !btn) return;
    dropdown.hidden = false;
    rootEl.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    dropdownOpen = true;
}

function closeDropdown() {
    if (!rootEl) return;
    const dropdown = rootEl.querySelector('.auth-dropdown');
    const btn = rootEl.querySelector('.auth-avatar-btn');
    if (dropdown) dropdown.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
    rootEl.classList.remove('is-open');
    dropdownOpen = false;
}

async function refreshAvatarIcon(user) {
    if (!user) {
        cachedAvatarIcon = null;
        return;
    }
    try {
        const profile = await getProfile();
        const next = profile?.avatar_icon || null;
        if (next !== cachedAvatarIcon) {
            cachedAvatarIcon = next;
            if (lastUser) renderAuthenticated(lastUser);
        }
    } catch (e) {
        // Profile API may be unavailable; ignore quietly.
    }
}

export function setupAuthNav() {
    rootEl = document.getElementById('authNav');
    if (!rootEl) {
        console.warn('authNav container not found');
        return;
    }

    document.addEventListener('click', (e) => {
        if (!rootEl.contains(e.target)) closeDropdown();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDropdown();
    });

    window.addEventListener('auth:profile-updated', (e) => {
        const next = e.detail?.avatar_icon || null;
        if (next !== cachedAvatarIcon) {
            cachedAvatarIcon = next;
            if (lastUser) renderAuthenticated(lastUser);
        }
    });

    onAuthChange(({ state, user }) => {
        lastUser = user;
        if (state === 'loading') {
            renderLoading();
        } else if (state === 'authenticated') {
            renderAuthenticated(user);
            refreshAvatarIcon(user);
        } else {
            cachedAvatarIcon = null;
            renderUnauthenticated();
        }
    });

    // Re-render whichever auth-nav variant is currently mounted whenever the
    // locale switches — the avatar dropdown labels ("View profile", "Sign
    // out", "Active") are baked into innerHTML at render time.
    onLocaleChange(() => {
        if (!rootEl) return;
        if (lastUser) {
            renderAuthenticated(lastUser);
        } else {
            // Loading state has no translated strings; only re-render the
            // unauthenticated button (its aria-label / title are translated).
            if (!rootEl.querySelector('.auth-nav-placeholder')) {
                renderUnauthenticated();
            }
        }
    });
}
