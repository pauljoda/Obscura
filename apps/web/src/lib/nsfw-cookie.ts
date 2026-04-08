/**
 * Resolve NSFW display mode from the raw cookie value.
 * Matches defaults in `app/(app)/layout.tsx` so SSR queries align with NsfwProvider.
 */
export type NsfwModeCookie = "off" | "blur" | "show";

export function parseNsfwModeCookie(raw: string | undefined): NsfwModeCookie {
  if (raw === "blur" || raw === "show" || raw === "off") return raw;
  return "off";
}
