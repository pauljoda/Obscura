"use client";

import { useMemo } from "react";
import { useNsfw } from "../components/nsfw/nsfw-context";

interface NsfwAwareProvider {
  isNsfw: boolean;
  [key: string]: unknown;
}

/**
 * Filters a list of providers by NSFW classification based on the current mode.
 * When mode is "off" (SFW), only non-NSFW providers are returned.
 * When mode is "blur" or "show", all providers are returned.
 */
export function useNsfwAwareProviders<T extends NsfwAwareProvider>(
  providers: T[],
): T[] {
  const { mode } = useNsfw();
  return useMemo(
    () =>
      mode === "off"
        ? providers.filter((p) => !p.isNsfw)
        : providers,
    [providers, mode],
  );
}
