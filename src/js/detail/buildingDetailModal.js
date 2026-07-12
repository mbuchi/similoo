// Building-detail popup.
//
// Opens an overlay that streams the swissSURFACE3D COPC point-cloud tile
// around a comparable building via Giro3D (the same engine + RES lidar
// pipeline as the suite's lidaroo app). Lazy-mounts the scene on first
// open, reuses the Instance across opens of the same tile, and exposes a
// color-mode radio group — Elevation / Classification / Intensity — in the
// header. (Replaces the old Contoor-GLB Three.js scene and its
// pointcloud/building/basemap layer toggles.)
//
// Public API:
//   const modal = createBuildingDetailModal();
//   modal.show({ lat, lng, label, subtitle });
//   modal.hide();

import { t, onLocaleChange } from '../i18n.js';
// The Giro3D COPC point-cloud scene (three + @giro3d/giro3d, ~130 kB gz + the
// giro3d bundle) is the single heaviest dependency in the app and is only ever
// needed once a comparable building is opened in this modal — never on first
// paint. It is loaded on demand (see show()) so the initial map view no longer
// eagerly downloads or parses the whole 3D stack.

export function createBuildingDetailModal() {
    let root = buildShell();
    document.body.appendChild(root);

    const els = {
        backdrop: root.querySelector('.bdm-backdrop'),
        title: root.querySelector('.bdm-title'),
        subtitle: root.querySelector('.bdm-subtitle'),
        closeBtn: root.querySelector('.bdm-close'),
        colorBtns: Array.from(root.querySelectorAll('.bdm-color-btn')),
        lidarooLink: root.querySelector('.bdm-lidaroo'),
        canvas: root.querySelector('.bdm-canvas'),
        status: root.querySelector('.bdm-status'),
    };

    let scene = null;
    let openSeq = 0;
    let currentTarget = null;
    let lastFocus = null;
    let themeObserver = null;

    els.closeBtn.addEventListener('click', hide);
    els.backdrop.addEventListener('click', hide);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && root.getAttribute('data-state') === 'visible') hide();
    });

    els.colorBtns.forEach((btn) => {
        btn.addEventListener('click', () => selectColorMode(btn.dataset.mode));
    });

    // The chips are a radio group (one color mode is always active), unlike
    // the old scene's independent layer toggles: elevation ramp,
    // ASPRS classification palette, or LiDAR return intensity.
    function selectColorMode(mode) {
        if (!scene) return;
        scene.setColorMode(mode);
        syncColorButtons();
    }

    // Reflect the scene's active color mode onto the chips (aria-pressed
    // marks exactly the one active mode).
    function syncColorButtons() {
        const active = scene ? scene.getColorMode() : 'elevation';
        els.colorBtns.forEach((btn) => {
            btn.setAttribute('aria-pressed', btn.dataset.mode === active ? 'true' : 'false');
        });
    }

    function setStatus(msg) {
        els.status.textContent = msg || '';
        els.status.hidden = !msg;
    }

    // The app's theme is React-controlled: the toggle in App.tsx drives both
    // the `.dark` class and `data-theme` on <html> (see the note near the end
    // of main.js). The scene's canvas background must follow live while the
    // modal is open, so watch documentElement mutations — the same pattern
    // that fixed the theme desync in lidaroo — rather than sampling only at
    // scene creation.
    function watchTheme() {
        if (themeObserver) return;
        themeObserver = new MutationObserver(() => {
            scene?.setDark(document.documentElement.classList.contains('dark'));
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-theme'],
        });
    }

    async function show({ lat, lng, label, subtitle }) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        currentTarget = { lat, lng, label, subtitle };
        els.title.textContent = label || formatLatLng(lat, lng);
        els.subtitle.textContent = subtitle || '';
        els.subtitle.hidden = !subtitle;
        els.lidarooLink.href = lidarooUrl(lat, lng);

        lastFocus = document.activeElement;
        root.setAttribute('data-state', 'visible');
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('bdm-open');
        els.closeBtn.focus();

        if (!scene) {
            // Lazily pull in the Giro3D/three point-cloud scene the first time a
            // building is opened. Keeps the heavy 3D stack out of the eager
            // initial-load bundle.
            const { createCopcScene } = await import('../lidar/copcScene.js');
            // Guard against a second open() racing the chunk load: only the
            // first to return here creates the (reused) scene.
            if (!scene) {
                scene = createCopcScene({ container: els.canvas });
                scene.setDark(document.documentElement.classList.contains('dark'));
                watchTheme();
                syncColorButtons();
            }
        }

        const seq = ++openSeq;
        setStatus(t('detail.loading'));
        try {
            await scene.loadAt({
                lat,
                lng,
                // A cold tile converts on the RES box for ~45 s (cached tiles
                // are instant); narrate the progress so the wait reads as work,
                // not a hang.
                onProgress: (percent) => {
                    if (seq !== openSeq) return;
                    setStatus(t('detail.preparing', { percent }));
                },
            });
            if (seq !== openSeq) return;
            setStatus('');
        } catch (err) {
            if (seq !== openSeq) return;
            console.error('detail scene load failed', err);
            setStatus(t('detail.error'));
        }
    }

    function hide() {
        root.setAttribute('data-state', 'hidden');
        root.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('bdm-open');
        openSeq++;
        try { lastFocus?.focus?.(); } catch { /* element gone */ }
        lastFocus = null;
    }

    const COLOR_LABEL_KEYS = {
        elevation: 'detail.color_elevation',
        classification: 'detail.color_classification',
        intensity: 'detail.color_intensity',
    };

    function relabel() {
        root.querySelector('.bdm-close').setAttribute('aria-label', t('detail.close'));
        els.colorBtns.forEach((btn) => {
            const key = COLOR_LABEL_KEYS[btn.dataset.mode];
            if (!key) return;
            const label = t(key);
            btn.querySelector('.bdm-color-label').textContent = label;
            btn.setAttribute('title', label);
        });
        const lidarooLabel = t('detail.open_lidaroo');
        els.lidarooLink.querySelector('.bdm-lidaroo-label').textContent = lidarooLabel;
        els.lidarooLink.setAttribute('title', lidarooLabel);
        els.lidarooLink.setAttribute('aria-label', lidarooLabel);
        if (currentTarget && root.getAttribute('data-state') === 'visible') {
            els.title.textContent = currentTarget.label || formatLatLng(currentTarget.lat, currentTarget.lng);
        }
    }
    onLocaleChange(relabel);
    relabel();

    function destroy() {
        themeObserver?.disconnect();
        themeObserver = null;
        if (scene) {
            scene.dispose();
            scene = null;
        }
        root?.remove();
        root = null;
    }

    return { show, hide, destroy };
}

function buildShell() {
    const root = document.createElement('div');
    root.className = 'bdm';
    // Floating chrome — excluded from the "Save image" map capture.
    root.setAttribute('data-screenshot-ignore', 'true');
    root.setAttribute('data-state', 'hidden');
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'bdm-title');
    root.innerHTML = `
        <div class="bdm-backdrop"></div>
        <div class="bdm-panel" role="document">
            <header class="bdm-header">
                <div class="bdm-titles">
                    <h2 class="bdm-title" id="bdm-title"></h2>
                    <div class="bdm-subtitle" hidden></div>
                </div>
                <div class="bdm-colors" role="group">
                    <button type="button" class="bdm-color-btn bdm-color-elevation" data-mode="elevation" aria-pressed="true">
                        <span class="bdm-color-dot" aria-hidden="true"></span><span class="bdm-color-label"></span>
                    </button>
                    <button type="button" class="bdm-color-btn bdm-color-classification" data-mode="classification" aria-pressed="false">
                        <span class="bdm-color-dot" aria-hidden="true"></span><span class="bdm-color-label"></span>
                    </button>
                    <button type="button" class="bdm-color-btn bdm-color-intensity" data-mode="intensity" aria-pressed="false">
                        <span class="bdm-color-dot" aria-hidden="true"></span><span class="bdm-color-label"></span>
                    </button>
                </div>
                <a class="bdm-lidaroo" href="https://lidaroo.aireon.ch/" target="_blank" rel="noopener">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M15 3h6v6"></path>
                        <path d="M10 14 21 3"></path>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    </svg>
                    <span class="bdm-lidaroo-label"></span>
                </a>
                <button class="bdm-close" type="button" aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </header>
            <div class="bdm-canvas" aria-label="Detailed 3D view"></div>
            <div class="bdm-status" hidden></div>
        </div>
    `;
    return root;
}

function formatLatLng(lat, lng) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// Deep link into lidaroo, the suite's full-tile Giro3D point-cloud viewer,
// centered on the same building (WGS84, ~6 decimals per the suite deep-link
// contract).
function lidarooUrl(lat, lng) {
    return `https://lidaroo.aireon.ch/?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`;
}
