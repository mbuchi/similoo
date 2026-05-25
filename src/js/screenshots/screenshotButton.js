import { captureCesiumScreenshot, extensionForBlob, getCesiumMetadata } from './captureCesium.js';
import { uploadImage } from './imageService.js';
import { onAuthChange } from '../auth/authManager.js';
import { t } from '../i18n.js';

let toastEl = null;
let toastTimer = null;

function showToast(kind, message, url) {
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'screenshot-toast';
        document.body.appendChild(toastEl);
    }
    toastEl.className = `screenshot-toast screenshot-toast-${kind}`;
    toastEl.innerHTML = `
        <span class="screenshot-toast-msg">
            ${escapeHtml(message)}
            ${url ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" class="screenshot-toast-link">${escapeHtml(t('screenshot.view_image'))}</a>` : ''}
        </span>
        <button type="button" class="screenshot-toast-close" aria-label="${escapeHtml(t('common.dismiss'))}">×</button>
    `;
    toastEl.style.display = 'flex';
    toastEl.querySelector('.screenshot-toast-close').addEventListener('click', dismissToast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(dismissToast, 5000);
}

function dismissToast() {
    if (toastEl) toastEl.style.display = 'none';
    clearTimeout(toastTimer);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
}
function escapeAttr(s) {
    return escapeHtml(s);
}

let overlayEl = null;
function showOverlay() {
    if (!overlayEl) {
        overlayEl = document.createElement('div');
        overlayEl.className = 'screenshot-overlay';
        overlayEl.setAttribute('data-screenshot-ignore', 'true');
        overlayEl.innerHTML = `
            <div class="screenshot-overlay-card">
                <div class="screenshot-overlay-spinner"></div>
                <span class="screenshot-overlay-text">${escapeHtml(t('screenshot.creating'))}</span>
            </div>
        `;
        document.body.appendChild(overlayEl);
    }
    overlayEl.style.display = 'flex';
}
function hideOverlay() {
    if (overlayEl) overlayEl.style.display = 'none';
}

export function setupScreenshotButton(viewer) {
    const button = document.getElementById('saveScreenshotButton');
    if (!button) return;

    // Mirror roofs: only show the button to authenticated users.
    button.style.display = 'none';
    onAuthChange(({ state }) => {
        button.style.display = state === 'authenticated' ? 'inline-flex' : 'none';
    });

    button.addEventListener('click', async () => {
        if (button.disabled) return;
        button.disabled = true;
        button.classList.add('is-loading');
        showOverlay();
        try {
            // Yield so the overlay paints before the heavy capture starts.
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));
            const blob = await captureCesiumScreenshot(viewer);
            const meta = getCesiumMetadata(viewer);
            const saved = await uploadImage(blob, {
                filename: `hood-${Date.now()}.${extensionForBlob(blob)}`,
                customMetadata: {
                    url: window.location.href,
                    viewport: { width: window.innerWidth, height: window.innerHeight },
                    captured_at: new Date().toISOString(),
                    ...meta,
                },
            });
            showToast('success', t('screenshot.saved'), saved.public_url);
        } catch (err) {
            const message = err instanceof Error ? err.message : t('screenshot.failed');
            if (!/permission denied|NotAllowedError|aborted/i.test(message)) {
                showToast('error', message);
            }
        } finally {
            button.disabled = false;
            button.classList.remove('is-loading');
            hideOverlay();
        }
    });
}
