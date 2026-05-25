// Per-building metrics for the info panel.
//
// Pure-ish module: given a picked Cesium3DTileFeature + the world position
// of the click + the Cesium viewer, return one shaped object the panel can
// render. Results are cached in a WeakMap so re-opening the panel for the
// same feature is instant. The 24h solar value is also cached per (feature,
// date) pair so changing the date in Setup re-computes only that bit.

// Translation table from SwissTLM3D's German OBJEKTART codes to readable
// English labels. Anything not in the table falls back to a generic
// "Building" label.
const SWISS_OBJEKTART_LABELS = {
    Wohngebaeude: { label: 'Residential', category: 'residential' },
    'Wohn- und Geschaeftsgebaeude': { label: 'Mixed-use', category: 'mixed' },
    Industriegebaeude: { label: 'Industrial', category: 'commercial' },
    Buerogebaeude: { label: 'Office', category: 'commercial' },
    'Oeffentliches Gebaeude': { label: 'Public', category: 'civic' },
    Sakralbau: { label: 'Religious', category: 'civic' },
};

const OSM_BUILDING_LABELS = {
    residential: { label: 'Residential', category: 'residential' },
    apartments: { label: 'Apartments', category: 'residential' },
    commercial: { label: 'Commercial', category: 'commercial' },
    office: { label: 'Office', category: 'commercial' },
    industrial: { label: 'Industrial', category: 'commercial' },
    retail: { label: 'Retail', category: 'commercial' },
    public: { label: 'Public', category: 'civic' },
    church: { label: 'Religious', category: 'civic' },
    school: { label: 'School', category: 'civic' },
};

// Swiss residential baseline for the 3D-profile bars. Tuned for a typical
// 4-storey apartment block; revisit after a few weeks of real use.
const PROFILE_BASELINE = {
    volume: 10000,   // m³
    height: 12,      // m
    footprint: 900,  // m²
};

function bucketize(ratio) {
    if (ratio < 0.5) return 'small';
    if (ratio < 1.5) return 'medium';
    if (ratio < 3) return 'large';
    return 'xlarge';
}

function bucketHeight(metres) {
    if (metres < 6) return 'low-rise';
    if (metres < 15) return 'mid-rise';
    if (metres < 35) return 'high-rise';
    return 'tower';
}

// WeakMap from feature -> last computed metrics object. Keys are GC'd when
// Cesium evicts the tile, so we don't leak.
const cache = new WeakMap();

function readProps(feature) {
    if (!feature || typeof feature.getPropertyIds !== 'function') return [];
    return feature
        .getPropertyIds()
        .sort()
        .map((key) => {
            let value;
            try {
                value = feature.getProperty(key);
            } catch {
                value = null;
            }
            return { key, value };
        });
}

function detectSource(feature) {
    // SwissTLM3D carries an OBJEKTART property. OSM Buildings carry
    // a `building` property and Cesium adds `cesium#estimatedHeight`.
    // If neither tag is present, fall back to "Building".
    const ids = typeof feature.getPropertyIds === 'function'
        ? feature.getPropertyIds()
        : [];
    if (ids.includes('OBJEKTART')) return 'SwissTLM3D';
    if (ids.includes('building') || ids.includes('cesium#estimatedHeight')) return 'OSM Buildings';
    return 'Building';
}

function detectLabel(feature, source) {
    if (source === 'SwissTLM3D') {
        const raw = safeProp(feature, 'OBJEKTART');
        const match = raw && SWISS_OBJEKTART_LABELS[raw];
        return match ? match.label : 'Building';
    }
    if (source === 'OSM Buildings') {
        const raw = safeProp(feature, 'building');
        const match = raw && OSM_BUILDING_LABELS[raw];
        return match ? match.label : 'Building';
    }
    return 'Building';
}

function safeProp(feature, key) {
    try {
        return feature.getProperty(key);
    } catch {
        return null;
    }
}

function shortId(feature) {
    // Cesium 3D Tile features expose `featureId` on most tilesets; if it's
    // missing we fall back to a stable hash of the props list.
    const id = feature.featureId ?? feature._batchId ?? null;
    if (id !== null) return String(id).slice(0, 8);
    return 'unknown';
}

export function computeBuildingMetrics(feature, viewer, clickWorldPosition) {
    if (!feature) return null;
    const hit = cache.get(feature);
    if (hit) return hit;

    const source = detectSource(feature);
    const label = detectLabel(feature, source);
    const id = shortId(feature);
    const props = readProps(feature);

    // Numeric stats (height / footprint / volume / roof) and solar
    // exposure are filled in by Tasks 6–8. For now, return nulls so the
    // panel can render a "Loading…" or "Unavailable" state gracefully.
    const height = computeHeight(feature, viewer, clickWorldPosition);
    const footprintArea = computeFootprintArea(feature, viewer, clickWorldPosition);
    const volume = height != null && footprintArea != null ? height * footprintArea : null;
    const roofShape = computeRoofShape(feature, viewer, clickWorldPosition, height, source);

    const profile = (volume != null && footprintArea != null && height != null)
        ? {
            volume: {
                value: volume,
                ratio: volume / PROFILE_BASELINE.volume,
                bucket: bucketize(volume / PROFILE_BASELINE.volume),
            },
            height: {
                value: height,
                ratio: height / PROFILE_BASELINE.height,
                bucket: bucketHeight(height),
            },
            footprint: {
                value: footprintArea,
                ratio: footprintArea / PROFILE_BASELINE.footprint,
                bucket: bucketize(footprintArea / PROFILE_BASELINE.footprint),
            },
        }
        : null;

    const metrics = {
        label,
        source,
        id,
        height,
        footprintArea,
        volume,
        roofShape,
        profile,
        solar24h: computeSolar24h(feature, viewer, clickWorldPosition, height),
        props,
    };

    cache.set(feature, metrics);
    return metrics;
}

export function invalidateBuildingMetrics(feature) {
    if (feature) cache.delete(feature);
}

export function recomputeSolarFor(feature, viewer, clickWorldPosition) {
    if (!feature) return null;
    const cached = cache.get(feature);
    if (!cached) return null;
    const height = cached.height;
    cached.solar24h = computeSolar24h(feature, viewer, clickWorldPosition, height);
    return cached;
}

// ---------- geometric helpers ----------------------------------------

// Project a world position straight down to the terrain surface so the
// ray-walk starts from ground level. Returns the unchanged input if
// terrain sampling fails (e.g. ellipsoid terrain on Google preset).
function projectToGround(viewer, worldPos) {
    if (!worldPos) return null;
    const carto = Cesium.Cartographic.fromCartesian(worldPos);
    if (!carto) return worldPos;
    const groundHeight = viewer.scene.globe.getHeight(carto);
    if (!Number.isFinite(groundHeight)) return worldPos;
    const groundCarto = new Cesium.Cartographic(carto.longitude, carto.latitude, groundHeight);
    return Cesium.Cartographic.toCartesian(groundCarto);
}

// 8 unit directions in the local east-north plane at the given world
// position. Used to ray-walk the footprint outward in cardinal +
// ordinal directions.
function directionsAtGround(viewer, worldPos) {
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(worldPos);
    const east = new Cesium.Cartesian3();
    const north = new Cesium.Cartesian3();
    Cesium.Matrix4.getColumn(enu, 0, east);
    Cesium.Matrix4.getColumn(enu, 1, north);
    Cesium.Cartesian3.normalize(east, east);
    Cesium.Cartesian3.normalize(north, north);

    const dirs = [];
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4; // every 45°
        const dir = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(east, Math.cos(angle), dir);
        const tmp = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(north, Math.sin(angle), tmp);
        Cesium.Cartesian3.add(dir, tmp, dir);
        Cesium.Cartesian3.normalize(dir, dir);
        dirs.push(dir);
    }
    return dirs;
}

// Step outward along a unit direction from a ground point. Return the
// first world position where pickFromRay no longer returns the same
// feature (i.e. we walked out of the footprint), or the cap point if
// the building is bigger than maxDist metres in this direction.
function walkUntilExit(viewer, feature, groundPoint, dir, stepM, maxDist) {
    const scratch = new Cesium.Cartesian3();
    for (let d = stepM; d <= maxDist; d += stepM) {
        Cesium.Cartesian3.multiplyByScalar(dir, d, scratch);
        const point = Cesium.Cartesian3.add(groundPoint, scratch, new Cesium.Cartesian3());
        // Cast a ray straight up from this candidate point to see whether
        // the same feature still occupies that ground square. If yes,
        // we're still inside; if no, we walked out.
        const up = new Cesium.Cartesian3();
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(point);
        Cesium.Matrix4.getColumn(enu, 2, up);
        Cesium.Cartesian3.normalize(up, up);
        const ray = new Cesium.Ray(point, up);
        const hit = viewer.scene.pickFromRay(ray);
        const stillInside = hit && hit.object === feature;
        if (!stillInside) {
            return point;
        }
    }
    // Hit the cap — return the cap point so polygonArea still has a
    // vertex in this direction. Use the last computed point.
    Cesium.Cartesian3.multiplyByScalar(dir, maxDist, scratch);
    return Cesium.Cartesian3.add(groundPoint, scratch, new Cesium.Cartesian3());
}

// Polygon area in m² from a list of 8 world-space Cartesian3 vertices,
// projected into the local east-north plane at the polygon centroid.
function polygonArea(vertices) {
    if (!vertices || vertices.length < 3) return null;
    const centroid = new Cesium.Cartesian3();
    vertices.forEach((v) => Cesium.Cartesian3.add(centroid, v, centroid));
    Cesium.Cartesian3.multiplyByScalar(centroid, 1 / vertices.length, centroid);
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(centroid);
    const inverse = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4());

    const xy = vertices.map((v) => {
        const local = Cesium.Matrix4.multiplyByPoint(inverse, v, new Cesium.Cartesian3());
        return [local.x, local.y]; // east, north
    });

    // Shoelace formula.
    let sum = 0;
    for (let i = 0; i < xy.length; i++) {
        const [x1, y1] = xy[i];
        const [x2, y2] = xy[(i + 1) % xy.length];
        sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
}

function computeHeight(feature, viewer, clickWorldPosition) {
    // OSM Buildings expose this directly.
    const osmHeight = safeProp(feature, 'cesium#estimatedHeight');
    if (Number.isFinite(osmHeight) && osmHeight > 1) return osmHeight;

    // SwissTLM3D: drop a ray from 500m above the clicked point and find
    // where it first hits THIS feature — that's the rooftop. Subtract the
    // local ground height. Per-building, not per-tile, so a single-family
    // house no longer inherits the tile's 200m bounding sphere.
    if (!clickWorldPosition || !viewer) return null;
    try {
        const ground = projectToGround(viewer, clickWorldPosition);
        if (!ground) return null;
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(ground);
        const up = new Cesium.Cartesian3();
        Cesium.Matrix4.getColumn(enu, 2, up);
        Cesium.Cartesian3.normalize(up, up);

        const sky = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(up, 500, sky);
        const rayOrigin = Cesium.Cartesian3.add(ground, sky, new Cesium.Cartesian3());
        const rayDir = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(up, -1, rayDir);
        Cesium.Cartesian3.normalize(rayDir, rayDir);

        const hit = viewer.scene.pickFromRay(new Cesium.Ray(rayOrigin, rayDir));
        if (hit && hit.object === feature && hit.position) {
            const roof = Cesium.Cartographic.fromCartesian(hit.position);
            const base = Cesium.Cartographic.fromCartesian(ground);
            if (roof && base) {
                return Math.max(1, roof.height - base.height);
            }
        }

        // Fallback: the click point's own height above ground. If the user
        // clicked the roof this matches the building height; if they clicked
        // a wall mid-height the value is a lower bound, which is fine for
        // the infographic.
        const clickCarto = Cesium.Cartographic.fromCartesian(clickWorldPosition);
        const baseCarto = Cesium.Cartographic.fromCartesian(ground);
        if (clickCarto && baseCarto) {
            return Math.max(1, clickCarto.height - baseCarto.height);
        }
        return null;
    } catch (err) {
        console.warn('height ray-cast failed:', err);
        return null;
    }
}

function computeFootprintArea(feature, viewer, clickWorldPosition) {
    if (!clickWorldPosition || !viewer) return null;
    try {
        const ground = projectToGround(viewer, clickWorldPosition);
        if (!ground) return null;
        const dirs = directionsAtGround(viewer, ground);
        const vertices = dirs.map((dir) =>
            walkUntilExit(viewer, feature, ground, dir, 0.5, 50)
        );
        const area = polygonArea(vertices);
        return Number.isFinite(area) ? area : null;
    } catch (err) {
        console.warn('footprint ray-walk failed:', err);
        return null;
    }
}

function computeRoofShape(feature, viewer, clickWorldPosition, height, source) {
    // OSM Buildings are extruded prisms → always flat top.
    if (source === 'OSM Buildings') return 'flat';
    if (!clickWorldPosition || !Number.isFinite(height)) return 'unknown';

    try {
        // Probe 4 rays down onto the rooftop at small horizontal offsets
        // from the click world position. If the Z variance > 0.5m the roof
        // is pitched; otherwise flat.
        const ground = projectToGround(viewer, clickWorldPosition);
        if (!ground) return 'unknown';
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(ground);
        const up = new Cesium.Cartesian3();
        Cesium.Matrix4.getColumn(enu, 2, up);
        Cesium.Cartesian3.normalize(up, up);
        const east = new Cesium.Cartesian3();
        const north = new Cesium.Cartesian3();
        Cesium.Matrix4.getColumn(enu, 0, east);
        Cesium.Matrix4.getColumn(enu, 1, north);
        Cesium.Cartesian3.normalize(east, east);
        Cesium.Cartesian3.normalize(north, north);

        const probes = [
            [east, 2], [east, -2], [north, 2], [north, -2],
        ];
        const upOffset = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(up, height + 5, upOffset);
        const rooftopProbeStart = Cesium.Cartesian3.add(ground, upOffset, new Cesium.Cartesian3());
        const downRay = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(up, -1, downRay);
        Cesium.Cartesian3.normalize(downRay, downRay);

        const zs = [];
        for (const [dir, dist] of probes) {
            const offset = new Cesium.Cartesian3();
            Cesium.Cartesian3.multiplyByScalar(dir, dist, offset);
            const origin = Cesium.Cartesian3.add(rooftopProbeStart, offset, new Cesium.Cartesian3());
            const ray = new Cesium.Ray(origin, downRay);
            const hit = viewer.scene.pickFromRay(ray);
            if (hit && hit.object === feature && hit.position) {
                const carto = Cesium.Cartographic.fromCartesian(hit.position);
                if (carto) zs.push(carto.height);
            }
        }
        if (zs.length < 3) return 'unknown';
        const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
        const variance =
            zs.reduce((a, b) => a + (b - mean) ** 2, 0) / zs.length;
        return Math.sqrt(variance) > 0.5 ? 'pitched' : 'flat';
    } catch (err) {
        console.warn('roof-shape probe failed:', err);
        return 'unknown';
    }
}

function readSetupDate() {
    // Read the date picker in the Setup sidebar panel. If it's missing or
    // empty (e.g. tests / future refactors), fall back to today.
    const el = document.getElementById('dateInput');
    const v = el && el.value ? el.value : null;
    const d = v ? new Date(v) : new Date();
    if (Number.isNaN(d.getTime())) return new Date();
    return d;
}

function computeSolar24h(feature, viewer, clickWorldPosition, height) {
    if (!clickWorldPosition || !viewer || !Number.isFinite(height)) return null;
    try {
        const ground = projectToGround(viewer, clickWorldPosition);
        if (!ground) return null;
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(ground);
        const up = new Cesium.Cartesian3();
        Cesium.Matrix4.getColumn(enu, 2, up);
        Cesium.Cartesian3.normalize(up, up);

        const upOffset = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(up, height + 1, upOffset);
        const probe = Cesium.Cartesian3.add(ground, upOffset, new Cesium.Cartesian3());

        const date = readSetupDate();
        const hourly = new Array(24).fill(0);
        let sunlit = 0;
        let daylight = 0;

        for (let h = 0; h < 24; h++) {
            const t = new Date(date);
            t.setHours(h, 0, 0, 0);
            const julian = Cesium.JulianDate.fromDate(t);

            // Sun position is returned in Earth-centered INERTIAL frame
            // (ICRF). Our probe + up vector are in Earth-fixed (ECEF).
            // Without converting frames, the dot(sunDir, up) check above
            // is comparing vectors in different coordinate systems and
            // gives nonsense — that's why v0.3.18 reported every building
            // as "24h sunlit, 100% of daylight" regardless of date.
            const sunPos = Cesium.Simon1994PlanetaryPositions
                .computeSunPositionInEarthInertialFrame(julian, new Cesium.Cartesian3());
            const icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(julian);
            if (icrfToFixed) {
                Cesium.Matrix3.multiplyByVector(icrfToFixed, sunPos, sunPos);
            } else {
                // Cesium hasn't loaded the precise IAU rotation data
                // (`Cesium.Transforms.preloadIcrfFixed` skipped) — fall
                // back to the pseudo-fixed transform which is good to ~1°.
                const teme = Cesium.Transforms.computeTemeToPseudoFixedMatrix(julian);
                if (teme) Cesium.Matrix3.multiplyByVector(teme, sunPos, sunPos);
            }

            const toSun = Cesium.Cartesian3.subtract(sunPos, probe, new Cesium.Cartesian3());
            const sunDir = Cesium.Cartesian3.normalize(toSun, new Cesium.Cartesian3());

            const above = Cesium.Cartesian3.dot(sunDir, up) > 0;
            if (!above) {
                hourly[h] = 0;
                continue;
            }
            daylight++;

            const ray = new Cesium.Ray(probe, sunDir);
            const hit = viewer.scene.pickFromRay(ray, [feature]);
            const occluded = hit && hit.object !== undefined;
            hourly[h] = occluded ? 0 : 1;
            if (!occluded) sunlit++;
        }

        return {
            date: date.toISOString().slice(0, 10),
            hourly,
            sunlitHours: sunlit,
            sunlitPercent: daylight === 0 ? 0 : sunlit / daylight,
        };
    } catch (err) {
        console.warn('solar-24h ray-cast failed:', err);
        return null;
    }
}
