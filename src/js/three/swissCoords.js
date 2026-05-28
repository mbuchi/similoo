// Swiss coordinate conversions used by the Three.js scene.
//
// The 3D scene combines two data sources, both in LV95 (EPSG:2056):
//   * the terrain GLB, which is shifted so its origin (0,0,0) corresponds
//     to the request's (lat,lng) and its lowest elevation;
//   * the per-building GLBs, whose raw vertices are absolute LV95
//     (X=easting, Y=northing, Z=elevation).
//
// To place a building onto the terrain we need (a) the LV95 easting/
// northing of the request center, and (b) a fixed axis swap from LV95
// (Z-up) to Three.js (Y-up, North = -Z).
//
// The approximate Swisstopo formula is good to ~1 m anywhere in
// Switzerland, which is more than enough for our 100 m visualisation.

// WGS84 → LV95 (EPSG:4326 → EPSG:2056).
// Source: Swisstopo "Approximate formulas for the transformation between
// Swiss projection coordinates and WGS84" (NAVREF-05.013).
export function wgs84ToLV95(lng, lat) {
    const phi = (lat * 3600 - 169028.66) / 10000;
    const lam = (lng * 3600 - 26782.5) / 10000;

    const easting =
        2600072.37 +
        211455.93 * lam -
        10938.51 * lam * phi -
        0.36 * lam * phi * phi -
        44.54 * lam * lam * lam;

    const northing =
        1200147.07 +
        308807.95 * phi +
        3745.25 * lam * lam +
        76.63 * phi * phi -
        194.56 * lam * lam * phi +
        119.79 * phi * phi * phi;

    return { easting, northing };
}
