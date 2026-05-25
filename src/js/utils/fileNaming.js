import { locationState } from '../locationState.js';

export function getFormattedFilename(extension) {
    let locationName = 'location';
    
    // Get location from state
    const location = locationState.getLocation();
    if (location && location.displayName) {
        locationName = location.displayName.split(',')[0].trim();
    }
    
    // Clean up the location name for use in filename
    locationName = locationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_') // Replace any non-alphanumeric chars with underscore
        .replace(/^_+|_+$/g, '');     // Remove leading/trailing underscores
    
    // Get current timestamp
    const now = new Date();
    const date = now.getFullYear().toString() +
                (now.getMonth() + 1).toString().padStart(2, '0') +
                now.getDate().toString().padStart(2, '0');
    const time = now.getHours().toString().padStart(2, '0') +
                now.getMinutes().toString().padStart(2, '0') +
                now.getSeconds().toString().padStart(2, '0');
    
    return `similoo_${locationName}_${date}_${time}${extension}`;
}