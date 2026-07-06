import { t, onLocaleChange } from '../i18n.js';

// On-map legend explaining the highlight colours.
//
// similoo paints three things on the comparison surface:
//   * red    — the searched parcel and every building inside it
//   * green  — parcels sharing the searched parcel's zone (`cz_local`)
//   * pink   — comparable buildings (their extruded footprints)
//
// Until now those colours were unlabelled, so a first-time visitor had to
// infer the meaning. This is the suite-standard bottom-left legend panel
// (mirrors roofs / soolar) but built in plain DOM + the shared `--hood-*`
// tokens, since similoo is React-free. Labels go through the vanilla i18n
// `t()` and re-localise on language change via `onLocaleChange`.

const ROWS = [
    { cls: 'target', key: 'legend.target' },
    { cls: 'same-zone', key: 'legend.same_zone' },
    { cls: 'comparable', key: 'legend.comparable' },
];

export function createMapLegend(container) {
    if (!container) return { destroy() {} };

    const el = document.createElement('div');
    el.className = 'map-legend';
    el.setAttribute('role', 'region');
    // Floating chrome — excluded from the "Save image" map capture.
    el.setAttribute('data-screenshot-ignore', 'true');

    el.innerHTML = `
        <div class="map-legend-title"></div>
        <ul class="map-legend-rows">
            ${ROWS.map((r) => `
                <li class="map-legend-row">
                    <span class="map-legend-swatch map-legend-swatch--${r.cls}" aria-hidden="true"></span>
                    <span class="map-legend-label" data-key="${r.key}"></span>
                </li>
            `).join('')}
        </ul>
    `;
    container.appendChild(el);

    function relabel() {
        el.setAttribute('aria-label', t('legend.title'));
        el.querySelector('.map-legend-title').textContent = t('legend.title');
        el.querySelectorAll('.map-legend-label').forEach((node) => {
            node.textContent = t(node.dataset.key);
        });
    }

    const unsubscribe = onLocaleChange(relabel);
    relabel();

    return {
        destroy() {
            unsubscribe?.();
            el.remove();
        },
    };
}
