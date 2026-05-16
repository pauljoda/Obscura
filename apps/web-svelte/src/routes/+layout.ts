import type { LayoutLoad } from "./$types";
import { readSidebarCookie } from "$lib/stores/app-chrome.svelte";

export const ssr = false;

export const load: LayoutLoad = async ({ fetch }) => {
  const initialCollapsed = readSidebarCookie();

  try {
    const res = await fetch("/api/system/v2-upgrade-gate");
    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && ct.includes("application/json")) {
      const gate: { accepted: boolean } = await res.json();
      return { awaitingBreakingConsent: !gate.accepted, initialCollapsed };
    }
  } catch {
    // Backend unreachable — let the app render without blocking.
  }

  return { awaitingBreakingConsent: false, initialCollapsed };
};
