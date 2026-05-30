#!/usr/bin/env node
// Post-publish production smoke check.
//
// Why this exists: a publish can "succeed" (build green, PR merged) yet leave the
// app unreachable to the public — e.g. Vercel deployment protection left ON (401
// SSO wall), the production alias pointing at the wrong/no deployment (404
// DEPLOYMENT_NOT_FOUND), or a broken build artifact. None of those show up in a
// local `npm run build`. This script hits the LIVE production URL the way a real
// visitor does and fails loudly if the app is not actually online.
//
// Usage:
//   node scripts/smoke.mjs [url] [must-contain]
//   SMOKE_URL=https://similoo.vercel.app/ node scripts/smoke.mjs
//
// Exit code 0 = app is publicly online and serving the expected build.
// Exit code 1 = app is NOT properly online (with a diagnosis printed).

// Default to the suite-standard public URL (what toolbox/config.json + README link to),
// NOT the project's bare <name>.vercel.app — the whole point is to catch a missing
// swissnovo-<app>.vercel.app domain, which is exactly what broke here.
const URL = process.argv[2] || process.env.SMOKE_URL || 'https://swissnovo-similoo.vercel.app/';
const MUST_CONTAIN = process.argv[3] || process.env.SMOKE_MUST_CONTAIN || 'similoo';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20000);

const fails = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.log(`  ✗ ${m}`); fails.push(m); };

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { redirect: 'follow', signal: ctrl.signal, ...opts });
  } finally {
    clearTimeout(t);
  }
}

console.log(`\nsmoke: ${URL}`);

let res, body;
try {
  res = await fetchWithTimeout(URL);
  body = await res.text();
} catch (e) {
  bad(`request failed: ${e.message}`);
  report();
}

// 1) Status must be a clean 200 — not a Vercel protection/404/error page.
if (res.status === 200) {
  ok(`HTTP 200`);
} else if (res.status === 401) {
  bad(`HTTP 401 — Vercel deployment protection is ON. Disable it: ` +
      `Vercel project Settings > Deployment Protection > Vercel Authentication = Off ` +
      `(or PATCH /v9/projects/<id> {"ssoProtection":null}). Public siblings have ssoProtection=null.`);
} else if (res.status === 404) {
  bad(`HTTP 404 — DEPLOYMENT_NOT_FOUND or wrong URL. Check the production alias / project name.`);
} else {
  bad(`HTTP ${res.status} — expected 200`);
}

// 2) No Vercel SSO login wall (belt-and-suspenders even if a 200 leaks through).
const setCookie = res.headers.get('set-cookie') || '';
const wwwAuth = res.headers.get('www-authenticate') || '';
if (setCookie.includes('_vercel_sso_nonce') || wwwAuth) {
  bad(`Vercel SSO wall detected (auth cookie/header present) — app is login-gated, not public.`);
} else {
  ok(`no Vercel SSO wall`);
}

// 3) The expected app HTML actually rendered (not a Vercel error/landing shell).
if (typeof body === 'string' && body.toLowerCase().includes(MUST_CONTAIN.toLowerCase())) {
  ok(`body contains "${MUST_CONTAIN}"`);
} else {
  bad(`body does not contain "${MUST_CONTAIN}" — not serving the expected app HTML`);
}

// 4) The hashed JS bundle the HTML references must itself load (catches broken builds).
if (typeof body === 'string') {
  const m = body.match(/<script[^>]+src="([^"]+\.js)"/i);
  if (m) {
    const assetUrl = new global.URL(m[1], URL).href;
    try {
      const a = await fetchWithTimeout(assetUrl);
      if (a.status === 200) ok(`JS bundle loads (${m[1]})`);
      else bad(`JS bundle ${m[1]} returned HTTP ${a.status}`);
    } catch (e) {
      bad(`JS bundle ${m[1]} failed to load: ${e.message}`);
    }
  } else {
    bad(`no <script src=*.js> found in HTML — build output looks wrong`);
  }
}

report();

function report() {
  if (fails.length === 0) {
    console.log(`\nPASS — ${URL} is publicly online.\n`);
    process.exit(0);
  }
  console.log(`\nFAIL — ${fails.length} problem(s). ${URL} is NOT properly online.\n`);
  process.exit(1);
}
