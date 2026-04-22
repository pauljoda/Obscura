/**
 * Fallback API proxy — forwards any `/api/*` request that has no local
 * SvelteKit handler upstream to the Fastify API. This lets the SvelteKit
 * app be the single ingress for the UI during the migration, taking over
 * routes one at a time; anything not yet owned locally is transparently
 * relayed so the app stays functional.
 *
 * Once every Fastify route has a local SvelteKit equivalent, this file
 * (and the whole Fastify app) can be deleted.
 */
import type { RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";

const UPSTREAM = env.INTERNAL_API_URL ?? "http://localhost:4000";

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

async function proxy(request: Request, params: Partial<Record<string, string>>, url: URL) {
  const target = new URL(
    `${UPSTREAM}/${params.rest ?? ""}${url.search}`,
  );

  const init: RequestInit = {
    method: request.method,
    headers: filterHeaders(request.headers),
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);

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
