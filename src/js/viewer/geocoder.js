import { locationState } from '../locationState.js';
import { sendSignalCollect } from '../api/signalCollect.js';
import { reverseGeocode } from './reverseGeocoder.js';
import { sampleSurfaceHeight } from './buildings.js';
import { t } from '../i18n.js';

// Address-lookup pipeline.
//
// hood used to drive search through Cesium's on-map geocoder widget and the
// services attached to its view-model. The SwissNovo suite has since
// standardised on the Mapbox geocoding API so address search behaves
// identically across every app, so we now call Mapbox directly and route the
// first hit through the existing terrain-sample / fly-to / signalCollect
// pipeline. Both the navbar form and the GPS reverse-geocode path use the
// same `searchAddress(viewer, text)` entry point.
//
// The token is a public (pk.*) Mapbox token — safe to ship client-side, but
// kept out of the repo to satisfy GitHub push protection. Set
// VITE_MAPBOX_TOKEN in .env / Vercel project settings.

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

// Resolve a free-text Swiss address and fly the camera there. Two-stage:
// fetch ranked matches from Mapbox, then run the top hit through the
// terrain-sample / fly-to / signalCollect pipeline. Used by the navbar
// form's submit fallback (Enter with no highlighted suggestion) and by
// the GPS reverse-geocode chain.
export async function searchAddress(viewer, text) {
    const query = (text || '').trim();
    if (!query) return;

    const addressHeader = document.getElementById('addressHeader');

    try {
        const results = await mapboxForwardGeocode(query);

        if (!results || results.length === 0) {
            handleNoResults(query, addressHeader);
            return;
        }

        await selectGeocodeResult(viewer, results[0]);
    } catch (error) {
        console.error('Address search failed:', error?.message, error?.stack);
        handleInvalidResult(query, addressHeader);
    }
}

// Forward-geocode against the Mapbox API, restricted to Switzerland.
// Returns up to 5 ranked matches with WGS84 coordinates. Exported so the
// navbar autocomplete can call it directly with an AbortController to
// cancel in-flight requests on each keystroke. Throws on HTTP / network
// failure so callers can decide whether to surface or swallow it.
export async function mapboxForwardGeocode(query, signal) {
    const trimmed = (query || '').trim();
    if (trimmed.length < 3) return [];

    const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
    url.searchParams.set('q', trimmed);
    url.searchParams.set('country', 'ch');
    url.searchParams.set('limit', '5');
    url.searchParams.set('types', 'address,street,place');
    url.searchParams.set('access_token', MAPBOX_TOKEN);

    const res = await fetch(url.toString(), signal ? { signal } : undefined);
    if (!res.ok) throw new Error(`${t('error.geocode_failed')}: ${res.status}`);
    const data = await res.json();

    return (data.features || [])
        .map((f) => {
            const coords = f?.geometry?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) return null;
            const [longitude, latitude] = coords;
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
            return {
                id: String(f.id ?? `${latitude},${longitude}`),
                longitude,
                latitude,
                displayName:
                    f.properties?.full_address ||
                    f.properties?.name ||
                    `${latitude}, ${longitude}`,
            };
        })
        .filter((r) => r !== null);
}

// Run the terrain-sample / fly-to / signalCollect pipeline for a single
// pre-resolved geocode result. Exported so the navbar autocomplete can
// dispatch it when the user clicks a suggestion (no need to re-query
// Mapbox for an address we already have coordinates for).
export async function selectGeocodeResult(viewer, result) {
    const addressHeader = document.getElementById('addressHeader');
    await handleValidResult(viewer, result, addressHeader);
}

// Hide the floating address-result chip. Called when the user moves on
// from the searched location (picks a building, closes the info panel,
// deselects via empty-terrain click) so a stale address from a prior
// search doesn't linger forever — it was only being hidden on the
// search-error paths before.
export function hideAddressHeader() {
    const addressHeader = document.getElementById('addressHeader');
    if (addressHeader) addressHeader.style.display = 'none';
}

function handleNoResults(searchText, addressHeader) {
    console.log('No search results found');
    locationState.setLocation({
        displayName: searchText,
        searchText: searchText,
        status: 'not_found'
    });
    if (addressHeader) addressHeader.style.display = 'none';
}

function handleInvalidResult(searchText, addressHeader) {
    console.log('Invalid search result');
    locationState.setLocation({
        displayName: searchText,
        searchText: searchText,
        status: 'invalid_result'
    });
    if (addressHeader) addressHeader.style.display = 'none';
}

async function handleValidResult(viewer, result, addressHeader) {
    const { longitude, latitude, displayName } = result;
    console.log('Found result:', displayName);

    if (addressHeader) {
        addressHeader.textContent = displayName;
        addressHeader.style.display = 'block';
    }

    try {
        console.log('Processing coordinates:', { longitude, latitude });

        const terrainHeight = await getTerrainHeight(viewer, longitude, latitude);
        console.log('Got terrain height:', terrainHeight);

        const locationData = {
            cartesian: Cesium.Cartesian3.fromDegrees(longitude, latitude, terrainHeight),
            longitude,
            latitude,
            height: terrainHeight,
            displayName,
            status: 'found'
        };

        console.log('Updating location state with:', locationData);
        locationState.setLocation(locationData);

        sendSignalCollect(locationData);

        flyToLocation(viewer, longitude, latitude, terrainHeight);
    } catch (error) {
        console.error('Error processing search result:', error.message, error.stack);
    }
}

async function getTerrainHeight(viewer, longitude, latitude) {
    // Routed through sampleSurfaceHeight so the Google preset depth-picks
    // the photogrammetric mesh instead of sampling the (now-ellipsoid)
    // terrain provider — keeps the fly-to landing on the visible ground.
    const terrainHeight = await sampleSurfaceHeight(viewer, longitude, latitude);

    console.log('Terrain Height:', {
        height: terrainHeight.toFixed(2) + 'm',
        position: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    });

    return terrainHeight;
}

function flyToLocation(viewer, longitude, latitude, terrainHeight) {
    viewer.scene.mode = Cesium.SceneMode.SCENE3D;

    const oldCollisionDetection = viewer.scene.screenSpaceCameraController.enableCollisionDetection;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;

    const destination = Cesium.Cartesian3.fromDegrees(
        longitude,
        latitude,
        terrainHeight + 100
    );

    viewer.camera.flyTo({
        destination,
        orientation: {
            heading: Cesium.Math.toRadians(355.50),
            pitch: Cesium.Math.toRadians(-18.76),
            roll: 0
        },
        duration: 1.0,
        complete: () => {
            viewer.camera.setView({
                destination,
                orientation: {
                    heading: Cesium.Math.toRadians(355.50),
                    pitch: Cesium.Math.toRadians(-18.76),
                    roll: 0
                }
            });
            viewer.scene.screenSpaceCameraController.enableCollisionDetection = oldCollisionDetection;
        }
    });
}
