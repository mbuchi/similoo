// Swiss LV95 (EPSG:2056) coordinate system registration (ported from
// lidaroo's crs.ts).
//
// swissSURFACE3D COPC tiles are published in LV95, so both proj4 (used by
// Giro3D/OpenLayers under the hood) and Giro3D's own CoordinateSystem
// registry need to know this projection before an Instance can be created
// with `crs: getSwissCrs()`.

import proj4 from 'proj4';
import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem.js';

export const EPSG_2056_ID = 'EPSG:2056';

// Official swisstopo LV95 definition (see https://epsg.io/2056). Exported so
// the beacon module can self-register the projection without constructing a
// Giro3D Instance — a corrupted def would silently misplace every tile.
export const EPSG_2056_PROJ4_DEF =
    '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs';

let swissCrs = null;

// Registers EPSG:2056 with proj4 and the Giro3D CoordinateSystem registry,
// then returns the resulting CoordinateSystem instance.
//
// Idempotent: safe to call from multiple mount cycles (HMR, repeated modal
// opens). The second call reuses the already-registered CoordinateSystem
// instead of re-registering it, since CoordinateSystem.register() would
// otherwise create a second registry entry every time.
export function getSwissCrs() {
    if (swissCrs) {
        return swissCrs;
    }

    // proj4 keeps its own global def registry; re-defining is harmless.
    proj4.defs(EPSG_2056_ID, EPSG_2056_PROJ4_DEF);

    swissCrs = CoordinateSystem.register(EPSG_2056_ID, EPSG_2056_PROJ4_DEF);

    return swissCrs;
}
