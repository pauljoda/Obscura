import type { LayoutServerLoad } from "./$types";
import { parseNsfwModeCookie } from "$lib/nsfw/cookie";
import { fetchLibraryConfig } from "$lib/v1/server/system-v1";

/**
 * Root server load. Reads cookies on every request so the client
 * hydrates with the correct NSFW mode and sidebar state, and probes
 * library config for LAN auto-enable.
 */
export const load: LayoutServerLoad = async ({ cookies, fetch }) => {
  const initialCollapsed = cookies.get("obscura-sidebar") === "collapsed";
  const initialNsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));

  let lanAutoEnable = false;
  let awaitingBreakingConsent = false;

  try {
    const config = await fetchLibraryConfig({ fetch });
    lanAutoEnable = config.settings?.nsfwLanAutoEnable ?? false;
  } catch {
    // Non-fatal — DB may be unavailable during cold start.
  }

  try {
    const res = await fetch("/api/system/status");
    if (res.ok) {
      const status = (await res.json()) as { awaitingBreakingConsent?: boolean };
      awaitingBreakingConsent = status.awaitingBreakingConsent ?? false;
    }
  } catch {
    // Non-fatal.
  }

  return {
    initialCollapsed,
    initialNsfwMode,
    lanAutoEnable,
    awaitingBreakingConsent,
  };
};
