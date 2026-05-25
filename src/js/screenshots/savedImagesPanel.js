import { listImages, deleteImage, APP_LABELS } from './imageService.js';
import { onAuthChange } from '../auth/authManager.js';
import { t, onLocaleChange } from '../i18n.js';

const SHOWROOM_URL = 'https://swissnovo-showroom.vercel.app/';
const MAX_VISIBLE_IMAGES = 3;
const KNOWN_META_KEYS = new Set([
    'url', 'viewport', 'captured_at', 'central_lat', 'central_lng',
    'central_parcel_id', 'tilt_degree', 'bearing_degree', 'zoom',
    'address', 'basemap', 'is_3d_mode',
]);

let modalEl = null;
let previewEl = null;
let images = [];
let isLoading = false;
let currentError = null;

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
}

function formatDate(iso) {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatCoord(n) { return typeof n === 'number' ? n.toFixed(5) : null; }
function formatDeg(n) { return typeof n === 'number' ? `${Math.round(n)}°` : null; }

function buildCardMeta(meta) {
    if (!meta) return '';
    const lines = [];
    if (meta.address) lines.push(`<div class="saved-images-card-meta"><span>📍</span><span>${escapeHtml(meta.address)}</span></div>`);
    const lat = formatCoord(meta.central_lat);
    const lng = formatCoord(meta.central_lng);
    if (lat && lng) lines.push(`<div class="saved-images-card-meta"><span>🗺</span><span>${lat}, ${lng}</span></div>`);
    if (meta.central_parcel_id) lines.push(`<div class="saved-images-card-meta"><span>#</span><span>${escapeHtml(String(meta.central_parcel_id))}</span></div>`);
    const tilt = formatDeg(meta.tilt_degree);
    if (tilt) lines.push(`<div class="saved-images-card-meta"><span>🧭</span><span>${escapeHtml(t('gallery.tilt_value', { value: tilt }))}</span></div>`);
    return lines.join('');
}

function buildPreviewMeta(img) {
    const meta = img.custom_metadata || {};
    const rows = [
        { label: t('gallery.col_app'), value: APP_LABELS[img.app_source] || img.app_source },
        { label: t('gallery.col_saved'), value: formatDate(img.created_at) },
        { label: t('gallery.col_dimensions'), value: `${img.width}×${img.height}` },
        { label: t('gallery.col_size'), value: formatSize(img.file_size) },
    ];
    if (meta.address) rows.push({ label: t('gallery.col_address'), value: meta.address });
    const lat = formatCoord(meta.central_lat);
    const lng = formatCoord(meta.central_lng);
    if (lat && lng) rows.push({ label: t('gallery.col_center'), value: `${lat}, ${lng}` });
    if (meta.central_parcel_id) rows.push({ label: t('gallery.col_parcel_id'), value: String(meta.central_parcel_id) });
    const tilt = formatDeg(meta.tilt_degree);
    if (tilt) rows.push({ label: t('gallery.col_tilt'), value: tilt });
    const bearing = formatDeg(meta.bearing_degree);
    if (bearing) rows.push({ label: t('gallery.col_bearing'), value: bearing });
    if (typeof meta.zoom === 'number') rows.push({ label: t('gallery.col_zoom'), value: meta.zoom.toFixed(1) });
    if (meta.basemap) rows.push({ label: t('gallery.col_basemap'), value: String(meta.basemap) });
    if (typeof meta.is_3d_mode === 'boolean') {
        rows.push({ label: t('gallery.col_3d_mode'), value: meta.is_3d_mode ? t('common.on') : t('common.off') });
    }

    const extras = Object.entries(meta).filter(
        ([k, v]) => !KNOWN_META_KEYS.has(k) && v !== null && v !== undefined && v !== ''
    );

    let html = '<div class="saved-images-preview-meta">';
    for (const r of rows) {
        html += `<div class="saved-images-preview-row"><span class="saved-images-preview-label">${escapeHtml(r.label)}</span><span class="saved-images-preview-value">${escapeHtml(r.value)}</span></div>`;
    }
    if (extras.length > 0) {
        html += `<div class="saved-images-preview-extras-title">${escapeHtml(t('gallery.additional_metadata'))}</div>`;
        for (const [k, v] of extras) {
            const display = typeof v === 'object' ? JSON.stringify(v) : String(v);
            html += `<div class="saved-images-preview-row"><span class="saved-images-preview-label">${escapeHtml(k)}</span><span class="saved-images-preview-value">${escapeHtml(display)}</span></div>`;
        }
    }
    html += '</div>';
    return html;
}

function renderSkeleton() {
    // Mirror the final card grid: a thumbnail block plus stacked text lines.
    let cards = '';
    for (let i = 0; i < MAX_VISIBLE_IMAGES; i += 1) {
        cards += `
            <div class="saved-images-skeleton-card">
                <div class="skeleton saved-images-skeleton-thumb"></div>
                <div class="saved-images-skeleton-body">
                    <div class="skeleton saved-images-skeleton-line is-title"></div>
                    <div class="skeleton saved-images-skeleton-line is-short"></div>
                    <div class="skeleton saved-images-skeleton-line is-meta"></div>
                    <div class="saved-images-skeleton-actions">
                        <div class="skeleton saved-images-skeleton-btn"></div>
                        <div class="skeleton saved-images-skeleton-btn"></div>
                    </div>
                </div>
            </div>
        `;
    }
    return `<div class="saved-images-grid" aria-busy="true">${cards}</div>`;
}

function render() {
    if (!modalEl) return;
    const body = modalEl.querySelector('.saved-images-body');
    const count = modalEl.querySelector('.saved-images-count');
    if (count) count.textContent = isLoading ? '' : String(images.length);

    if (isLoading) {
        body.innerHTML = renderSkeleton();
        return;
    }
    if (currentError) {
        body.innerHTML = `
            <div class="saved-images-empty">
                <p class="saved-images-error">${escapeHtml(currentError)}</p>
                <button type="button" class="saved-images-retry">${escapeHtml(t('common.try_again'))}</button>
            </div>
        `;
        body.querySelector('.saved-images-retry').addEventListener('click', load);
        return;
    }
    if (images.length === 0) {
        body.innerHTML = `
            <div class="saved-images-empty">
                <p>${escapeHtml(t('gallery.empty_title'))}</p>
                <p class="saved-images-empty-hint">${escapeHtml(t('gallery.empty_hint'))}</p>
            </div>
        `;
        return;
    }

    const visible = images.slice(0, MAX_VISIBLE_IMAGES);
    const hiddenCount = Math.max(0, images.length - visible.length);
    let html = '<div class="saved-images-grid">';
    for (const img of visible) {
        html += `
            <div class="saved-images-card" data-id="${escapeHtml(img.id)}">
                <button type="button" class="saved-images-thumb" data-id="${escapeHtml(img.id)}">
                    <img src="${escapeHtml(img.public_url)}" alt="${escapeHtml(img.original_filename)}" loading="lazy" />
                </button>
                <div class="saved-images-card-body">
                    <div class="saved-images-card-head">
                        <span class="saved-images-app-badge">${escapeHtml(APP_LABELS[img.app_source] || img.app_source)}</span>
                        <span class="saved-images-filename" title="${escapeHtml(img.original_filename)}">${escapeHtml(img.original_filename)}</span>
                    </div>
                    <div class="saved-images-card-date">${escapeHtml(formatDate(img.created_at))}</div>
                    <div class="saved-images-card-info">${img.width}×${img.height} · ${escapeHtml(formatSize(img.file_size))}</div>
                    ${buildCardMeta(img.custom_metadata)}
                    <div class="saved-images-card-actions">
                        <a class="saved-images-open" href="${escapeHtml(img.public_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('gallery.open'))}</a>
                        <button type="button" class="saved-images-delete" data-id="${escapeHtml(img.id)}" aria-label="${escapeHtml(t('gallery.delete'))}">${escapeHtml(t('gallery.delete'))}</button>
                    </div>
                </div>
            </div>
        `;
    }
    html += '</div>';
    if (hiddenCount > 0) {
        html += `
            <div class="saved-images-footer-cta">
                <span>${escapeHtml(t('gallery.footer_cta', { visible: visible.length, total: images.length, hidden: hiddenCount }))}</span>
                <a href="${SHOWROOM_URL}" target="_blank" rel="noopener noreferrer" class="saved-images-cta-link">${escapeHtml(t('gallery.see_in_showroom'))}</a>
            </div>
        `;
    }
    body.innerHTML = html;
    body.querySelectorAll('.saved-images-thumb').forEach((el) => {
        el.addEventListener('click', () => {
            const id = el.getAttribute('data-id');
            const found = images.find((i) => i.id === id);
            if (found) openPreview(found);
        });
    });
    body.querySelectorAll('.saved-images-delete').forEach((el) => {
        el.addEventListener('click', async () => {
            const id = el.getAttribute('data-id');
            if (!confirm(t('gallery.delete_confirm'))) return;
            el.disabled = true;
            try {
                await deleteImage(id);
                images = images.filter((i) => i.id !== id);
                render();
            } catch (err) {
                alert(err instanceof Error ? err.message : t('gallery.delete_failed'));
                el.disabled = false;
            }
        });
    });
}

function openPreview(img) {
    closePreview();
    previewEl = document.createElement('div');
    previewEl.className = 'saved-images-preview-backdrop';
    previewEl.innerHTML = `
        <div class="saved-images-preview-card">
            <button type="button" class="saved-images-preview-close" aria-label="${escapeHtml(t('gallery.preview_close'))}">×</button>
            <div class="saved-images-preview-image">
                <img src="${escapeHtml(img.public_url)}" alt="${escapeHtml(img.original_filename)}" />
            </div>
            <div class="saved-images-preview-side">
                <div class="saved-images-preview-name">${escapeHtml(img.original_filename)}</div>
                ${buildPreviewMeta(img)}
            </div>
        </div>
    `;
    document.body.appendChild(previewEl);
    previewEl.addEventListener('click', (e) => {
        if (e.target === previewEl) closePreview();
    });
    previewEl.querySelector('.saved-images-preview-close').addEventListener('click', closePreview);
}

function closePreview() {
    if (previewEl && previewEl.parentNode) {
        previewEl.parentNode.removeChild(previewEl);
    }
    previewEl = null;
}

async function load() {
    isLoading = true;
    currentError = null;
    render();
    try {
        // No app_source filter — list across every app the user has used.
        images = await listImages();
    } catch (err) {
        currentError = err instanceof Error ? err.message : t('gallery.load_failed');
        images = [];
    } finally {
        isLoading = false;
        render();
    }
}

function open() {
    if (!modalEl) buildModal();
    modalEl.style.display = 'flex';
    load();
}
function close() {
    if (modalEl) modalEl.style.display = 'none';
    closePreview();
}

function buildModal() {
    modalEl = document.createElement('div');
    modalEl.className = 'saved-images-backdrop';
    modalEl.innerHTML = `
        <div class="saved-images-modal">
            <div class="saved-images-header">
                <div class="saved-images-title">
                    <span data-i18n-gallery-key="gallery.title">${escapeHtml(t('gallery.title'))}</span>
                    <span class="saved-images-count"></span>
                </div>
                <div class="saved-images-actions">
                    <a class="saved-images-showroom-link" href="${SHOWROOM_URL}" target="_blank" rel="noopener noreferrer" data-i18n-gallery-key="gallery.see_in_showroom">${escapeHtml(t('gallery.see_in_showroom'))}</a>
                    <button type="button" class="saved-images-refresh" aria-label="${escapeHtml(t('gallery.refresh'))}" data-i18n-gallery-aria="gallery.refresh">↻</button>
                    <button type="button" class="saved-images-close" aria-label="${escapeHtml(t('gallery.close'))}" data-i18n-gallery-aria="gallery.close">×</button>
                </div>
            </div>
            <div class="saved-images-body"></div>
        </div>
    `;
    document.body.appendChild(modalEl);
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) close();
    });
    modalEl.querySelector('.saved-images-close').addEventListener('click', close);
    modalEl.querySelector('.saved-images-refresh').addEventListener('click', load);
}

export function setupSavedImagesPanel() {
    const button = document.getElementById('savedImagesButton');
    if (!button) return;

    button.style.display = 'none';
    onAuthChange(({ state }) => {
        button.style.display = state === 'authenticated' ? 'inline-flex' : 'none';
    });

    button.addEventListener('click', open);
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (previewEl) closePreview();
        else if (modalEl && modalEl.style.display !== 'none') close();
    });

    // Re-translate the modal chrome and re-render the open list when the
    // locale flips. Card / preview / row labels are baked into innerHTML.
    onLocaleChange(() => {
        if (modalEl) {
            modalEl.querySelectorAll('[data-i18n-gallery-key]').forEach((el) => {
                const key = el.getAttribute('data-i18n-gallery-key');
                if (key) el.textContent = t(key);
            });
            modalEl.querySelectorAll('[data-i18n-gallery-aria]').forEach((el) => {
                const key = el.getAttribute('data-i18n-gallery-aria');
                if (key) el.setAttribute('aria-label', t(key));
            });
            if (modalEl.style.display !== 'none') render();
        }
    });
}
