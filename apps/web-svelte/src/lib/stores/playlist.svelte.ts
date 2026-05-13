import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import type {
  CollectionItemDto,
  CollectionEntityType,
  PlaylistSessionDto,
  PlaylistSessionWriteDto,
} from "@obscura/contracts";
import { fetchApi } from "$lib/v1/api/core-v1";

const KEY = Symbol("playlist");

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Resolve a collection item to its SvelteKit route.
 */
function getEntityHref(item: CollectionItemDto): string {
  switch (item.entityType) {
    case "video":
      return `/videos/${item.entityId}`;
    case "gallery":
      return `/galleries/${item.entityId}`;
    case "image":
      return `/images/${item.entityId}`;
    case "audio-track":
      return `/audio/tracks/${item.entityId}`;
    default:
      return `/`;
  }
}

function buildHrefWithFrom(href: string, from: string): string {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}from=${encodeURIComponent(from)}`;
}

export interface PlaylistStartOptions {
  shuffle?: boolean;
  slideshowDurationSeconds?: number;
}

export class PlaylistStore {
  items = $state<CollectionItemDto[]>([]);
  playOrder = $state<number[]>([]);
  orderPosition = $state(0);
  collectionName = $state("");
  collectionId = $state<string | null>(null);
  shuffle = $state(false);
  loop = $state(false);
  slideshowDurationSeconds = $state(0);
  hydrated = $state(false);

  readonly isActive = $derived(this.items.length > 0);
  readonly currentIndex = $derived(this.playOrder[this.orderPosition] ?? 0);
  readonly currentItem = $derived(this.items[this.currentIndex] ?? null);
  readonly orderedItems = $derived(
    this.playOrder.map((i) => this.items[i]).filter(Boolean) as CollectionItemDto[],
  );
  readonly isOnCurrentPage = $derived(
    this.currentItem ? page.url.pathname === getEntityHref(this.currentItem) : false,
  );
  private mutationVersion = 0;

  private navigateToItem(item: CollectionItemDto) {
    const href = getEntityHref(item);
    const from = this.collectionId ? `/collections/${this.collectionId}` : undefined;
    void goto(from ? buildHrefWithFrom(href, from) : href);
  }

  private applySession(session: PlaylistSessionDto | PlaylistSessionWriteDto) {
    this.items = session.items;
    this.playOrder = session.playOrder;
    this.orderPosition = session.orderPosition;
    this.collectionName = session.collectionName;
    this.collectionId = session.collectionId;
    this.shuffle = session.shuffle;
    this.loop = session.loop;
    this.slideshowDurationSeconds = session.slideshowDurationSeconds;
  }

  private toSessionPayload(): PlaylistSessionWriteDto {
    return {
      collectionId: this.collectionId,
      collectionName: this.collectionName,
      items: this.items,
      playOrder: this.playOrder,
      orderPosition: this.orderPosition,
      shuffle: this.shuffle,
      loop: this.loop,
      slideshowDurationSeconds: this.slideshowDurationSeconds,
    };
  }

  async hydrate() {
    if (this.hydrated) return;
    this.hydrated = true;
    const hydrateVersion = this.mutationVersion;
    try {
      const session = await fetchApi<PlaylistSessionDto | null>("/playlist-session");
      if (session && this.mutationVersion === hydrateVersion) {
        this.applySession(session);
      }
    } catch (err) {
      console.warn("Unable to hydrate playlist session", err);
    }
  }

  private persistSession() {
    if (!this.hydrated) return;
    const payload = this.toSessionPayload();
    void fetchApi<PlaylistSessionDto | null>("/playlist-session", {
      method: "PUT",
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.warn("Unable to persist playlist session", err);
    });
  }

  private deleteSession() {
    if (!this.hydrated) return;
    void fetchApi<{ ok: true }>("/playlist-session", { method: "DELETE" }).catch(
      (err) => {
        console.warn("Unable to clear playlist session", err);
      },
    );
  }

  startPlaylist(
    newItems: CollectionItemDto[],
    name: string,
    startIndex = 0,
    options?: PlaylistStartOptions,
  ) {
    this.mutationVersion += 1;
    this.items = newItems;
    this.collectionName = name;
    this.collectionId = newItems[0]?.collectionId ?? null;
    this.loop = false;
    this.slideshowDurationSeconds = options?.slideshowDurationSeconds ?? 0;

    let order: number[];
    let pos: number;

    if (options?.shuffle) {
      const shuffled = fisherYatesShuffle(newItems.map((_, i) => i));
      const currentPos = shuffled.indexOf(startIndex);
      if (currentPos > 0) {
        [shuffled[0], shuffled[currentPos]] = [shuffled[currentPos], shuffled[0]];
      }
      order = shuffled;
      pos = 0;
      this.shuffle = true;
    } else {
      order = newItems.map((_, i) => i);
      pos = startIndex;
      this.shuffle = false;
    }

    this.playOrder = order;
    this.orderPosition = pos;
    this.persistSession();

    const firstItem = newItems[order[pos]];
    if (firstItem) this.navigateToItem(firstItem);
  }

  clearPlaylist() {
    this.mutationVersion += 1;
    this.items = [];
    this.playOrder = [];
    this.orderPosition = 0;
    this.collectionName = "";
    this.collectionId = null;
    this.slideshowDurationSeconds = 0;
    this.shuffle = false;
    this.loop = false;
    this.deleteSession();
  }

  next() {
    if (this.items.length === 0) return;
    this.mutationVersion += 1;
    let newPos = this.orderPosition + 1;
    if (newPos >= this.playOrder.length) {
      if (this.loop) {
        newPos = 0;
      } else {
        const returnTo = this.collectionId;
        this.clearPlaylist();
        if (returnTo) void goto(`/collections/${returnTo}`);
        return;
      }
    }
    const newIndex = this.playOrder[newPos];
    this.orderPosition = newPos;
    this.persistSession();
    this.navigateToItem(this.items[newIndex]);
  }

  previous() {
    if (this.items.length === 0) return;
    this.mutationVersion += 1;
    let newPos = this.orderPosition - 1;
    if (newPos < 0) {
      if (this.loop) newPos = this.playOrder.length - 1;
      else return;
    }
    const newIndex = this.playOrder[newPos];
    this.orderPosition = newPos;
    this.persistSession();
    this.navigateToItem(this.items[newIndex]);
  }

  jumpTo(position: number) {
    if (position < 0 || position >= this.playOrder.length) return;
    this.mutationVersion += 1;
    this.orderPosition = position;
    const itemIndex = this.playOrder[position];
    this.persistSession();
    this.navigateToItem(this.items[itemIndex]);
  }

  toggleShuffle() {
    this.mutationVersion += 1;
    const newShuffle = !this.shuffle;
    if (newShuffle) {
      const shuffled = fisherYatesShuffle(this.items.map((_, i) => i));
      const currentPos = shuffled.indexOf(this.currentIndex);
      if (currentPos > 0) {
        [shuffled[0], shuffled[currentPos]] = [shuffled[currentPos], shuffled[0]];
      }
      this.playOrder = shuffled;
      this.orderPosition = 0;
    } else {
      this.playOrder = this.items.map((_, i) => i);
      this.orderPosition = this.currentIndex;
    }
    this.shuffle = newShuffle;
    this.persistSession();
  }

  toggleLoop() {
    this.mutationVersion += 1;
    this.loop = !this.loop;
    this.persistSession();
  }

  reportContentEnded(entityType: CollectionEntityType, entityId: string) {
    const cur = this.items[this.currentIndex];
    if (!cur) return;
    if (cur.entityType === entityType && cur.entityId === entityId) this.next();
  }

  isPlaylistItem(entityType: CollectionEntityType, entityId: string): boolean {
    if (!this.isActive || !this.currentItem) return false;
    return (
      this.currentItem.entityType === entityType &&
      this.currentItem.entityId === entityId
    );
  }
}

export function providePlaylist() {
  const store = new PlaylistStore();
  setContext(KEY, store);
  return store;
}

export function usePlaylist(): PlaylistStore {
  const ctx = getContext<PlaylistStore | undefined>(KEY);
  if (!ctx) throw new Error("usePlaylist must be used inside <PlaylistProvider>");
  return ctx;
}
