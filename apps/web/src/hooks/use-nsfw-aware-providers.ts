"use client";

import { useMemo } from "react";
import { useNsfw } from "../components/nsfw/nsfw-context";

/**
 * Filters a list of providers by NSFW classification based on the current mode.
 * When mode is "off" (SFW), only non-NSFW providers are returned.
 * When mode is "blur" or "show", all providers are returned.
 *
 * The generic parameter is constrained to objects with an `isNsfw`
 * boolean — we purposely do NOT extend a typed base interface with an
 * index signature, because that would widen every other field on the
 * caller's type to `unknown` and break downstream JSX / prop passing.
 */
export function useNsfwAwareProviders<T extends { isNsfw: boolean }>(
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
