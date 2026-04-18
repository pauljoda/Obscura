import { getContext, setContext } from "svelte";
import { browser } from "$app/environment";
import { isModShiftZ } from "../nsfw-hotkey";
import { type NsfwMode } from "../nsfw-cookie";

const COOKIE_NAME = "obscura-nsfw-mode";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const KEY = Symbol("nsfw");

function writeCookie(mode: NsfwMode) {
  if (!browser) return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(mode)};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
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
    this.mode = next;
    writeCookie(next);
  }

  toggleShowOff() {
    const next = this.mode === "show" ? "off" : "show";
    this.mode = next;
    writeCookie(next);
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
