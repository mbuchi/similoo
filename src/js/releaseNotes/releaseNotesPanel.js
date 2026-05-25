import { RELEASES, KIND_META, CURRENT_VERSION, REPO_URL } from './releaseNotesData.js';
import { t, onLocaleChange } from '../i18n.js';

// Map the data-side `kind` codes to translation keys. The KIND_META export
// from releaseNotesData.js still carries the colour palette + a default
// English label; we read the label via this function so the filter chips
// stay translated.
const KIND_LABEL_KEYS = {
    new: 'release_notes.kind_new',
    improved: 'release_notes.kind_improved',
    fixed: 'release_notes.kind_fixed',
    docs: 'release_notes.kind_docs',
};

function kindLabel(kind) {
    const key = KIND_LABEL_KEYS[kind];
    return key ? t(key) : (KIND_META[kind]?.label || kind);
}

const STORAGE_KEY = 'hood:lastSeenReleaseVersion';
const HASH = '#release-notes';

let panelEl = null;
let overlayEl = null;
let versionButtonEl = null;
let activeFilter = 'all';
let query = '';
const openVersions = new Set([RELEASES[0].version]);

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function hasUnread() {
    try {
        return localStorage.getItem(STORAGE_KEY) !== CURRENT_VERSION;
    } catch {
        return true;
    }
}

function markRead() {
    try {
        localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    } catch {
        /* ignore */
    }
    refreshUnreadDot();
}

function refreshUnreadDot() {
    if (!versionButtonEl) return;
    const dot = versionButtonEl.querySelector('.rn-version-dot');
    if (dot) dot.style.display = hasUnread() ? '' : 'none';
}

function filterReleases() {
    const q = query.trim().toLowerCase();
    return RELEASES.map((release) => {
        const items = release.items.filter((item) => {
            const kindOk = activeFilter === 'all' || item.kind === activeFilter;
            const queryOk =
                !q ||
                item.text.toLowerCase().includes(q) ||
                release.codename.toLowerCase().includes(q) ||
                release.version.includes(q) ||
                item.prs.some((n) => `#${n}`.includes(q) || String(n) === q);
            return kindOk && queryOk;
        });
        return { ...release, items };
    }).filter((r) => r.items.length > 0);
}

function renderBody() {
    const list = filterReleases();
    const body = panelEl.querySelector('.rn-body');

    if (list.length === 0) {
        body.innerHTML = `<div class="rn-empty"><p>${escapeHtml(t('release_notes.empty'))}</p></div>`;
        return;
    }

    body.innerHTML = `
        <ol class="rn-timeline">
            ${list
                .map((release, idx) => {
                    const isOpen = openVersions.has(release.version);
                    const isLatest = idx === 0 && release.version === RELEASES[0].version;
                    const railClass = idx < list.length - 1 ? 'rn-rail' : '';
                    return `
                <li class="rn-release">
                    ${railClass ? `<span class="${railClass}" aria-hidden></span>` : ''}
                    <div class="rn-release-row">
                        <div class="rn-tag-dot ${isLatest ? 'is-latest' : ''}">
                            <i data-lucide="tag"></i>
                            ${isLatest ? '<span class="rn-ping"></span>' : ''}
                        </div>
                        <div class="rn-release-content">
                            <button class="rn-release-header" data-version="${escapeHtml(release.version)}">
                                <div class="rn-release-meta">
                                    <div class="rn-release-title">
                                        <span class="rn-version-tag">v${escapeHtml(release.version)}</span>
                                        <span class="rn-divider">·</span>
                                        <span class="rn-codename">${escapeHtml(release.codename)}</span>
                                        ${isLatest ? `<span class="rn-latest-badge">${escapeHtml(t('release_notes.latest_badge'))}</span>` : ''}
                                    </div>
                                    <p class="rn-release-date">${escapeHtml(release.date)} · ${release.items.length} ${escapeHtml(release.items.length === 1 ? t('release_notes.change_one') : t('release_notes.change_many'))}</p>
                                </div>
                                <i data-lucide="${isOpen ? 'chevron-up' : 'chevron-down'}" class="rn-chevron"></i>
                            </button>
                            ${
                                isOpen
                                    ? `<div class="rn-release-summary"><p>${escapeHtml(release.summary)}</p></div>
                                <ul class="rn-items">
                                    ${release.items
                                        .map((item) => {
                                            const meta = KIND_META[item.kind];
                                            return `
                                        <li class="rn-item">
                                            <div class="rn-item-icon"><i data-lucide="${escapeHtml(item.icon)}"></i></div>
                                            <div class="rn-item-content">
                                                <div class="rn-item-tags">
                                                    <span class="rn-kind-tag" style="color:${meta.textColor};background:${meta.bgColor};border-color:${meta.borderColor};">
                                                        <span class="rn-kind-dot" style="background:${meta.dotColor}"></span>
                                                        ${escapeHtml(kindLabel(item.kind))}
                                                    </span>
                                                    ${item.prs
                                                        .map(
                                                            (n) => `<a class="rn-pr-tag" href="${REPO_URL}/pull/${n}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(t('release_notes.pr_title', { n }))}"><i data-lucide="git-pull-request"></i>#${n}</a>`
                                                        )
                                                        .join('')}
                                                </div>
                                                <p class="rn-item-text">${escapeHtml(item.text)}</p>
                                            </div>
                                        </li>`;
                                        })
                                        .join('')}
                                </ul>`
                                    : ''
                            }
                        </div>
                    </div>
                </li>`;
                })
                .join('')}
        </ol>`;

    body.querySelectorAll('.rn-release-header').forEach((btn) => {
        btn.addEventListener('click', () => {
            const v = btn.getAttribute('data-version');
            if (openVersions.has(v)) openVersions.delete(v);
            else openVersions.add(v);
            renderBody();
        });
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderPanel() {
    const totalChanges = RELEASES.flatMap((r) => r.items).length;
    const latest = RELEASES[0];

    panelEl = document.createElement('div');
    panelEl.className = 'rn-overlay';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-modal', 'true');
    panelEl.setAttribute('aria-label', t('release_notes.aria_label'));

    panelEl.innerHTML = `
        <div class="rn-backdrop"></div>
        <div class="rn-panel">
            <div class="rn-header">
                <button class="rn-close" aria-label="${escapeHtml(t('release_notes.close_label'))}"><i data-lucide="x"></i></button>
                <div class="rn-header-top">
                    <div class="rn-header-info">
                        <h1 class="rn-title">${escapeHtml(t('release_notes.title'))} <span class="rn-brand"><span class="rn-brand-first">h</span><span class="rn-brand-second">oo</span><span class="rn-brand-first">d</span></span></h1>
                        <p class="rn-subtitle">${escapeHtml(t('release_notes.subtitle', { version: 'v' + latest.version, codename: latest.codename, date: latest.date }))}</p>
                        <div class="rn-pills">
                            <span class="rn-pill rn-pill-live"><span class="rn-pill-dot"></span>v${escapeHtml(latest.version)} ${escapeHtml(t('release_notes.live'))}</span>
                            <span class="rn-pill"><i data-lucide="tag"></i>${escapeHtml(t('release_notes.releases_count', { count: RELEASES.length }))}</span>
                            <span class="rn-pill"><i data-lucide="git-pull-request"></i>${escapeHtml(t('release_notes.changes_count', { count: totalChanges }))}</span>
                            <a class="rn-pill rn-pill-link" href="${REPO_URL}/pulls?q=is%3Apr+is%3Aclosed" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link"></i>${escapeHtml(t('release_notes.view_all_prs'))}</a>
                        </div>
                    </div>
                </div>
                <div class="rn-controls">
                    <div class="rn-search">
                        <i data-lucide="search"></i>
                        <input type="text" class="rn-search-input" placeholder="${escapeHtml(t('release_notes.search_placeholder'))}" />
                    </div>
                    <div class="rn-filters">
                        ${['all', 'new', 'improved', 'fixed', 'docs']
                            .map(
                                (k) =>
                                    `<button class="rn-filter ${activeFilter === k ? 'is-active' : ''}" data-kind="${k}">${escapeHtml(k === 'all' ? t('release_notes.filter_all') : kindLabel(k))}</button>`
                            )
                            .join('')}
                    </div>
                </div>
            </div>
            <div class="rn-body"></div>
            <div class="rn-footer">
                <span>${escapeHtml(t('release_notes.footer'))}</span>
                <button class="rn-close-btn">${escapeHtml(t('release_notes.close_label'))} <kbd>Esc</kbd></button>
            </div>
        </div>`;

    document.body.appendChild(panelEl);
    overlayEl = panelEl;

    panelEl.querySelector('.rn-backdrop').addEventListener('click', closePanel);
    panelEl.querySelector('.rn-close').addEventListener('click', closePanel);
    panelEl.querySelector('.rn-close-btn').addEventListener('click', closePanel);

    const searchInput = panelEl.querySelector('.rn-search-input');
    searchInput.value = query;
    searchInput.addEventListener('input', (e) => {
        query = e.target.value;
        renderBody();
    });

    panelEl.querySelectorAll('.rn-filter').forEach((btn) => {
        btn.addEventListener('click', () => {
            activeFilter = btn.getAttribute('data-kind');
            panelEl.querySelectorAll('.rn-filter').forEach((b) => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            renderBody();
        });
    });

    renderBody();

    requestAnimationFrame(() => panelEl.classList.add('is-visible'));

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function openPanel() {
    if (panelEl) return;
    renderPanel();
    if (window.location.hash !== HASH) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}${HASH}`);
    }
}

function closePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('is-visible');
    const node = panelEl;
    panelEl = null;
    overlayEl = null;
    setTimeout(() => node.remove(), 200);
    markRead();
    if (window.location.hash === HASH) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
}

function renderVersionButton() {
    const brand = document.querySelector('.navbar-brand');
    if (!brand) return;

    versionButtonEl = document.createElement('button');
    versionButtonEl.className = 'rn-version-button';
    versionButtonEl.type = 'button';
    versionButtonEl.title = t('release_notes.whats_new_aria', { version: CURRENT_VERSION });
    versionButtonEl.setAttribute('aria-label', t('release_notes.whats_new_aria', { version: CURRENT_VERSION }));
    versionButtonEl.innerHTML = `
        <i data-lucide="tag"></i>
        <span class="rn-version-dot" style="display:${hasUnread() ? '' : 'none'}"></span>
    `;

    versionButtonEl.addEventListener('click', openPanel);

    const subtitle = brand.querySelector('.logo-subtitle');
    if (subtitle) brand.insertBefore(versionButtonEl, subtitle);
    else brand.appendChild(versionButtonEl);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

export function initReleaseNotes() {
    renderVersionButton();

    window.addEventListener('keydown', (e) => {
        if (!overlayEl) return;
        if (e.key === 'Escape') closePanel();
        if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
            e.preventDefault();
            overlayEl.querySelector('.rn-search-input')?.focus();
        }
    });

    if (window.location.hash === HASH) openPanel();
    window.addEventListener('hashchange', () => {
        if (window.location.hash === HASH) openPanel();
    });

    // Refresh the version button's title + re-render an open panel when the
    // locale flips so the chrome (title, footer, filter chips, "Latest"
    // badge, change-count, search placeholder) all come back translated.
    onLocaleChange(() => {
        if (versionButtonEl) {
            const txt = t('release_notes.whats_new_aria', { version: CURRENT_VERSION });
            versionButtonEl.title = txt;
            versionButtonEl.setAttribute('aria-label', txt);
        }
        if (panelEl) {
            // Tear down + rebuild — innerHTML is locale-baked.
            const node = panelEl;
            panelEl = null;
            overlayEl = null;
            node.remove();
            renderPanel();
        }
    });
}
