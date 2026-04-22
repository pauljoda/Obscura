import { getContext, setContext } from "svelte";
import { browser } from "$app/environment";

const KEY = Symbol("app-chrome");
const COOKIE_NAME = "obscura-sidebar";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function writeSidebarCookie(collapsed: boolean) {
  if (!browser) return;
  document.cookie = `${COOKIE_NAME}=${collapsed ? "collapsed" : "expanded"};path=/;max-age=${COOKIE_MAX_AGE}`;
}

export class AppChromeStore {
  sidebarCollapsed = $state(false);

  constructor(initialCollapsed: boolean) {
    this.sidebarCollapsed = initialCollapsed;
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    writeSidebarCookie(this.sidebarCollapsed);
  }
}

export function provideAppChrome(getInitialCollapsed: () => boolean) {
  const store = new AppChromeStore(getInitialCollapsed());
  setContext(KEY, store);
  return store;
}

export function useAppChrome(): AppChromeStore {
  const ctx = getContext<AppChromeStore | undefined>(KEY);
  if (!ctx) throw new Error("useAppChrome must be used inside <AppChromeProvider>");
  return ctx;
}
