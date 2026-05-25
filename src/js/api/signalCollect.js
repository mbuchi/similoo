const PROXY_URL = '/api/signal-collect';

let cachedUserLocation = null;

async function getUserLocation() {
    if (cachedUserLocation) return cachedUserLocation;

    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error(`IP lookup failed: ${response.status}`);
        const data = await response.json();
        cachedUserLocation = { lat: data.latitude, lng: data.longitude };
        return cachedUserLocation;
    } catch (error) {
        console.error('Signal collect: failed to get user location from IP', error);
        return null;
    }
}

export async function sendSignalCollect(locationData) {
    if (!locationData?.latitude || !locationData?.longitude || !locationData?.displayName) {
        console.error('Signal collect: invalid location data', locationData);
        return;
    }

    try {
        const userLocation = await getUserLocation();

        const body = {
            app_name: 'similoo',
            user_action: 'Search for Address',
            lat: userLocation?.lat ?? 0,
            lng: userLocation?.lng ?? 0,
            target_address: locationData.displayName,
            target_lat: locationData.latitude,
            target_lng: locationData.longitude,
        };

        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Signal collect HTTP error: ${response.status}`);
        }

        console.log('Signal collect: success for', locationData.displayName);
    } catch (error) {
        console.error('Signal collect: failed', error);
    }
}
