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

## Lineage

Forked from `mbuchi/hood` @ commit `05f85e9`. Brand identifiers (`app_name`, `APP_SOURCE`, screenshot prefix, localStorage namespace) are switched to `similoo` so telemetry and per-user state stay isolated from hood.
