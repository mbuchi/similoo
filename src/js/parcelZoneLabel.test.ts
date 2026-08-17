import { describe, expect, it } from 'vitest';
import { resolveZoneLabel } from '@aireon/shared/parcel-zone';
// Source text via Vite's `?raw` (typed by vite/client; similoo has no node
// types), so the contract checks below read the shipped modules verbatim.
import sidebar from './comparison/sidebar.js?raw';
import main from './main.js?raw';

// Zone label = the shared rule (aireon-shared/docs/PARCEL_ZONE_STANDARD.md,
// harmonized-first since @aireon/shared v1.173.0). similoo's vitest runs in a
// node environment, so the sidebar module itself is not imported here (it
// mounts DOM + React at module load); what has to be guarded HERE is that the
// two display surfaces keep delegating to the resolver instead of re-inlining
// a `cz_local || cz_abbrev` chain — the shape that printed the municipal
// designation ("Wohnzone, Bauklasse 4") while every other app read
// "Wohnzonen" for the same parcel.
//
// `cz_local` still appears in main.js / viewerConfig.js on purpose: it is the
// cohort KEY (green wash + /score/similoo "same zone" comparables), which is an
// analytics key, not a display label.
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
    // relabelling that as the harmonized zone would lie about the statistics.
    expect(main).toMatch(/currentTargetCzLocal = parcelFeature\?\.properties\?\.cz_local/);
  });
});

describe('shared zone rule, as similoo relies on it', () => {
  it('shows the harmonized federal category, not the municipal designation (Grenchen)', () => {
    expect(
      resolveZoneLabel({
        cz_local: 'Wohnzone, Bauklasse 4',
        cz_abbrev: 'Wohnzone, Bauklasse 4',
        cz_harmonized: 'Wohnzonen',
        cz_canton_name: 'SO',
      }),
    ).toBe('Wohnzonen');
  });

  it('falls back to the municipal designation only where no harmonized category exists (Zürich)', () => {
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

  it('resolves the tile properties laid over the /score/similoo row to the federal label', () => {
    // What sidebar.js zoneSource() builds: the RES target row (municipal only)
    // plus the picked tile's zone columns (which carry cz_harmonized).
    const resRow = { egrid: 'CH123', cz_local: 'Wohnzone, Bauklasse 4', cz_abbrev: 'Wohnzone, Bauklasse 4' };
    const tile = { cz_local: 'Wohnzone, Bauklasse 4', cz_harmonized: 'Wohnzonen', cz_canton_name: 'SO' };
    expect(resolveZoneLabel({ ...resRow, ...tile })).toBe('Wohnzonen');
    // Tile pick missed → the row alone → municipal fallback, still one label.
    expect(resolveZoneLabel(resRow)).toBe('Wohnzone, Bauklasse 4');
  });
});
