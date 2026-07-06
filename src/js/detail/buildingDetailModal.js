// Building-detail popup.
//
// Opens an overlay that renders a LAS slice around a comparable building
// in Three.js. Lazy-mounts the scene on first open, reuses the renderer
// across opens, and exposes three independent layer toggles — Point
// cloud, Buildings, and an aerial Basemap drape — over an always-visible
// solid terrain base. (Replaces the old two-tab point-cloud/solid switch.)
//
// Public API:
//   const modal = createBuildingDetailModal();
//   modal.show({ lat, lng, label, subtitle });
//   modal.hide();

import { t, onLocaleChange } from '../i18n.js';
import { createBuildingScene } from '../three/buildingScene.js';

export function createBuildingDetailModal() {
    let root = buildShell();
    document.body.appendChild(root);

    const els = {
        backdrop: root.querySelector('.bdm-backdrop'),
        title: root.querySelector('.bdm-title'),
        subtitle: root.querySelector('.bdm-subtitle'),
        closeBtn: root.querySelector('.bdm-close'),
        layerBtns: Array.from(root.querySelectorAll('.bdm-layer-btn')),
        lidarooLink: root.querySelector('.bdm-lidaroo'),
        canvas: root.querySelector('.bdm-canvas'),
        status: root.querySelector('.bdm-status'),
    };

    let scene = null;
    let openSeq = 0;
    let currentTarget = null;
    let lastFocus = null;

    els.closeBtn.addEventListener('click', hide);
    els.backdrop.addEventListener('click', hide);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && root.getAttribute('data-state') === 'visible') hide();
    });

    els.layerBtns.forEach((btn) => {
        btn.addEventListener('click', () => toggleLayer(btn));
    });

    // Each chip is an independent on/off toggle, not a radio. Flip its
    // aria-pressed and route to the matching scene control: 'basemap'
    // drives the orthophoto drape, the others drive layer visibility.
    function toggleLayer(btn) {
        if (!scene) return;
        const layer = btn.dataset.layer;
        const next = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', next ? 'true' : 'false');
        if (layer === 'basemap') scene.setBasemap(next);
        else scene.setLayer(layer, next);
    }

    // Reflect the scene's current layer state onto the chips (called once
    // the scene exists, so the buttons match its defaults).
    function syncLayerButtons() {
        if (!scene) return;
        const active = { ...scene.getLayers(), basemap: scene.getBasemap() };
        els.layerBtns.forEach((btn) => {
            const on = !!active[btn.dataset.layer];
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function setStatus(msg) {
        els.status.textContent = msg || '';
        els.status.hidden = !msg;
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
            scene = createBuildingScene({ container: els.canvas });
            syncLayerButtons();
        }

        const seq = ++openSeq;
        setStatus(t('detail.loading'));
        try {
            await scene.loadAt({ lat, lng, label });
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

    const LAYER_LABEL_KEYS = {
        pointcloud: 'detail.layer_pointcloud',
        building: 'detail.layer_buildings',
        basemap: 'detail.layer_basemap',
    };

    function relabel() {
        root.querySelector('.bdm-close').setAttribute('aria-label', t('detail.close'));
        els.layerBtns.forEach((btn) => {
            const key = LAYER_LABEL_KEYS[btn.dataset.layer];
            if (!key) return;
            const label = t(key);
            btn.querySelector('.bdm-layer-label').textContent = label;
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
                <div class="bdm-layers" role="group">
                    <button type="button" class="bdm-layer-btn bdm-layer-point" data-layer="pointcloud" aria-pressed="true">
                        <span class="bdm-layer-dot" aria-hidden="true"></span><span class="bdm-layer-label"></span>
                    </button>
                    <button type="button" class="bdm-layer-btn bdm-layer-building" data-layer="building" aria-pressed="true">
                        <span class="bdm-layer-dot" aria-hidden="true"></span><span class="bdm-layer-label"></span>
                    </button>
                    <button type="button" class="bdm-layer-btn bdm-layer-basemap" data-layer="basemap" aria-pressed="false">
                        <span class="bdm-layer-dot" aria-hidden="true"></span><span class="bdm-layer-label"></span>
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

// Deep link into lidaroo, the suite's Giro3D point-cloud viewer, centered on
// the same building (WGS84, ~6 decimals per the suite deep-link contract).
function lidarooUrl(lat, lng) {
    return `https://lidaroo.aireon.ch/?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`;
}
