// Navbar address search — with Mapbox autocomplete suggestions.
//
// The styled navbar <input> drives hood's Mapbox-backed address pipeline
// directly (Cesium's built-in geocoder widget is CSS-hidden — see
// sidebar.css). On each keystroke we debounce + fetch ranked matches
// from Mapbox and render them as a dropdown under the input; clicking
// or Enter-on-highlighted picks a suggestion and dispatches the existing
// terrain-sample / fly-to / signalCollect pipeline via
// `selectGeocodeResult()` without re-querying for an address we already
// have coordinates for.
//
// Form-submit (Enter with nothing highlighted) is still wired to
// `searchAddress(viewer, text)` as a fallback so blind-Enter behaves the
// same as before — useful for screen readers / no-JS interactions.
//
// This matches the autocomplete pattern used across the rest of the
// SwissNovo suite (valoo, scoore, doorway, …); see valoo's Header.tsx
// for the React-flavoured reference implementation.

import {
    mapboxForwardGeocode,
    searchAddress,
    selectGeocodeResult,
} from '../viewer/geocoder.js';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 3;

// Set window.HOOD_SEARCH_DEBUG = false (or remove this default) once the
// autocomplete is confirmed working in the wild. While true, every step
// of the suggestion pipeline logs to the console so the rendered DOM
// state can be audited against the JS state.
const DEBUG = (typeof window !== 'undefined' && window.HOOD_SEARCH_DEBUG !== false);

const log = (...args) => DEBUG && console.log('[hood-search]', ...args);

export function setupNavbarSearch(viewer) {
    const form = document.getElementById('addressSearchForm');
    const input = document.getElementById('addressSearchInput');
    log('setup running', { formFound: !!form, inputFound: !!input });
    if (!form || !input) return;

    const dropdown = createDropdown();
    form.appendChild(dropdown);
    log('dropdown appended', {
        dropdownInDom: form.contains(dropdown),
        parent: dropdown.parentElement?.id,
    });

    const state = {
        results: [],
        selectedIndex: -1,
        debounceTimer: null,
        abortController: null,
    };

    const closeDropdown = () => {
        state.results = [];
        state.selectedIndex = -1;
        renderDropdown(dropdown, state);
    };

    const fetchSuggestions = async (query) => {
        log('fetchSuggestions called', { query, len: query.trim().length });
        if (query.trim().length < MIN_QUERY_LEN) {
            closeDropdown();
            return;
        }

        // Cancel the previous in-flight request so we don't render a
        // stale older response over a newer one (race-condition guard).
        state.abortController?.abort();
        const controller = new AbortController();
        state.abortController = controller;

        try {
            const matches = await mapboxForwardGeocode(query, controller.signal);
            log('mapbox responded', { aborted: controller.signal.aborted, count: matches?.length });
            if (controller.signal.aborted) return;
            state.results = matches;
            state.selectedIndex = -1;
            renderDropdown(dropdown, state);
            log('post-render', {
                hasIsOpen: dropdown.classList.contains('is-open'),
                computedDisplay: getComputedStyle(dropdown).display,
                rect: dropdown.getBoundingClientRect(),
            });
        } catch (err) {
            if (err?.name !== 'AbortError') {
                console.error('[hood-search] autocomplete failed:', err?.message, err);
                closeDropdown();
            }
        }
    };

    const onTextChange = () => {
        const value = input.value;
        log('input event', { value });
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(() => fetchSuggestions(value), DEBOUNCE_MS);
    };
    input.addEventListener('input', onTextChange);

    input.addEventListener('keydown', (e) => {
        if (state.results.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            state.selectedIndex =
                state.selectedIndex < state.results.length - 1
                    ? state.selectedIndex + 1
                    : 0;
            renderDropdown(dropdown, state);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            state.selectedIndex =
                state.selectedIndex > 0
                    ? state.selectedIndex - 1
                    : state.results.length - 1;
            renderDropdown(dropdown, state);
        } else if (e.key === 'Escape') {
            closeDropdown();
        }
    });

    dropdown.addEventListener('mousedown', (e) => {
        // mousedown (not click) so we pick the result before the input's
        // blur handler can race and close the dropdown.
        const item = e.target.closest('[data-suggestion-index]');
        if (!item) return;
        e.preventDefault();
        const index = Number(item.dataset.suggestionIndex);
        const picked = state.results[index];
        if (!picked) return;
        input.value = picked.displayName;
        closeDropdown();
        input.blur();
        selectGeocodeResult(viewer, picked).catch((err) =>
            console.error('Address selection failed:', err?.message)
        );
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearTimeout(state.debounceTimer);

        // If the user is keyboard-navigating and hit Enter on a highlight,
        // dispatch that suggestion directly — no re-query.
        if (state.selectedIndex >= 0 && state.results[state.selectedIndex]) {
            const picked = state.results[state.selectedIndex];
            input.value = picked.displayName;
            closeDropdown();
            input.blur();
            await selectGeocodeResult(viewer, picked);
            return;
        }

        // If we already have suggestions loaded, take the top hit — same
        // behaviour as if the user clicked the first one. Avoids the
        // mid-debounce empty-state.
        if (state.results.length > 0) {
            const picked = state.results[0];
            input.value = picked.displayName;
            closeDropdown();
            input.blur();
            await selectGeocodeResult(viewer, picked);
            return;
        }

        // Cold submit (no suggestions yet) — fall back to the original
        // single-shot search-and-fly path.
        const value = input.value.trim();
        if (!value) return;
        input.blur();
        await searchAddress(viewer, value);
    });

    document.addEventListener('mousedown', (e) => {
        if (!form.contains(e.target)) closeDropdown();
    });
}

function createDropdown() {
    const el = document.createElement('ul');
    el.id = 'addressSuggestions';
    el.className = 'navbar-search-suggestions';
    el.setAttribute('role', 'listbox');
    return el;
}

// Open/close via an `.is-open` class with explicit `display: block`. The
// `hidden` attribute path used to silently lose to specific selectors in
// hood's CSS (e.g. the `.sidebar-scrim[hidden]` workaround) — using a
// class-keyed `display` rule means show/hide is always under our control.
function renderDropdown(dropdown, state) {
    if (state.results.length === 0) {
        dropdown.innerHTML = '';
        dropdown.classList.remove('is-open');
        return;
    }

    dropdown.innerHTML = state.results
        .map((result, index) => {
            const active = index === state.selectedIndex ? ' is-active' : '';
            return `
                <li class="navbar-search-suggestion${active}"
                    role="option"
                    data-suggestion-index="${index}"
                    aria-selected="${index === state.selectedIndex}">
                    <svg class="navbar-search-suggestion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span class="navbar-search-suggestion-label">${escapeHtml(result.displayName)}</span>
                </li>
            `;
        })
        .join('');
    dropdown.classList.add('is-open');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
