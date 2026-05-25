// Reverse geocoding via the Mapbox geocoding API.
//
// The SwissNovo suite standardises on the Mapbox geocoder so address search
// behaves identically across every app. The token is a public (pk.*) Mapbox
// token — safe to ship client-side, but kept out of the repo to satisfy
// GitHub push protection. Set VITE_MAPBOX_TOKEN in .env / Vercel project
// settings.

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export async function reverseGeocode(latitude, longitude) {
    try {
        const url = new URL(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`
        );
        url.searchParams.set('access_token', TOKEN);
        url.searchParams.set('country', 'ch');
        url.searchParams.set('types', 'address,place,locality');
        url.searchParams.set('limit', '1');
        url.searchParams.set('language', 'en');

        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const feature = data?.features?.[0];
        return feature?.place_name || null;
    } catch (error) {
        console.error('Error reverse geocoding:', error);
        return null;
    }
}
