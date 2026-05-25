// Custom basemap selector — replaces Cesium's default BaseLayerPicker (which
// renders as a black thumbnail tile in the top-right) with a swissnovo-styled
// dropdown matching the rest of the suite. Switches between the satellite
// imagery basemap (richer at street level) and the hillshade basemap (neutral
// ground that lets the dynamic sun shadows read cleanly).
import { setHillshadeBasemap, setImageryBasemap } from '../viewer/basemap.js';
import { t, onLocaleChange } from '../i18n.js';

const OPTIONS = [
    { id: 'imagery', labelKey: 'basemap.satellite', icon: 'satellite' },
    { id: 'hillshade', labelKey: 'basemap.hillshade', icon: 'mountain' }
];

export function setupBasemapSelector(viewer) {
    const cesiumContainer = document.getElementById('cesiumContainer');
    if (!cesiumContainer) return;

    let current = 'imagery';
    let isOpen = false;

    const root = document.createElement('div');
    root.className = 'basemap-selector';
    root.innerHTML = `
        <button class="basemap-selector-button" type="button" aria-haspopup="listbox" aria-expanded="false" title="${t('basemap.choose')}">
            <i data-lucide="layers"></i>
            <span class="basemap-selector-label">${t('basemap.satellite')}</span>
            <i data-lucide="chevron-down" class="basemap-selector-chevron"></i>
        </button>
        <div class="basemap-selector-menu" role="listbox" hidden>
            ${OPTIONS.map((opt) => `
                <button class="basemap-selector-option" type="button" role="option" data-id="${opt.id}" aria-selected="${opt.id === current}">
                    <i data-lucide="${opt.icon}"></i>
                    <span data-basemap-label-key="${opt.labelKey}">${t(opt.labelKey)}</span>
                    <i data-lucide="check" class="basemap-selector-check"></i>
                </button>
            `).join('')}
        </div>
    `;

    cesiumContainer.appendChild(root);

    const button = root.querySelector('.basemap-selector-button');
    const labelEl = root.querySelector('.basemap-selector-label');
    const menu = root.querySelector('.basemap-selector-menu');

    function setOpen(next) {
        isOpen = next;
        menu.hidden = !next;
        button.setAttribute('aria-expanded', next ? 'true' : 'false');
        root.classList.toggle('is-open', next);
    }

    function setCurrent(id) {
        if (current === id) return;
        current = id;
        const opt = OPTIONS.find((o) => o.id === id);
        if (opt) labelEl.textContent = t(opt.labelKey);
        root.querySelectorAll('.basemap-selector-option').forEach((el) => {
            el.setAttribute('aria-selected', el.getAttribute('data-id') === id ? 'true' : 'false');
        });
        if (id === 'hillshade') setHillshadeBasemap(viewer);
        else setImageryBasemap(viewer);
    }

    // Re-translate the visible label + every option's label when the locale
    // flips. The static [data-i18n] sweep can't reach into innerHTML that this
    // module wrote after the initial DOMContentLoaded sweep.
    onLocaleChange(() => {
        const currentOpt = OPTIONS.find((o) => o.id === current);
        if (currentOpt) labelEl.textContent = t(currentOpt.labelKey);
        button.setAttribute('title', t('basemap.choose'));
        root.querySelectorAll('[data-basemap-label-key]').forEach((el) => {
            const key = el.getAttribute('data-basemap-label-key');
            if (key) el.textContent = t(key);
        });
    });

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(!isOpen);
    });

    root.querySelectorAll('.basemap-selector-option').forEach((el) => {
        el.addEventListener('click', () => {
            setCurrent(el.getAttribute('data-id'));
            setOpen(false);
        });
    });

    document.addEventListener('click', (e) => {
        if (!root.contains(e.target)) setOpen(false);
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) setOpen(false);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}
