"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "obscura:recent-searches";
const MAX_RECENT = 8;
const EMPTY_SEARCHES: string[] = [];

let listeners: (() => void)[] = [];
let cachedRaw: string | null = null;
let cachedSearches: string[] = EMPTY_SEARCHES;

function emitChange() {
  listeners.forEach((l) => l());
}

function normalizeSearches(searches: string[]): string[] {
  return searches.length === 0 ? EMPTY_SEARCHES : searches;
}

function readSearches(): string[] {
  if (typeof window === "undefined") return EMPTY_SEARCHES;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw === cachedRaw) {
      return cachedSearches;
    }

    cachedRaw = raw;
    cachedSearches = raw ? normalizeSearches(JSON.parse(raw) as string[]) : EMPTY_SEARCHES;
    return cachedSearches;
  } catch {
    cachedRaw = null;
    cachedSearches = EMPTY_SEARCHES;
    return cachedSearches;
  }
}

function getSnapshot(): string[] {
  return readSearches();
}

function getServerSnapshot(): string[] {
  return EMPTY_SEARCHES;
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];

  function handleStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    try {
      cachedRaw = event.newValue;
      cachedSearches = event.newValue
        ? normalizeSearches(JSON.parse(event.newValue) as string[])
        : EMPTY_SEARCHES;
    } catch {
      cachedRaw = null;
      cachedSearches = EMPTY_SEARCHES;
    }
    emitChange();
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
    listeners = listeners.filter((l) => l !== listener);
  };
}

function writeSearches(searches: string[]) {
  const next = normalizeSearches(searches);
  cachedSearches = next;
  cachedRaw = next.length === 0 ? null : JSON.stringify(next);

  if (cachedRaw === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, cachedRaw);
  }

  emitChange();
}

export function useRecentSearches() {
  const searches = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const current = readSearches();
    const next = [trimmed, ...current.filter((s) => s !== trimmed)].slice(0, MAX_RECENT);
    writeSearches(next);
  }, []);

  const remove = useCallback((query: string) => {
    const current = readSearches();
    writeSearches(current.filter((s) => s !== query));
  }, []);

  const clear = useCallback(() => {
    writeSearches([]);
  }, []);

  return { searches, add, remove, clear };
}
