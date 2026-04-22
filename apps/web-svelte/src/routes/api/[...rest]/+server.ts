/**
 * Fallback API proxy — catches any `/api/*` request that has no local
 * SvelteKit handler.
 *
 * Behavior:
 *   - If `INTERNAL_API_URL` is set (and not the literal string "none"),
 *     the request is transparently forwarded to that upstream (Fastify
 *     during the migration) so the UI stays functional.
 *   - If it's unset or `"none"`, the request returns a loud 501
 *     "route not migrated" response with the method and path so the
 *     dev can see exactly what hasn't been ported to SvelteKit yet.
 *
 * Once every Fastify route has a local SvelteKit equivalent, this file
 * (and the whole `apps/api` package) can be deleted.
 */
import { json, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";

const RAW = env.INTERNAL_API_URL ?? "http://localhost:4000";
const UPSTREAM = RAW === "none" || RAW === "" ? null : RAW;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "host",
]);

function filterHeaders(headers: Headers): Headers {
  const out = new Headers();
  for (const [k, v] of headers.entries()) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) out.append(k, v);
  }
  return out;
}

function notMigrated(method: string, path: string) {
  const message = `Route /${path} is not yet owned by SvelteKit and INTERNAL_API_URL is disabled ("none"). Either migrate this route into apps/web-svelte/src/routes/api/ or start Fastify and point INTERNAL_API_URL at it.`;
  // eslint-disable-next-line no-console
  console.warn(`[api-proxy] 501 ${method} /api/${path}`);
  return json(
    {
      error: "Not migrated",
      method,
      path: `/api/${path}`,
      message,
    },
    { status: 501 },
  );
}

async function proxy(
  request: Request,
  params: Partial<Record<string, string>>,
  url: URL,
) {
  const rest = params.rest ?? "";

  if (!UPSTREAM) {
    return notMigrated(request.method, rest);
  }

  const target = new URL(`${UPSTREAM}/${rest}${url.search}`);

  const init: RequestInit = {
    method: request.method,
    headers: filterHeaders(request.headers),
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[api-proxy] upstream unreachable for ${request.method} /api/${rest}:`,
      err instanceof Error ? err.message : err,
    );
    return json(
      {
        error: "Upstream unavailable",
        method: request.method,
        path: `/api/${rest}`,
        message: `Proxy tried to reach ${UPSTREAM} but the connection failed. Either migrate this route or start the upstream API.`,
      },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: filterHeaders(upstream.headers),
  });
}

export const GET: RequestHandler = ({ request, params, url }) =>
  proxy(request, params, url);
export const POST: RequestHandler = ({ request, params, url }) =>
  proxy(request, params, url);
export const PUT: RequestHandler = ({ request, params, url }) =>
  proxy(request, params, url);
export const PATCH: RequestHandler = ({ request, params, url }) =>
  proxy(request, params, url);
export const DELETE: RequestHandler = ({ request, params, url }) =>
  proxy(request, params, url);
