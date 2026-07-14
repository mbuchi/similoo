import { createSignalClient } from '@aireon/shared';

// Suite usage-signal client. Reports through similoo's own
// /api/signal-collect proxy (which attaches the server-side bearer token).
export const signal = createSignalClient({ appName: 'similoo' });
