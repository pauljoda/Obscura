import { getContext, setContext } from "svelte";
import type { MediaSurfaceSnapshot, MediaSurfaceSnapshotApi } from "$lib/media-surface/config";

const KEY = Symbol("page-snapshots");

interface ScrollSnapshot {
  top: number;
  left: number;
}

export interface AppPageSnapshot {
  scroll: ScrollSnapshot;
  surfaces: Record<string, MediaSurfaceSnapshot<{ id: string }>>;
}

interface PageSnapshotsOptions {
  captureScroll: () => ScrollSnapshot;
  restoreScroll: (snapshot: ScrollSnapshot) => void;
}

export class PageSnapshotsStore {
  private surfaces = new Map<string, MediaSurfaceSnapshotApi<{ id: string }>>();
  private pendingSurfaces = new Map<string, MediaSurfaceSnapshot<{ id: string }>>();

  constructor(private options: PageSnapshotsOptions) {}

  registerSurface<T extends { id: string }>(
    surfaceId: string,
    api: MediaSurfaceSnapshotApi<T>,
  ): () => void {
    const unsafeApi = api as unknown as MediaSurfaceSnapshotApi<{ id: string }>;
    this.surfaces.set(surfaceId, unsafeApi);

    const pending = this.pendingSurfaces.get(surfaceId);
    if (pending) {
      unsafeApi.restore(pending);
      this.pendingSurfaces.delete(surfaceId);
    }

    return () => {
      if (this.surfaces.get(surfaceId) === unsafeApi) this.surfaces.delete(surfaceId);
    };
  }

  capture(): AppPageSnapshot {
    return {
      scroll: this.options.captureScroll(),
      surfaces: Object.fromEntries(
        [...this.surfaces.entries()].map(([surfaceId, api]) => [surfaceId, api.capture()]),
      ),
    };
  }

  restore(snapshot: AppPageSnapshot) {
    this.pendingSurfaces = new Map(Object.entries(snapshot.surfaces));

    for (const [surfaceId, api] of this.surfaces.entries()) {
      const pending = this.pendingSurfaces.get(surfaceId);
      if (!pending) continue;
      api.restore(pending);
      this.pendingSurfaces.delete(surfaceId);
    }

    this.options.restoreScroll(snapshot.scroll);
  }
}

const FALLBACK = new PageSnapshotsStore({
  captureScroll: () => ({ top: 0, left: 0 }),
  restoreScroll: () => {},
});

export function providePageSnapshots(options: PageSnapshotsOptions) {
  const store = new PageSnapshotsStore(options);
  setContext(KEY, store);
  return store;
}

export function usePageSnapshots(): PageSnapshotsStore {
  const ctx = getContext<PageSnapshotsStore | undefined>(KEY);
  return ctx ?? FALLBACK;
}
