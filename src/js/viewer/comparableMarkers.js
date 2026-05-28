import maplibregl from 'maplibre-gl';

// DOM markers for comparable buildings on the LOD 2.5 map.
//
// Comparables can land anywhere in Switzerland (the mock spreads them
// in a small ring, but the real backend will return matches across the
// country) so we can't rely on the buildings vector tile to highlight
// every one — most won't be in the viewport at the user's working zoom
// level. We place a small "mini-cube" DOM marker at each comparable's
// lat/lng instead; the marker is always visible regardless of zoom.
//
// Wiring: hovering the card in the sidebar pings highlightId(); hovering
// the marker on the map pings the sidebar back via onHover. Click opens
// the building-detail modal via onSelect.

export function createComparableMarkers({ map, onSelect, onHover, onUnhover }) {
    const markers = new Map(); // id → { marker, el }
    let activeId = null;

    function setComparables(list) {
        clear();
        list.forEach((c, i) => {
            if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
            const id = comparableId(c, i);
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'cmp-marker';
            el.setAttribute('aria-label', c.address || c.egrid || `Comparable ${i + 1}`);
            el.innerHTML = `
                <span class="cmp-marker-cube"></span>
                <span class="cmp-marker-shadow"></span>
            `;
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect?.(c, id);
            });
            el.addEventListener('mouseenter', () => {
                setActive(id);
                onHover?.(c, id);
            });
            el.addEventListener('mouseleave', () => {
                setActive(null);
                onUnhover?.(c, id);
            });
            const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([c.lng, c.lat])
                .addTo(map);
            markers.set(id, { marker, el, comparable: c });
        });
    }

    function highlightId(id) {
        setActive(id);
    }

    function setActive(id) {
        if (activeId === id) return;
        if (activeId && markers.has(activeId)) {
            markers.get(activeId).el.classList.remove('is-active');
        }
        activeId = id;
        if (activeId && markers.has(activeId)) {
            markers.get(activeId).el.classList.add('is-active');
        }
    }

    function flyTo(id) {
        const entry = markers.get(id);
        if (!entry) return;
        const c = entry.comparable;
        if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
        map.flyTo({
            center: [c.lng, c.lat],
            zoom: Math.max(map.getZoom(), 16.5),
            speed: 1.4,
            essential: true,
        });
    }

    function clear() {
        for (const { marker } of markers.values()) {
            try { marker.remove(); } catch {}
        }
        markers.clear();
        activeId = null;
    }

    function destroy() {
        clear();
    }

    return { setComparables, highlightId, flyTo, clear, destroy };
}

export function comparableId(c, i) {
    return c.egrid || `cmp-${i}`;
}
