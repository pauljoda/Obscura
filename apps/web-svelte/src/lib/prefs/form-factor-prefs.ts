export type UiPrefsFormFactor = "mobile" | "desktop";

export const MOBILE_UI_PREFS_QUERY = "(max-width: 767px)";

export function detectUiPrefsFormFactor(): UiPrefsFormFactor {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "desktop";
  }
  return window.matchMedia(MOBILE_UI_PREFS_QUERY).matches ? "mobile" : "desktop";
}

export function formFactorUiPrefKey(
  baseKey: string,
  formFactor: UiPrefsFormFactor = "desktop",
): string {
  return `${baseKey}:${formFactor}`;
}
