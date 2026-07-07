// The searched-building "pin" beacon planted in the point cloud (ported from
// lidaroo's beacon.ts).
//
// Kept dependency-light (THREE + proj4 + the CRS registration only, no Giro3D)
// so the placement math — WGS84 → LV95 projection, clamping into the tile
// footprint, and the pole/head/ring geometry — stays isolated from the scene
// wiring.

import * as THREE from 'three';
import proj4 from 'proj4';
import { EPSG_2056_ID, EPSG_2056_PROJ4_DEF } from './crs.js';

// Suite accent red — visible on both the light and dark canvas backgrounds.
export const BEACON_COLOR = 0xff3b30;

// Builds a red pin beacon at the given WGS84 location, planted inside the point
// cloud's bounding box so the user can see where the selected building sits
// within the tile. Returns null when coords are missing/non-finite or the bbox
// is empty. The projected (easting, northing) is clamped into the bbox
// footprint, so a building right at the tile edge still shows a pin.
//
// The pin is three parts sharing one unlit, depth-test-off material (so it is
// never hidden behind foreground points): a vertical pole, a floating head
// sphere above the cloud, and a ground ring at the base.
export function buildLocationBeacon(lat, lng, bbox) {
    if (
        lat === undefined ||
        lng === undefined ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        !bbox ||
        bbox.isEmpty()
    ) {
        return null;
    }

    let easting;
    let northing;
    try {
        // Self-register LV95 so placement works even if the beacon runs before
        // getSwissCrs() has (e.g. in isolation). proj4.defs(name) returns the
        // existing def or undefined.
        if (!proj4.defs(EPSG_2056_ID)) {
            proj4.defs(EPSG_2056_ID, EPSG_2056_PROJ4_DEF);
        }
        const projected = proj4('EPSG:4326', EPSG_2056_ID, [lng, lat]);
        easting = projected[0];
        northing = projected[1];
    } catch {
        return null;
    }
    if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
        return null;
    }

    // Keep the pin within the tile footprint (guards a point that lands
    // just outside the actual data extent).
    const x = THREE.MathUtils.clamp(easting, bbox.min.x, bbox.max.x);
    const y = THREE.MathUtils.clamp(northing, bbox.min.y, bbox.max.y);

    const size = bbox.getSize(new THREE.Vector3());
    const footprint = Math.max(size.x, size.y, 1);
    const baseZ = bbox.min.z;
    const topZ = bbox.max.z + Math.max(size.z * 0.4, footprint * 0.12);
    const poleHeight = Math.max(topZ - baseZ, 1);

    const material = new THREE.MeshBasicMaterial({
        color: BEACON_COLOR,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
    });

    const group = new THREE.Group();
    group.name = 'address-beacon';
    group.renderOrder = 999;

    // Vertical pole (a cylinder is Y-aligned by default → rotate to Z-up).
    const poleRadius = Math.max(footprint * 0.0025, 0.6);
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 10),
        material,
    );
    pole.rotation.x = Math.PI / 2;
    pole.position.set(x, y, baseZ + poleHeight / 2);
    pole.renderOrder = 999;
    group.add(pole);

    // Pin head (sphere) floating above the cloud.
    const headRadius = Math.max(footprint * 0.014, 4);
    const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 20, 16), material);
    head.position.set(x, y, topZ);
    head.renderOrder = 999;
    group.add(head);

    // Ground ring (a torus lies in the XY plane by default → flat on Z-up ground).
    const ringRadius = Math.max(footprint * 0.03, 8);
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(ringRadius, ringRadius * 0.12, 12, 40),
        material,
    );
    ring.position.set(x, y, baseZ + 0.5);
    ring.renderOrder = 999;
    group.add(ring);

    return group;
}

// Frees the geometries + material(s) of an Object3D subtree.
export function disposeObject3D(root) {
    root.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        const material = obj.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
    });
}
