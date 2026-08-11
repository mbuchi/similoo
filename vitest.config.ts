import { defineConfig } from 'vitest/config';

// Pure-unit tests only: no DOM, no network. `environment: 'node'` keeps the
// suite fast and honest about what these functions actually touch (the RES
// proxy handlers and service wrappers, not components). Browser-only shared
// modules are vi.mock'd wholesale where a spec needs them.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
    restoreMocks: true,
  },
});
