import { DICEBEAR_URL } from './authConfig.js';
import { getCurrentUser } from './authManager.js';
import { getProfile, updateProfile } from './profileApi.js';
import { refreshIcon } from './icons.js';
import { t, onLocaleChange } from '../i18n.js';

let modalEl = null;
let escHandler = null;
let currentProfile = {
    avatar_icon: '',
    gender: '',
    age: '',
    account_info: {},
};

function randomSeed() {
    return Math.random().toString(36).slice(2, 12);
}

function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.className = 'auth-profile-overlay';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.innerHTML = `
        <div class="auth-profile-card" role="document">
            <div class="auth-profile-banner"></div>
            <div class="auth-profile-body">
                <div class="auth-profile-avatar-wrap">
                    <img class="auth-profile-avatar" alt="${t('auth.profile_avatar_alt')}" data-i18n-key-alt="auth.profile_avatar_alt" />
                    <button type="button" class="auth-profile-shuffle" aria-label="${t('auth.profile_pick_avatar')}" data-i18n-key-aria="auth.profile_pick_avatar">
                        ${refreshIcon(16)}
                    </button>
                </div>
                <h2 class="auth-profile-name"></h2>
                <p class="auth-profile-email"></p>
                <form class="auth-profile-form" novalidate>
                    <label class="auth-profile-field">
                        <span data-i18n-key="auth.profile_field_gender">${t('auth.profile_field_gender')}</span>
                        <select name="gender">
                            <option value="" data-i18n-key="auth.profile_gender_unspecified">${t('auth.profile_gender_unspecified')}</option>
                            <option value="female" data-i18n-key="auth.profile_gender_female">${t('auth.profile_gender_female')}</option>
                            <option value="male" data-i18n-key="auth.profile_gender_male">${t('auth.profile_gender_male')}</option>
                            <option value="other" data-i18n-key="auth.profile_gender_other">${t('auth.profile_gender_other')}</option>
                        </select>
                    </label>
                    <label class="auth-profile-field">
                        <span data-i18n-key="auth.profile_field_age">${t('auth.profile_field_age')}</span>
                        <input type="number" name="age" min="0" max="130" inputmode="numeric" />
                    </label>
                    <label class="auth-profile-field">
                        <span data-i18n-key="auth.profile_field_bio">${t('auth.profile_field_bio')}</span>
                        <textarea name="bio" rows="3" placeholder="${t('auth.profile_bio_placeholder')}" data-i18n-key-placeholder="auth.profile_bio_placeholder"></textarea>
                    </label>
                    <div class="auth-profile-actions">
                        <button type="button" class="auth-profile-cancel" data-i18n-key="auth.profile_cancel">${t('auth.profile_cancel')}</button>
                        <button type="submit" class="auth-profile-save" data-i18n-key="auth.profile_save">${t('auth.profile_save')}</button>
                    </div>
                    <p class="auth-profile-message" role="status"></p>
                </form>
            </div>
            <button type="button" class="auth-profile-close" aria-label="${t('common.close')}" data-i18n-key-aria="common.close">&times;</button>
        </div>
    `;
    document.body.appendChild(modalEl);

    // Re-translate every flagged node when the locale changes. textContent
    // for [data-i18n-key], aria-label for [data-i18n-key-aria], etc.
    onLocaleChange(() => retranslateProfileModal());

    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeProfileModal();
    });
    modalEl.querySelector('.auth-profile-close').addEventListener('click', closeProfileModal);
    modalEl.querySelector('.auth-profile-cancel').addEventListener('click', closeProfileModal);
    modalEl.querySelector('.auth-profile-shuffle').addEventListener('click', () => {
        currentProfile.avatar_icon = randomSeed();
        renderAvatar();
    });
    modalEl.querySelector('.auth-profile-form').addEventListener('submit', handleSave);

    return modalEl;
}

function renderAvatar() {
    const img = modalEl.querySelector('.auth-profile-avatar');
    img.src = DICEBEAR_URL(currentProfile.avatar_icon);
}

function retranslateProfileModal() {
    if (!modalEl) return;
    modalEl.querySelectorAll('[data-i18n-key]').forEach((el) => {
        const key = el.getAttribute('data-i18n-key');
        if (key) el.textContent = t(key);
    });
    modalEl.querySelectorAll('[data-i18n-key-aria]').forEach((el) => {
        const key = el.getAttribute('data-i18n-key-aria');
        if (key) el.setAttribute('aria-label', t(key));
    });
    modalEl.querySelectorAll('[data-i18n-key-alt]').forEach((el) => {
        const key = el.getAttribute('data-i18n-key-alt');
        if (key) el.setAttribute('alt', t(key));
    });
    modalEl.querySelectorAll('[data-i18n-key-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-key-placeholder');
        if (key) el.setAttribute('placeholder', t(key));
    });
}

function setMessage(text, isError = false) {
    const el = modalEl.querySelector('.auth-profile-message');
    el.textContent = text || '';
    el.classList.toggle('is-error', !!(text && isError));
}

async function handleSave(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const gender = form.elements.gender.value || '';
    const ageVal = form.elements.age.value;
    const age = ageVal === '' ? null : Number(ageVal);
    const bio = form.elements.bio.value || '';

    const account_info = { ...(currentProfile.account_info || {}), bio };
    const payload = {
        avatar_icon: currentProfile.avatar_icon || '',
        gender,
        age,
        account_info,
    };

    const saveBtn = form.querySelector('.auth-profile-save');
    saveBtn.disabled = true;
    setMessage(t('auth.profile_saving'));
    try {
        await updateProfile(payload);
        currentProfile = { ...currentProfile, ...payload };
        setMessage(t('auth.profile_saved'));
        window.dispatchEvent(new CustomEvent('auth:profile-updated', { detail: currentProfile }));
        setTimeout(closeProfileModal, 600);
    } catch (err) {
        console.error('Profile save failed:', err);
        setMessage(t('auth.profile_save_failed'), true);
    } finally {
        saveBtn.disabled = false;
    }
}

function populateForm(profile, user) {
    const form = modalEl.querySelector('.auth-profile-form');
    form.elements.gender.value = profile.gender || '';
    form.elements.age.value = profile.age == null ? '' : String(profile.age);
    form.elements.bio.value = (profile.account_info && profile.account_info.bio) || '';

    const claims = (user && user.profile) || {};
    const displayName =
        claims.name || claims.preferred_username || claims.given_name || claims.email || t('auth.signed_in');
    const email = claims.email || '';
    modalEl.querySelector('.auth-profile-name').textContent = displayName;
    modalEl.querySelector('.auth-profile-email').textContent = email;
    renderAvatar();
}

export async function openProfileModal() {
    ensureModal();
    const user = getCurrentUser();
    if (!user) return;

    currentProfile = {
        avatar_icon: '',
        gender: '',
        age: null,
        account_info: {},
    };
    populateForm(currentProfile, user);
    setMessage(t('auth.profile_loading'));
    modalEl.classList.add('is-open');
    document.body.classList.add('auth-modal-open');

    escHandler = (e) => {
        if (e.key === 'Escape') closeProfileModal();
    };
    document.addEventListener('keydown', escHandler);

    try {
        const remote = await getProfile();
        if (remote) {
            currentProfile = {
                avatar_icon: remote.avatar_icon || '',
                gender: remote.gender || '',
                age: remote.age == null ? null : remote.age,
                account_info: remote.account_info || {},
            };
        }
        if (!currentProfile.avatar_icon) currentProfile.avatar_icon = randomSeed();
        populateForm(currentProfile, user);
        setMessage('');
    } catch (err) {
        console.warn('Profile load failed:', err);
        if (!currentProfile.avatar_icon) currentProfile.avatar_icon = randomSeed();
        renderAvatar();
        setMessage(t('auth.profile_load_failed'), true);
    }
}

export function closeProfileModal() {
    if (!modalEl) return;
    modalEl.classList.remove('is-open');
    document.body.classList.remove('auth-modal-open');
    if (escHandler) {
        document.removeEventListener('keydown', escHandler);
        escHandler = null;
    }
}

export function getCachedProfile() {
    return currentProfile;
}
