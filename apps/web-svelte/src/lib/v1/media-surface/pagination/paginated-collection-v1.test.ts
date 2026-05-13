import { describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { createPaginatedCollection } from "./paginated-collection-v1.svelte";

interface TestItem {
  id: string;
  title: string;
}

function makeItems(start: number, count: number): TestItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${start + i}`,
    title: `Item ${start + i}`,
  }));
}

describe("createPaginatedCollection", () => {
  it("exposes hydrated initial state", () => {
    const fetcher = vi.fn();
    const coll = createPaginatedCollection<TestItem>({
      pageSize: 10,
      fetcher,
      initial: { items: makeItems(0, 5), total: 50, loadedStart: 0 },
    });

    expect(coll.items).toHaveLength(5);
    expect(coll.total).toBe(50);
    expect(coll.loadedStart).toBe(0);
    expect(coll.hasMore).toBe(true);
    expect(coll.loadKey).toBe(5);
    expect(coll.loading).toBe(false);
    expect(coll.error).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loadMore appends results and advances loadKey", async () => {
    const fetcher = vi.fn(async ({ offset, limit }: { offset: number; limit: number }) => {
      return { items: makeItems(offset, limit), total: 50 };
    });
    const coll = createPaginatedCollection<TestItem>({
      pageSize: 10,
      fetcher,
      initial: { items: makeItems(0, 10), total: 50, loadedStart: 0 },
    });

    await coll.loadMore();
    flushSync();

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 10, limit: 10 }),
    );
    expect(coll.items).toHaveLength(20);
    expect(coll.loadKey).toBe(20);
    expect(coll.hasMore).toBe(true);
  });

  it("hydrate no-ops when signature matches the previous payload", async () => {
    const fetcher = vi.fn();
    const coll = createPaginatedCollection<TestItem>({
      pageSize: 10,
      fetcher,
      initial: { items: makeItems(0, 3), total: 3, loadedStart: 0 },
    });
    const beforeRef = coll.items;

    coll.hydrate({ items: makeItems(0, 3), total: 3, loadedStart: 0 });

    expect(coll.items).toBe(beforeRef);
  });

  it("hydrate replaces state when signature differs", () => {
    const fetcher = vi.fn();
    const coll = createPaginatedCollection<TestItem>({
      pageSize: 10,
      fetcher,
      initial: { items: makeItems(0, 5), total: 50, loadedStart: 0 },
    });

    coll.hydrate({ items: makeItems(20, 5), total: 50, loadedStart: 20 });

    expect(coll.items.map((i) => i.id)).toEqual([
      "item-20",
      "item-21",
      "item-22",
      "item-23",
      "item-24",
    ]);
    expect(coll.loadedStart).toBe(20);
    expect(coll.loadKey).toBe(25);
  });

  it("duplicate-only response collapses total and stops hasMore", async () => {
    const fetcher = vi.fn(async () => ({
      // The server hands back the same first page we already have.
      items: makeItems(0, 5),
      total: 100,
    }));
    const coll = createPaginatedCollection<TestItem>({
      pageSize: 10,
      fetcher,
      initial: { items: makeItems(0, 5), total: 100, loadedStart: 0 },
    });

    await coll.loadMore();
    flushSync();

    expect(coll.items).toHaveLength(5);
    expect(coll.total).toBe(5);
    expect(coll.hasMore).toBe(false);
  });

  it("errored fetch sets error, leaves loadKey unchanged, retry succeeds", async () => {
    let callCount = 0;
    const fetcher = vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error("network blew up");
      return { items: makeItems(10, 10), total: 50 };
    });
    const coll = createPaginatedCollection<TestItem>({
      pageSize: 10,
      fetcher,
      initial: { items: makeItems(0, 10), total: 50, loadedStart: 0 },
    });

    await coll.loadMore();
    flushSync();

    expect(coll.error).toBe("network blew up");
    expect(coll.loadKey).toBe(10);
    expect(coll.loading).toBe(false);

    await coll.loadMore();
    flushSync();

    expect(coll.error).toBeNull();
    expect(coll.items).toHaveLength(20);
    expect(coll.loadKey).toBe(20);
  });

  it("aborts the older inflight request when loadMore is called twice", async () => {
    let resolveFirst!: (page: { items: TestItem[]; total: number }) => void;
    let firstSignal: AbortSignal | undefined;
    let secondCalls = 0;

    const fetcher = vi.fn(
      async ({ signal, offset, limit }: { signal: AbortSignal; offset: number; limit: number }) => {
        if (!firstSignal) {
          firstSignal = signal;
          return new Promise<{ items: TestItem[]; total: number }>((resolve) => {
            resolveFirst = resolve;
          });
        }
        secondCalls++;
        return { items: makeItems(offset, limit), total: 50 };
      },
    );

    const coll = createPaginatedCollection<TestItem>({
      pageSize: 10,
      fetcher,
      initial: { items: makeItems(0, 10), total: 50, loadedStart: 0 },
    });

    // The store guards against concurrent loadMore via `loading`, so
    // the path the abort closes is hydrate-mid-fetch — see the next
    // test. This case verifies the symmetric pattern: forcibly bumping
    // generation by hydrate then loading again should not let the old
    // fetch's resolution stomp the new state.
    const first = coll.loadMore();
    expect(coll.loading).toBe(true);

    // Hydrate to a different page mid-fetch — this should abort the
    // first fetch and bump generation.
    coll.hydrate({ items: makeItems(20, 5), total: 50, loadedStart: 20 });
    expect(firstSignal?.aborted).toBe(true);
    expect(coll.loading).toBe(false);

    // Resolve the abandoned fetch — its result must be discarded.
    resolveFirst({ items: makeItems(10, 10), total: 50 });
    await first;
    flushSync();

    expect(coll.items.map((i) => i.id)).toEqual([
      "item-20",
      "item-21",
      "item-22",
      "item-23",
      "item-24",
    ]);
    expect(secondCalls).toBe(0);
  });

  it("dispose aborts in-flight and prevents stale resolutions", async () => {
    let resolveFetch!: (page: { items: TestItem[]; total: number }) => void;
    let capturedSignal: AbortSignal | undefined;
    const fetcher = vi.fn(
      async ({ signal }: { signal: AbortSignal }) => {
        capturedSignal = signal;
        return new Promise<{ items: TestItem[]; total: number }>((resolve) => {
          resolveFetch = resolve;
        });
      },
    );

    const coll = createPaginatedCollection<TestItem>({
      pageSize: 10,
      fetcher,
      initial: { items: makeItems(0, 10), total: 50, loadedStart: 0 },
    });

    const inflight = coll.loadMore();
    coll.dispose();
    expect(capturedSignal?.aborted).toBe(true);

    resolveFetch({ items: makeItems(10, 10), total: 50 });
    await inflight;
    flushSync();

    // dispose did not change items, and the late resolve was dropped.
    expect(coll.items).toHaveLength(10);
  });

  it("reset clears state and aborts in-flight", async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetcher = vi.fn(
      async ({ signal }: { signal: AbortSignal }) =>
        new Promise<{ items: TestItem[]; total: number }>(() => {
          capturedSignal = signal;
        }),
    );

    const coll = createPaginatedCollection<TestItem>({
      pageSize: 10,
      fetcher,
      initial: { items: makeItems(0, 5), total: 50, loadedStart: 0 },
    });
    void coll.loadMore();
    coll.reset();

    expect(capturedSignal?.aborted).toBe(true);
    expect(coll.items).toEqual([]);
    expect(coll.total).toBe(0);
    expect(coll.loadedStart).toBe(0);
    expect(coll.loading).toBe(false);
    expect(coll.error).toBeNull();
  });

  it("captures and restores loaded collection state for history snapshots", async () => {
    const fetcher = vi.fn(async ({ offset, limit }: { offset: number; limit: number }) => ({
      items: makeItems(offset, limit),
      total: 50,
    }));
    const coll = createPaginatedCollection<TestItem>({
      pageSize: 10,
      fetcher,
      initial: { items: makeItems(0, 10), total: 50, loadedStart: 0 },
    });

    await coll.loadMore();
    flushSync();
    const snapshot = coll.captureSnapshot();

    coll.hydrate({ items: makeItems(40, 5), total: 50, loadedStart: 40 });
    coll.restoreSnapshot(snapshot);

    expect(coll.items.map((item) => item.id)).toEqual(
      makeItems(0, 20).map((item) => item.id),
    );
    expect(coll.total).toBe(50);
    expect(coll.loadedStart).toBe(0);
    expect(coll.loadKey).toBe(20);
  });

  it("does not refire while loading", async () => {
    let resolveFetch!: (page: { items: TestItem[]; total: number }) => void;
    const fetcher = vi.fn(
      async () =>
        new Promise<{ items: TestItem[]; total: number }>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const coll = createPaginatedCollection<TestItem>({
      pageSize: 10,
      fetcher,
      initial: { items: makeItems(0, 10), total: 50, loadedStart: 0 },
    });

    const first = coll.loadMore();
    expect(coll.loading).toBe(true);
    await coll.loadMore(); // should be a no-op
    expect(fetcher).toHaveBeenCalledOnce();

    resolveFetch({ items: makeItems(10, 10), total: 50 });
    await first;
  });
});
