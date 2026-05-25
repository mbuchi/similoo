const SVG_ATTRS =
    'xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"';

export function circleUserIcon(size = 20) {
    return `<svg ${SVG_ATTRS} width="${size}" height="${size}" aria-hidden="true">` +
        '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/>' +
        '<path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>';
}

export function logOutIcon(size = 16) {
    return `<svg ${SVG_ATTRS} width="${size}" height="${size}" aria-hidden="true">` +
        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
        '<polyline points="16 17 21 12 16 7"/>' +
        '<line x1="21" x2="9" y1="12" y2="12"/></svg>';
}

export function chevronDownIcon(size = 14) {
    return `<svg ${SVG_ATTRS} width="${size}" height="${size}" aria-hidden="true">` +
        '<path d="m6 9 6 6 6-6"/></svg>';
}

export function refreshIcon(size = 16) {
    return `<svg ${SVG_ATTRS} width="${size}" height="${size}" aria-hidden="true">` +
        '<path d="M21 12a9 9 0 1 1-3.5-7.1"/><path d="M21 3v6h-6"/></svg>';
}
