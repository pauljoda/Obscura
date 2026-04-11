/**
 * Process-wide cache of {@link StashBoxClient} instances keyed by endpoint UUID.
 *
 * The client ships with an internal token-bucket rate limiter (240 rpm by
 * default), but that limiter only protects requests made through the *same*
 * client instance. Route handlers that `new StashBoxClient()` on every request
 * get a fresh bucket each time, which effectively disables rate limiting
 * during bulk operations like pHash contributions.
 *
 * Centralizing clients here means every route (identify, submit-fingerprints,
 * bulk-scrape, etc.) shares the same limiter per endpoint, so 240 rpm actually
 * holds across concurrent requests and across the lifetime of the API process.
 *
 * Invalidate the cached client whenever the endpoint's URL or API key changes
 * (PATCH/DELETE handlers) so stale credentials don't linger.
 */

import { StashBoxClient } from "@obscura/stash-import";

type EndpointLike = { id: string; endpoint: string; apiKey: string };

const clients = new Map<string, StashBoxClient>();

export function getStashBoxClient(ep: EndpointLike): StashBoxClient {
  const existing = clients.get(ep.id);
  if (existing) return existing;
  const client = new StashBoxClient(ep.endpoint, ep.apiKey);
  clients.set(ep.id, client);
  return client;
}

export function invalidateStashBoxClient(endpointId: string): void {
  clients.delete(endpointId);
}
