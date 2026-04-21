import { getContext, setContext } from "svelte";
import { browser } from "$app/environment";
import { invalidateAll } from "$app/navigation";
import { isModShiftZ } from "../nsfw-hotkey";
import { type NsfwMode } from "../nsfw-cookie";

const COOKIE_NAME = "obscura-nsfw-mode";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const KEY = Symbol("nsfw");

function writeCookie(mode: NsfwMode) {
  if (!browser) return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(mode)};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
}

/**
 * Tell SvelteKit to re-run every `+page.server.ts` / `+layout.server.ts`
 * loader. The NSFW cookie is read by those loaders to build API
 * query-strings (`?nsfw=show|off|blur`), so any mode change must
 * refresh the data the API returned with the old value. Without this,
 * grids keep displaying the pre-toggle filtering until a hard reload.
 */
function refetchServerData() {
  if (!browser) return;
  void invalidateAll();
}

export class NsfwStore {
  mode = $state<NsfwMode>("off");
  /** True once the async LAN check has completed (or was skipped). */
  initialized = $state(false);
  private hasAutoEnabled = false;
  private keydownAttached = false;

  constructor(opts: { initialMode: NsfwMode; lanAutoEnable: boolean }) {
    this.mode = opts.initialMode;

    const hasCookie = opts.initialMode !== "off" || !opts.lanAutoEnable;
    this.initialized = hasCookie;

    if (!browser) return;

    if (!this.initialized && !this.hasAutoEnabled) {
      this.hasAutoEnabled = true;
      // No cookie yet and lanAutoEnable is on — check if we're on LAN
      fetch("/api/client-info")
        .then((r) => r.json())
        .then((data: { isLan?: boolean }) => {
          if (data.isLan) {
            this.mode = "show";
            writeCookie("show");
            refetchServerData();
          }
        })
        .catch(() => {})
        .finally(() => {
          this.initialized = true;
        });
    }

    // Global keydown for ⌘⇧Z / Ctrl+Shift+Z
    $effect.root(() => {
      if (this.keydownAttached) return;
      this.keydownAttached = true;
      const handler = (e: KeyboardEvent) => {
        if (!this.initialized) return;
        if (!isModShiftZ(e)) return;
        e.preventDefault();
        e.stopPropagation();
        this.toggleShowOff();
      };
      window.addEventListener("keydown", handler, true);
      return () => {
        window.removeEventListener("keydown", handler, true);
        this.keydownAttached = false;
      };
    });
  }

  setMode(next: NsfwMode) {
    if (this.mode === next) return;
    this.mode = next;
    writeCookie(next);
    refetchServerData();
  }

  toggleShowOff() {
    const next = this.mode === "show" ? "off" : "show";
    this.mode = next;
    writeCookie(next);
    refetchServerData();
  }
}

export function provideNsfw(opts: { initialMode: NsfwMode; lanAutoEnable: boolean }) {
  const store = new NsfwStore(opts);
  setContext(KEY, store);
  return store;
}

export function useNsfw(): NsfwStore {
  const ctx = getContext<NsfwStore | undefined>(KEY);
  if (!ctx) throw new Error("useNsfw must be used inside a component tree with <NsfwProvider>");
  return ctx;
}
