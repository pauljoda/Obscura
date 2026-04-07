"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type NsfwMode = "off" | "blur" | "show";

interface NsfwContextValue {
  mode: NsfwMode;
  setMode: (mode: NsfwMode) => void;
}

const NsfwContext = createContext<NsfwContextValue>({
  mode: "off",
  setMode: () => {},
});

const COOKIE_NAME = "obscura-nsfw-mode";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readModeCookie(): NsfwMode | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  if (value === "blur" || value === "show" || value === "off") return value;
  return null;
}

function writeModeCookie(mode: NsfwMode) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(mode)};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
}

interface NsfwProviderProps {
  children: React.ReactNode;
  /** Whether LAN auto-enable is active (from library settings) */
  lanAutoEnable?: boolean;
}

export function NsfwProvider({ children, lanAutoEnable = false }: NsfwProviderProps) {
  const [mode, setModeState] = useState<NsfwMode>("off");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const cookie = readModeCookie();

    if (cookie !== null) {
      // User has an explicit preference stored — always respect it
      setModeState(cookie);
      setInitialized(true);
      return;
    }

    if (lanAutoEnable) {
      // No cookie set yet — check if we're on a LAN to auto-enable
      fetch("/api/client-info")
        .then((r) => r.json())
        .then((data: { isLan?: boolean }) => {
          if (data.isLan) {
            setModeState("show");
            writeModeCookie("show");
          }
        })
        .catch(() => {})
        .finally(() => setInitialized(true));
    } else {
      setInitialized(true);
    }
  }, [lanAutoEnable]);

  const setMode = useCallback((next: NsfwMode) => {
    setModeState(next);
    writeModeCookie(next);
  }, []);

  // Suppress render until mode is resolved to avoid flash
  if (!initialized) return null;

  return (
    <NsfwContext.Provider value={{ mode, setMode }}>
      {children}
    </NsfwContext.Provider>
  );
}

export function useNsfw() {
  return useContext(NsfwContext);
}
