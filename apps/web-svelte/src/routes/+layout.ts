import type { LayoutLoad } from "./$types";

export const ssr = false;

export const load: LayoutLoad = async ({ fetch }) => {
  try {
    const res = await fetch("/api/system/v2-upgrade-gate");
    if (res.ok) {
      const gate: { accepted: boolean } = await res.json();
      return { awaitingBreakingConsent: !gate.accepted };
    }
  } catch {
    // Backend unreachable — let the app render without blocking.
  }

  return { awaitingBreakingConsent: false };
};
