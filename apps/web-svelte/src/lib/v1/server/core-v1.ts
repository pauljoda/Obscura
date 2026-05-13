/**
 * Server-side API fetch wrapper. Runs only in SvelteKit `+*.server.ts`
 * files (not bundled into the client).
 *
 * All calls go same-origin to `/api/<path>` and are served directly by
 * SvelteKit.
 *
 * Two call patterns:
 *
 *   // SvelteKit-aware (preferred) — event fetch tracks the request so
 *   // SSR can inline the response body into the hydration payload and
 *   // the browser doesn't double-fetch:
 *   export const load = async ({ fetch, depends }) => {
 *     depends("videos");
 *     return {
 *       videos: await serverFetch<VideoListItemDto[]>("/videos", { fetch }),
 *     };
 *   };
 *
 *   // Fallback — uses the runtime's global fetch. Needs an absolute
 *   // URL, so we read PUBLIC_APP_URL to know where to call:
 *   const videos = await serverFetch<VideoListItemDto[]>("/videos");
 */
import { env } from "$env/dynamic/public";

export { buildQueryString } from "$lib/query-string";

// When no event fetch is supplied we need an absolute URL back to the
// SvelteKit server.
const ABSOLUTE_BASE =
  (typeof env.PUBLIC_APP_URL === "string" && env.PUBLIC_APP_URL.length > 0
    ? env.PUBLIC_APP_URL.replace(/\/$/, "")
    : "http://localhost:8008");

type FetchLike = typeof fetch;

export interface ServerFetchOptions {
  /** Event fetch from a load function, for SvelteKit SSR tracking. */
  fetch?: FetchLike;
  /** Extra fetch init (method, body, headers). */
  init?: RequestInit;
  /**
   * Back-compat tagging options. Ignored in SvelteKit — each `+*.server.ts`
   * load function should call `depends(key)` itself; see ./README.md.
   */
  revalidate?: number | false;
  tags?: string[];
}

export async function serverFetch<T>(
  path: string,
  options?: ServerFetchOptions,
): Promise<T> {
  const f = options?.fetch ?? globalThis.fetch;

  // Paths start with `/`; prepend `/api` so every call lands on
  // SvelteKit's own ingress. If the event fetch is supplied the URL can
  // stay relative; otherwise we need an absolute URL back to our own
  // server.
  const apiPath = `/api${path}`;
  const url = options?.fetch ? apiPath : `${ABSOLUTE_BASE}${apiPath}`;

  const headers = new Headers(options?.init?.headers);
  if (options?.init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await f(url, {
    ...options?.init,
    headers,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `API ${res.status}: ${res.statusText}`);
  }

  return res.json();
}
