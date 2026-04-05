"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchResponseDto, EntityKind } from "@obscura/contracts";
import { fetchSearch } from "../lib/api";

interface UseSearchOptions {
  kinds?: EntityKind[];
  kind?: EntityKind;
  limit?: number;
  offset?: number;
  rating?: number;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  debounceMs?: number;
  enabled?: boolean;
}

export function useSearch(query: string, options: UseSearchOptions = {}) {
  const { debounceMs = 300, enabled = true, ...fetchParams } = options;
  const [data, setData] = useState<SearchResponseDto | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const execute = useCallback(
    async (q: string) => {
      if (!q.trim() || q.trim().length < 2) {
        setData(null);
        setLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      try {
        const result = await fetchSearch({ q, ...fetchParams }, controller.signal);
        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Search failed:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    // Stringify fetchParams to avoid object identity issues
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(fetchParams)]
  );

  useEffect(() => {
    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim() || query.trim().length < 2) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(() => {
      execute(query);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, execute, debounceMs, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    abortRef.current?.abort();
  }, []);

  return { data, loading, reset };
}
