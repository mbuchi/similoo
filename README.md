# similoo — Comparable Buildings Explorer

Find buildings that are comparable to a chosen parcel — same zoning, recent construction — and inspect them side-by-side in 3D.

similoo is forked from [hood](https://github.com/mbuchi/hood) and reuses its CesiumJS-based 3D viewer foundation. From there it adds:

- A **comparison sidebar** listing matched buildings with EGRID, construction year, ratioV, parcel size — all sortable.
- A **match engine** with hard filters (same zoning, construction-year window) and soft scoring (parcel size, building volume, ratioV proximity).
- **Highlighted comparables** rendered directly on the primary 3D map.
- Per-card **3D inspection** (lightweight orbit preview) with a "Jump to" action that flies the main map camera to the building.

## Status

Early scaffolding. The Cesium foundation, navbar, settings, theme toggle, and i18n (EN/FR/DE/IT) are inherited from hood and work today. The similarity engine, sidebar, and backend `/score/similoo` endpoint are still to come.

## Tech Stack

| Layer        | Choice                                                      |
| ------------ | ----------------------------------------------------------- |
| Build tool   | [Vite 5](https://vitejs.dev/)                               |
| Language     | Vanilla JavaScript (ES modules)                             |
| 3D engine    | CesiumJS 1.105.1 (loaded from Cesium's CDN)                 |
| Icons        | [Lucide](https://lucide.dev/)                               |
| Onboarding   | Shepherd.js                                                 |
| Hosting      | Vercel (static site + Node.js serverless function)          |
| API runtime  | Vercel Functions (`api/*.js`, Node.js)                      |
| Backend      | `project_RES` (Redis-cached PostGIS + GWR similarity query) |

## Local Development

```bash
npm install
cp .env.example .env  # set VITE_CESIUM_ION_TOKEN, VITE_OIDC_*, etc.
npm run dev           # http://localhost:5173
npm run build         # static bundle in dist/
```

## Deployment

Vercel autodeploys `main`. Production URL: `https://swissnovo-similoo.vercel.app`.

> Domain note: the Vercel **project is named `similoo`**, so Vercel auto-assigns it
> `similoo.vercel.app`. The suite-standard `swissnovo-similoo.vercel.app` (the URL the
> toolbox launcher and this README use) is added as an **additional domain on the same
> project**. Both serve the same production deployment. If `swissnovo-similoo.vercel.app`
> ever 404s, that domain has been dropped from the project — re-add it in the project's
> Domains settings (or `POST /v10/projects/similoo/domains`).

### Required: post-publish smoke check

A green build and a merged PR do **not** prove the app is reachable at the URL the suite
links to — a missing `swissnovo-*` domain returns a 404 that no local `npm run build`
catches. **Every publish must end with the live smoke check passing:**

```bash
npm run smoke   # hits https://swissnovo-similoo.vercel.app — exits non-zero if not online
```

It checks HTTP 200, that there's no Vercel login wall, that the expected HTML rendered,
and that the hashed JS bundle loads. CI runs the same check on every push to `main`
(`.github/workflows/smoke.yml`), so a bad publish turns the commit red automatically.

## Lineage

Forked from `mbuchi/hood` @ commit `05f85e9`. Brand identifiers (`app_name`, `APP_SOURCE`, screenshot prefix, localStorage namespace) are switched to `similoo` so telemetry and per-user state stay isolated from hood.
