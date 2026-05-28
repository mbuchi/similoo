// Building-detail popup.
//
// Opens an overlay that renders a 100 m LAS slice around a comparable
// building in Three.js. Lazy-mounts the scene on first open, reuses the
// renderer across opens, and exposes a mode toggle so users can flip
// between the raw coloured point cloud (LAS classification colours)
// and a derived solid mesh (Roofer building model on a grey terrain
// extracted from the ground class).
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
        modePointBtn: root.querySelector('.bdm-mode-point'),
        modeSolidBtn: root.querySelector('.bdm-mode-solid'),
        canvas: root.querySelector('.bdm-canvas'),
        status: root.querySelector('.bdm-status'),
    };

    let scene = null;
    let openSeq = 0;
    let currentTarget = null;

    els.closeBtn.addEventListener('click', hide);
    els.backdrop.addEventListener('click', hide);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && root.getAttribute('data-state') === 'visible') hide();
    });

    els.modePointBtn.addEventListener('click', () => setMode('pointcloud'));
    els.modeSolidBtn.addEventListener('click', () => setMode('solid'));

    function setMode(next) {
        if (!scene) return;
        scene.setMode(next);
        syncModeButtons(next);
    }

    function syncModeButtons(next) {
        const point = next === 'pointcloud';
        els.modePointBtn.setAttribute('aria-pressed', point ? 'true' : 'false');
        els.modeSolidBtn.setAttribute('aria-pressed', point ? 'false' : 'true');
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

        root.setAttribute('data-state', 'visible');
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('bdm-open');

        if (!scene) {
            scene = createBuildingScene({ container: els.canvas });
            syncModeButtons(scene.getMode());
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
    }

    function relabel() {
        root.querySelector('.bdm-close').setAttribute('aria-label', t('detail.close'));
        els.modePointBtn.textContent = t('detail.mode_pointcloud');
        els.modeSolidBtn.textContent = t('detail.mode_solid');
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
    root.setAttribute('data-state', 'hidden');
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
        <div class="bdm-backdrop"></div>
        <div class="bdm-panel" role="document">
            <header class="bdm-header">
                <div class="bdm-titles">
                    <h2 class="bdm-title"></h2>
                    <div class="bdm-subtitle" hidden></div>
                </div>
                <div class="bdm-mode">
                    <button type="button" class="bdm-mode-btn bdm-mode-point" aria-pressed="true"></button>
                    <button type="button" class="bdm-mode-btn bdm-mode-solid" aria-pressed="false"></button>
                </div>
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
