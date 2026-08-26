// Neutral mount point for the shared signal collector.
//
// Identical handler to `api/signal-collect.js` — this exists only so the once
// per session flush that carries whatever never found a carrier request does
// not put a row literally named "signal-collect" in the browser Network tab.
// See aireon-shared/docs/SIGNAL_STANDARD.md for what that does and does not
// buy: it reduces incidental visibility, it is not a privacy or security
// property, and it is trivially findable by anyone who looks.
//
// `api/signal-collect.js` stays forever: stale cached bundles still post there.
export { config, default } from '@aireon/shared/signal-collect';
