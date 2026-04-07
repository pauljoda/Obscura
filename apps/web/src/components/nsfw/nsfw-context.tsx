"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

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

function writeModeCookie(mode: NsfwMode) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(mode)};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
}

interface NsfwProviderProps {
  children: React.ReactNode;
  /** Server-read cookie value — ensures SSR and client agree on first render */
  initialMode?: NsfwMode;
  /** Whether LAN auto-enable is active (from library settings) */
  lanAutoEnable?: boolean;
}

export function NsfwProvider({ children, initialMode = "off", lanAutoEnable = false }: NsfwProviderProps) {
  // Use the server-provided initial mode so SSR and client hydration match.
  // The server layout reads the cookie via next/headers and passes it here.
  const [mode, setModeState] = useState<NsfwMode>(initialMode);

  // Track whether we still need to do the async LAN check.
  // If a mode was already set (cookie existed), we're initialized.
  const hasCookie = initialMode !== "off" || !lanAutoEnable;
  const [initialized, setInitialized] = useState(hasCookie);
  const hasAutoEnabled = useRef(false);

  useEffect(() => {
    if (initialized || hasAutoEnabled.current) return;
    hasAutoEnabled.current = true;

    // No cookie yet and lanAutoEnable is on — check if we're on LAN
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
  }, [initialized]);

  const setMode = useCallback((next: NsfwMode) => {
    setModeState(next);
    writeModeCookie(next);
  }, []);

  // Only suppress render during the async LAN check (first-ever visit
  // with lanAutoEnable and no cookie). Users with an existing cookie
  // render immediately with no flash.
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
