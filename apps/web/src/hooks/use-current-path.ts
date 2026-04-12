"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * Returns the current page location as a string suitable for the `from`
 * query parameter (e.g. `/scenes?folder=abc`).
 */
export function useCurrentPath(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
