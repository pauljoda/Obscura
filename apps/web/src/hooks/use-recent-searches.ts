"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "obscura:recent-searches";
const MAX_RECENT = 8;

let listeners: (() => void)[] = [];
function emitChange() {
  listeners.forEach((l) => l());
}

function getSnapshot(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getServerSnapshot(): string[] {
  return [];
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function writeSearches(searches: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  emitChange();
}

export function useRecentSearches() {
  const searches = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const current = getSnapshot();
    const next = [trimmed, ...current.filter((s) => s !== trimmed)].slice(0, MAX_RECENT);
    writeSearches(next);
  }, []);

  const remove = useCallback((query: string) => {
    const current = getSnapshot();
    writeSearches(current.filter((s) => s !== query));
  }, []);

  const clear = useCallback(() => {
    writeSearches([]);
  }, []);

  return { searches, add, remove, clear };
}
