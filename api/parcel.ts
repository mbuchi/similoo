// Vercel Node serverless function.
//
// Proxies POST /api/parcel → RES /res_api/parcel_data so the client never
// needs the RES API token. Mirrors the scoore /api/overpass pattern.

export const config = { maxDuration: 15 };

const RES_PARCEL_URL = "https://res.zeroo.ch/res_api/parcel_data";
const RES_API_TOKEN = "DNfbHaqajFigz4jPX9B8vnatUduLKZXVwA83WKZG";
const UPSTREAM_TIMEOUT_MS = 12000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NodeReq {
  method?: string;
  body?: unknown;
}
interface NodeRes {
  setHeader(name: string, value: string): void;
  status(code: number): NodeRes;
  json(body: unknown): void;
  end(): void;
}

function send(res: NodeRes, status: number, body: unknown): void {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
  res.status(status).json(body);
}

export default async function handler(
  req: NodeReq,
  res: NodeRes,
): Promise<void> {
  if (req.method === "OPTIONS") {
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed" });
    return;
  }

  let body: { lat?: unknown; lng?: unknown; egrid?: unknown } | undefined;
  if (typeof req.body === "string") {
    try {
      body = JSON.parse(req.body);
    } catch {
      send(res, 400, { error: "Invalid JSON body" });
      return;
    }
  } else {
    body = req.body as typeof body;
  }

  const egrid = typeof body?.egrid === "string" ? body.egrid.trim() : null;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!egrid && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
    send(res, 400, { error: "Provide either 'egrid' or 'lat'/'lng'" });
    return;
  }

  const upstreamBody: Record<string, unknown> = {};
  if (egrid) upstreamBody.egrid = egrid;
  if (!egrid) {
    upstreamBody.lat = lat;
    upstreamBody.lng = lng;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(RES_PARCEL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: RES_API_TOKEN,
      },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    });
    const text = await upstream.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { error: "Non-JSON response from upstream", raw: text.slice(0, 200) };
    }
    if (!upstream.ok) {
      send(res, upstream.status >= 500 ? 502 : upstream.status, parsed);
      return;
    }
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    send(res, 200, parsed);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    send(res, 502, { error: "parcel service unreachable", details: msg });
  } finally {
    clearTimeout(timer);
  }
}
