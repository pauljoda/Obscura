/**
 * Server-side API fetch wrapper. Runs only in SvelteKit `+*.server.ts`
 * files (not bundled into the client). Uses `INTERNAL_API_URL` which in
 * dev points directly at the Fastify service and in production points at
 * `http://localhost:4000` inside the unified container.
 *
 * Two call patterns:
 *
 *   // Simple form — uses the runtime's global fetch:
 *   const videos = await serverFetch<VideoListItemDto[]>("/videos");
 *
 *   // SvelteKit-aware form — pass the event's fetch so SSR can track
 *   // the upstream request and hydrate without a double-fetch:
 *   export const load = async ({ fetch, depends }) => {
 *     depends("videos");
 *     return {
 *       videos: await serverFetch<VideoListItemDto[]>("/videos", { fetch }),
 *     };
 *   };
 */
import { INTERNAL_API_URL } from "$env/static/private";

export { buildQueryString } from "../query-string";

const API_BASE = INTERNAL_API_URL ?? "http://localhost:4000";

type FetchLike = typeof fetch;

export interface ServerFetchOptions {
  /** Event fetch from a load function, for SvelteKit SSR tracking. */
  fetch?: FetchLike;
  /** Extra fetch init (method, body, headers). */
  init?: RequestInit;
  /**
   * Legacy Next.js tagging options. Ignored in SvelteKit — each `+*.server.ts`
   * load function should call `depends(key)` itself; see ./README.md.
   * Accepted here so copied-over modules keep compiling until they are
   * rewritten. Will be removed once every caller is ported.
   */
  revalidate?: number | false;
  tags?: string[];
}

export async function serverFetch<T>(
  path: string,
  options?: ServerFetchOptions,
): Promise<T> {
  const f = options?.fetch ?? globalThis.fetch;
  const headers = new Headers(options?.init?.headers);
  if (options?.init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await f(`${API_BASE}${path}`, {
    ...options?.init,
    headers,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `API ${res.status}: ${res.statusText}`);
  }

  return res.json();
}
