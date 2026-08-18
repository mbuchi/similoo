import { describe, expect, it } from 'vitest';
import { resolveHarmonizedZone, resolveZoneLabel } from '@aireon/shared/parcel-zone';
// Source text via Vite's `?raw` (typed by vite/client; similoo has no node
// types), so the contract checks below read the shipped modules verbatim.
import sidebar from './comparison/sidebar.js?raw';
import main from './main.js?raw';

// Zone label = the shared rule (aireon-shared/docs/PARCEL_ZONE_STANDARD.md).
// Since @aireon/shared v1.177.0 (2026-08-19) the zone an Aireon app shows is
// the MUNICIPAL designation, `cz_local` ("Wohnzone, Bauklasse 4"), one line;
// the federal category `cz_harmonized` ("Wohnzonen") is a filter, never the
// label. similoo's vitest runs in a node environment, so the sidebar module
// itself is not imported here (it mounts DOM + React at module load); what has
// to be guarded HERE is that the two display surfaces keep delegating to the
// resolver instead of re-inlining a `cz_local || cz_abbrev` chain (which would
// bypass the legal-reference guard and print "siehe gültige Bau- und
// Zonenordnung" as a zone) or reading `cz_harmonized` raw.
//
// `cz_local` still appears in main.js / viewerConfig.js on purpose: it is the
// cohort KEY (green wash + /score/similoo "same zone" comparables), an
// analytics key read raw off the tile, not a display label.
describe('zone display delegates to the shared rule', () => {
  it('sidebar zone pill imports the resolver and resolves, never a field chain', () => {
    expect(sidebar).toContain("from '@aireon/shared/parcel-zone'");
    expect(sidebar).toMatch(/value:\s*resolveZoneLabel\(zoneSource\(target\)\)/);
    // The old chain: `target.cz_local || target.cz_abbrev`.
    expect(sidebar).not.toMatch(/target\.cz_local\s*\|\|/);
    expect(sidebar).not.toMatch(/\.cz_harmonized/);
  });

  it('comparable detail subtitle resolves the zone, never a field chain', () => {
    expect(main).toContain("from '@aireon/shared/parcel-zone'");
    expect(main).toMatch(/const zone = resolveZoneLabel\(c\);/);
    expect(main).not.toMatch(/c\.cz_local\s*\|\|/);
    expect(main).not.toMatch(/\.cz_harmonized/);
  });

  it('keeps the comparables cohort keyed on the municipal cz_local (analytics key)', () => {
    // The green wash and the /score/similoo cohort are defined on cz_local;
    // that raw read is the cohort key, not a display surface.
    expect(main).toMatch(/currentTargetCzLocal = parcelFeature\?\.properties\?\.cz_local/);
  });
});

describe('shared zone rule, as similoo relies on it', () => {
  // Grenchen SO: the parcel the sidebar pill was checked on. Municipal
  // "Wohnzone, Bauklasse 4"; federal "Wohnzonen".
  const grenchen = {
    cz_local: 'Wohnzone, Bauklasse 4',
    cz_abbrev: 'Wohnzone, Bauklasse 4',
    cz_harmonized: 'Wohnzonen',
    cz_canton_name: 'SO',
  };

  it('shows the municipal designation, not the federal category (Grenchen)', () => {
    expect(resolveZoneLabel(grenchen)).toBe('Wohnzone, Bauklasse 4');
    expect(resolveZoneLabel(grenchen)).not.toBe('Wohnzonen');
  });

  it('keeps the federal category reachable for logic, independent of the label', () => {
    // Bauzone checks / national grouping still read the federal category via
    // resolveHarmonizedZone(), whatever the display setting.
    expect(resolveHarmonizedZone(grenchen)).toEqual({ code: 11, label: 'Wohnzonen' });
  });

  it('never prints the ordinance cross-reference or the canton code as the zone (Zürich)', () => {
    // RES /score/similoo puts the parcel's cz_canton on the wire as `cz_abbrev`;
    // for Zürich that is the ordinance cross-reference, which must never print.
    expect(
      resolveZoneLabel({
        cz_local: 'dreigeschossige Wohnzone',
        cz_harmonized: null,
        cz_abbrev: 'siehe gültige Bau- und Zonenordnung der Stadt Zürich',
        cz_canton: 'siehe gültige Bau- und Zonenordnung der Stadt Zürich',
        cz_canton_name: 'ZH',
      }),
    ).toBe('dreigeschossige Wohnzone');

    expect(
      resolveZoneLabel({
        cz_local: null,
        cz_harmonized: null,
        cz_abbrev: 'siehe gültige Bau- und Zonenordnung der Stadt Zürich',
        cz_canton_name: 'ZH',
      }),
    ).toBeNull();
  });

  it('resolves the tile properties laid over the /score/similoo row to the municipal label', () => {
    // What sidebar.js zoneSource() builds: the RES target row plus the picked
    // tile's zone columns (which also carry cz_harmonized). Either way the
    // label is the municipal designation, and the federal category never leaks
    // into the pill.
    const resRow = { egrid: 'CH123', cz_local: 'Wohnzone, Bauklasse 4', cz_abbrev: 'Wohnzone, Bauklasse 4' };
    const tile = { cz_local: 'Wohnzone, Bauklasse 4', cz_harmonized: 'Wohnzonen', cz_canton_name: 'SO' };
    expect(resolveZoneLabel({ ...resRow, ...tile })).toBe('Wohnzone, Bauklasse 4');
    // Tile pick missed → the row alone → still the municipal designation.
    expect(resolveZoneLabel(resRow)).toBe('Wohnzone, Bauklasse 4');
  });

  it('falls back to the federal category only where the municipal designation is blank', () => {
    expect(
      resolveZoneLabel({ cz_local: null, cz_harmonized: 'Wohnzonen', cz_canton_name: 'SO' }),
    ).toBe('Wohnzonen');
  });
});
