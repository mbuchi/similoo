// @vitest-environment jsdom

import { act, type ElementType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLoadingFeedbackPolicy } from '@aireon/shared';
import ScreenshotOverlay from './ScreenshotOverlay';
import * as SavedImagesModule from './SavedImagesPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function primePolicy(spinnerEnabled: boolean, skeletonEnabled: boolean) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      spinner_enabled: spinnerEnabled,
      skeleton_enabled: skeletonEnabled,
      skeleton_threshold_ms: 3000,
      updated_at: null,
    }),
  }));
  await fetchLoadingFeedbackPolicy(true);
}

const mounted: Array<{ root: Root; host: HTMLDivElement }> = [];

async function renderOverlay() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  await act(async () => {
    root.render(<ScreenshotOverlay isCapturing darkMode={false} />);
  });
}

afterEach(() => {
  for (const item of mounted.splice(0)) {
    act(() => item.root.unmount());
    item.host.remove();
  }
  vi.unstubAllGlobals();
});

describe('Similoo loading-feedback owners', () => {
  it.each([
    ['off/off', false, false],
    ['skeleton-only before its threshold', false, true],
  ])('keeps the capture host visually transparent under %s', async (_name, spinner, skeleton) => {
    await primePolicy(spinner, skeleton);
    await renderOverlay();

    const host = document.querySelector('[data-screenshot-ignore="true"]');
    expect(host?.className).toContain('fixed inset-0 z-[200]');
    expect(host?.className).not.toMatch(/bg-black|backdrop-blur/);
    expect(host?.innerHTML).not.toMatch(/bg-black|backdrop-blur|animate-pulse/);
  });

  it('contains the real shared spinner inside the ignored fixed capture host', async () => {
    await primePolicy(true, false);
    await renderOverlay();

    const host = document.querySelector('[data-screenshot-ignore="true"]');
    expect(host?.querySelector('[role="status"][aria-label]')).not.toBeNull();
  });

  it.each([
    ['off/off', false, false],
    ['skeleton-only before its threshold', false, true],
  ])('suppresses the real saved-image branch under %s', async (_name, spinner, skeleton) => {
    await primePolicy(spinner, skeleton);
    const SavedImagesLoading = (SavedImagesModule as unknown as {
      SavedImagesLoading?: ElementType;
    }).SavedImagesLoading;
    expect(SavedImagesLoading).toBeDefined();
    if (!SavedImagesLoading) return;

    const html = renderToStaticMarkup(<SavedImagesLoading darkMode={false} />);
    expect(html).not.toContain('animate-pulse');
    expect(html).not.toContain('aria-busy');
  });
});
