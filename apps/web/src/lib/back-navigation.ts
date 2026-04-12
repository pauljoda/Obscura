/**
 * Contextual back-navigation helpers.
 *
 * Detail pages accept an optional `from` query parameter that encodes the
 * originating page URL.  When present the back button navigates there instead
 * of a hard-coded default.
 */

/** Append `?from=<encodedFromPath>` to a target href. */
export function buildHrefWithFrom(targetHref: string, fromPath: string): string {
  const separator = targetHref.includes("?") ? "&" : "?";
  return `${targetHref}${separator}from=${encodeURIComponent(fromPath)}`;
}

/**
 * Read the `from` search-param and return it if valid, otherwise return
 * `fallback`.  Only root-relative paths (`/…`) are accepted to prevent
 * open-redirect abuse.
 */
export function getBackHref(
  searchParams: URLSearchParams | { get(key: string): string | null },
  fallback: string,
): string {
  const raw = searchParams.get("from");
  if (raw && raw.startsWith("/")) return raw;
  return fallback;
}
