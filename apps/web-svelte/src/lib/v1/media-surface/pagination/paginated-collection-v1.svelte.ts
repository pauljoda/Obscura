/**
 * Headless rune store for paginated entity streams. Owns items / total /
 * loading / error / loadKey / hasMore. The fetcher is injected and is
 * the only piece that varies per surface. SSR hydrate, AbortController-
 * based race safety, and reset/dispose are handled here so each list
 * page does not have to reimplement them.
 *
 * Pages typically do not call this directly — MediaSurface composes it
 * around its toolbar and body components. It is exposed so detail-page
 * tabs can run multiple independent collections side by side.
 */

import { mergeUniquePage } from "./load-more-v1";

export interface PageHydrate<T> {
  items: T[];
  total: number;
  loadedStart: number;
}

export interface PaginatedCollectionOptions<T extends { id: string }> {
  pageSize: number;
  fetcher: (args: {
    offset: number;
    limit: number;
    signal: AbortSignal;
  }) => Promise<{ items: T[]; total: number }>;
  initial?: PageHydrate<T>;
  getKey?: (item: T) => string;
}

export interface PaginatedCollection<T extends { id: string }> {
  readonly items: T[];
  readonly total: number;
  readonly loadedStart: number;
  readonly loading: boolean;
  readonly error: string | null;
  readonly hasMore: boolean;
  /** Cursor used by InfiniteLoadTrigger to dedupe loads. Strictly increases on successful append. */
  readonly loadKey: number;
  loadMore(): Promise<void>;
  /**
   * Replace items+total+loadedStart, e.g. when SvelteKit's load function
   * re-runs after a filter change. No-ops if the incoming payload's
   * (page,total,first-id-list) signature matches the last hydrate.
   * Aborts any in-flight loadMore.
   */
  hydrate(next: PageHydrate<T>): void;
  /** Empty the collection and abort in-flight requests. */
  reset(): void;
  /** Abort in-flight requests; call from $effect cleanup on unmount. */
  dispose(): void;
  /** Capture the currently loaded window for SvelteKit history snapshots. */
  captureSnapshot(): PageHydrate<T>;
  /** Restore a previously captured loaded window. */
  restoreSnapshot(snapshot: PageHydrate<T>): void;
}

function signatureOf<T extends { id: string }>(p: PageHydrate<T>): string {
  return `${p.loadedStart}:${p.total}:${p.items.map((x) => x.id).join("|")}`;
}

export function createPaginatedCollection<T extends { id: string }>(
  opts: PaginatedCollectionOptions<T>,
): PaginatedCollection<T> {
  const initial = opts.initial ?? { items: [], total: 0, loadedStart: 0 };
  let lastHydrateSignature = opts.initial ? signatureOf(initial) : "";

  // Use $state.raw — items are large arrays we replace whole, never
  // mutate in place. Same as the per-page pattern used today.
  let items = $state.raw<T[]>(initial.items);
  let total = $state(initial.total);
  let loadedStart = $state(initial.loadedStart);
  let loading = $state(false);
  let error = $state<string | null>(null);

  /**
   * Generation token. Each loadMore captures the current value; on
   * resolve, if generation has moved on (because hydrate/reset/dispose
   * was called, or a newer loadMore started), the result is dropped.
   * The matching AbortController also signals the in-flight fetch.
   */
  let generation = 0;
  let inflightAbort: AbortController | null = null;

  function abortInflight() {
    if (inflightAbort) {
      inflightAbort.abort();
      inflightAbort = null;
    }
  }

  async function loadMore(): Promise<void> {
    if (loading) return;
    if (!(items.length + loadedStart < total) && total !== 0) {
      // No more to load and we have a known total. Note: total === 0 is
      // ambiguous — could be empty list or unhydrated — fall through and
      // let the fetcher decide.
      if (total !== 0) return;
    }
    if (items.length >= total && total > 0) return;

    const myGen = ++generation;
    abortInflight();
    const controller = new AbortController();
    inflightAbort = controller;

    loading = true;
    error = null;
    const offset = loadedStart + items.length;

    try {
      const result = await opts.fetcher({
        offset,
        limit: opts.pageSize,
        signal: controller.signal,
      });
      // Drop stale resolutions: hydrate/reset/dispose or a newer
      // loadMore moved on past our generation.
      if (myGen !== generation) return;
      const merged = mergeUniquePage({
        current: items,
        incoming: result.items,
        loadedStart,
        total: result.total,
      });
      items = merged.items;
      total = merged.total;
    } catch (err) {
      if (myGen !== generation) return;
      // AbortError is the expected outcome of cancellation; don't surface.
      if (controller.signal.aborted) return;
      error = err instanceof Error ? err.message : String(err);
    } finally {
      if (myGen === generation) {
        loading = false;
        if (inflightAbort === controller) inflightAbort = null;
      }
    }
  }

  function hydrate(next: PageHydrate<T>): void {
    const sig = signatureOf(next);
    if (sig === lastHydrateSignature) return;
    lastHydrateSignature = sig;
    generation++;
    abortInflight();
    items = next.items;
    total = next.total;
    loadedStart = next.loadedStart;
    loading = false;
    error = null;
  }

  function reset(): void {
    generation++;
    abortInflight();
    items = [];
    total = 0;
    loadedStart = 0;
    loading = false;
    error = null;
    lastHydrateSignature = "";
  }

  function dispose(): void {
    generation++;
    abortInflight();
  }

  function captureSnapshot(): PageHydrate<T> {
    return {
      items,
      total,
      loadedStart,
    };
  }

  function restoreSnapshot(snapshot: PageHydrate<T>): void {
    generation++;
    abortInflight();
    items = snapshot.items;
    total = snapshot.total;
    loadedStart = snapshot.loadedStart;
    loading = false;
    error = null;
    lastHydrateSignature = signatureOf(snapshot);
  }

  return {
    get items() {
      return items;
    },
    get total() {
      return total;
    },
    get loadedStart() {
      return loadedStart;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get hasMore() {
      return loadedStart + items.length < total;
    },
    get loadKey() {
      return loadedStart + items.length;
    },
    loadMore,
    hydrate,
    reset,
    dispose,
    captureSnapshot,
    restoreSnapshot,
  };
}
