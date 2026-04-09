/**
 * Generic factory for cookie-backed list preference objects.
 *
 * Each entity (scenes, galleries, performers, etc.) defines its own prefs
 * type and validation logic.  The factory provides the shared boilerplate:
 * JSON parse/encode with URI encoding, cookie read/write/clear, and
 * default-comparison helpers.
 */

/** Type guard: value is a plain object (not array, not null). */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const ONE_YEAR = 60 * 60 * 24 * 365;

// ---------------------------------------------------------------------------
// Config & API types
// ---------------------------------------------------------------------------

export interface ListPrefsConfig<T> {
  cookieName: string;
  maxAge?: number; // default: 1 year
  defaults: () => T;
  validate: (parsed: Record<string, unknown>) => T | null;
}

export interface ListPrefsApi<T> {
  cookieName: string;
  maxAge: number;
  defaults: () => T;
  isDefault: (prefs: T) => boolean;
  parse: (raw: string | undefined) => T | null;
  serialize: (prefs: T) => string;
  writeCookie: (prefs: T) => void;
  clearCookie: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createListPrefs<T>(config: ListPrefsConfig<T>): ListPrefsApi<T> {
  const { cookieName, defaults, validate } = config;
  const maxAge = config.maxAge ?? ONE_YEAR;

  function parse(raw: string | undefined): T | null {
    if (raw === undefined || raw === "") return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded) as unknown;
    } catch {
      return null;
    }
    if (!isRecord(parsed)) return null;
    return validate(parsed);
  }

  function serialize(prefs: T): string {
    return encodeURIComponent(JSON.stringify(prefs));
  }

  function isDefault(prefs: T): boolean {
    return JSON.stringify(prefs) === JSON.stringify(defaults());
  }

  function writeCookie(prefs: T): void {
    if (typeof document === "undefined") return;
    document.cookie = `${cookieName}=${serialize(prefs)};path=/;max-age=${maxAge};samesite=lax`;
  }

  function clearCookie(): void {
    if (typeof document === "undefined") return;
    document.cookie = `${cookieName}=;path=/;max-age=0;samesite=lax`;
  }

  return {
    cookieName,
    maxAge,
    defaults,
    isDefault,
    parse,
    serialize,
    writeCookie,
    clearCookie,
  };
}
