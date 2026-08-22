import { describe, expect, it } from 'vitest';
import app from './App.tsx?raw';

describe('combined address and Open with selector', () => {
  it('uses the authoritative engine location in the desktop search placement', () => {
    expect(app).toContain('openWith={isCompact ? undefined : {');
    expect(app).toContain("currentAppId: 'similoo'");
    expect(app).toContain('location: openWithLocation');
    expect(app).toContain('dark={isDark}');
    expect(app).toContain("placement: 'search'");
    expect(app).toContain("defaultTargetAppId: 'similoo'");
    expect(app).toContain('zoom: 17');
    expect(app).not.toContain('<OpenWithMenu');
  });

  it('keeps the welcome search gate and compact launcher at parcel zoom', () => {
    expect(app).toContain('isMobile && !currentAddress && !gateBypassed');
    expect(app).toContain(
      'openInApp(app.id, openWithLocation.lat, openWithLocation.lng, 17)',
    );
  });
});
