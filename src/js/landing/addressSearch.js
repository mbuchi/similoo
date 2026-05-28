// Mapbox forward-geocoding for the landing search — vanilla-JS port of
// doorway's geocode.ts. Restricted to Switzerland; returns up to 5 ranked
// matches with WGS84 coordinates.
//
// The Mapbox token is supplied at build time via VITE_MAPBOX_TOKEN. It is
// a public (pk.*) token, safe to ship client-side, but we keep it out of
// the repo so secret scanners stay happy. Set it in Vercel env vars and
// in a local .env file (see .env.example).

const TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN || '';
const DEBOUNCE_MS = 200;

if (!TOKEN && typeof window !== 'undefined') {
    console.warn(
        'addressSearch: VITE_MAPBOX_TOKEN is not set — geocoding will fail. ' +
        'Set it in your Vercel env or local .env file.',
    );
}

export async function geocodeAddress(query, signal) {
    const trimmed = (query || '').trim();
    if (trimmed.length < 3) return [];

    const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
    url.searchParams.set('q', trimmed);
    url.searchParams.set('country', 'ch');
    url.searchParams.set('limit', '5');
    url.searchParams.set('types', 'address,street,place');
    url.searchParams.set('access_token', TOKEN);

    const res = await fetch(url.toString(), { signal });
    if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
    const data = await res.json();

    return (data.features || [])
        .map((f) => {
            const coords = f?.geometry?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) return null;
            const [lng, lat] = coords;
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return {
                id: String(f.id ?? `${lat},${lng}`),
                label: f.properties?.full_address || f.properties?.name || `${lat}, ${lng}`,
                lat,
                lng,
            };
        })
        .filter(Boolean);
}

// Wires a <input> + <ul> pair into a debounced live geocoder. Calls
// `onPick(result)` when the user clicks/keyboard-selects a result.
//
//   input    — HTMLInputElement (the search box)
//   list     — HTMLUListElement (the results dropdown)
//   onPick   — function({ id, label, lat, lng }) => void
//
// Returns a disposer that detaches listeners.
export function bindLandingSearch({ input, list, onPick }) {
    let abortCtrl = null;
    let timer = null;
    let activeIndex = -1;
    let currentResults = [];

    function clearResults() {
        list.innerHTML = '';
        list.hidden = true;
        activeIndex = -1;
        currentResults = [];
    }

    function renderResults(results) {
        currentResults = results;
        list.innerHTML = '';
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            const li = document.createElement('li');
            li.className = 'landing-result';
            li.setAttribute('role', 'option');
            li.dataset.index = String(i);
            li.textContent = r.label;
            li.addEventListener('mousedown', (e) => {
                e.preventDefault(); // keep focus on input
                pick(i);
            });
            list.appendChild(li);
        }
        list.hidden = results.length === 0;
        activeIndex = -1;
        updateActive();
    }

    function updateActive() {
        const children = Array.from(list.children);
        children.forEach((c, i) => {
            c.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
        });
    }

    function pick(index) {
        const r = currentResults[index];
        if (!r) return;
        input.value = r.label;
        clearResults();
        if (typeof onPick === 'function') onPick(r);
    }

    async function runQuery() {
        const q = input.value;
        if (abortCtrl) abortCtrl.abort();
        abortCtrl = new AbortController();
        try {
            const results = await geocodeAddress(q, abortCtrl.signal);
            if (abortCtrl.signal.aborted) return;
            renderResults(results);
        } catch (err) {
            if (err?.name === 'AbortError') return;
            console.warn('addressSearch: geocode failed', err?.message);
        }
    }

    function onInput() {
        if (timer) clearTimeout(timer);
        if (input.value.trim().length < 3) {
            clearResults();
            return;
        }
        timer = setTimeout(runQuery, DEBOUNCE_MS);
    }

    function onKey(e) {
        if (list.hidden) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(currentResults.length - 1, activeIndex + 1);
            updateActive();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(0, activeIndex - 1);
            updateActive();
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0) {
                e.preventDefault();
                pick(activeIndex);
            } else if (currentResults.length > 0) {
                e.preventDefault();
                pick(0);
            }
        } else if (e.key === 'Escape') {
            clearResults();
        }
    }

    function onBlur() {
        // Defer so mousedown on a result can still register.
        setTimeout(clearResults, 120);
    }

    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKey);
    input.addEventListener('blur', onBlur);

    return function dispose() {
        if (timer) clearTimeout(timer);
        if (abortCtrl) abortCtrl.abort();
        input.removeEventListener('input', onInput);
        input.removeEventListener('keydown', onKey);
        input.removeEventListener('blur', onBlur);
        clearResults();
    };
}
