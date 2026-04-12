"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { buildHrefWithFrom } from "../../lib/back-navigation";
import type {
  CollectionItemDto,
  CollectionEntityType,
} from "@obscura/contracts";
import { getEntityHref } from "./collection-item-helpers";

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface PlaylistStartOptions {
  /** Start with shuffle enabled. */
  shuffle?: boolean;
  /** Slideshow auto-advance duration for images (seconds). 0 = no auto-advance. */
  slideshowDurationSeconds?: number;
}

export interface PlaylistContextValue {
  /** Whether a playlist is currently active. */
  isActive: boolean;
  /** The items in the current playlist queue (original order). */
  items: CollectionItemDto[];
  /** Items in current play order (shuffled when shuffle is on). */
  orderedItems: CollectionItemDto[];
  /** Current position within orderedItems. */
  currentPosition: number;
  /** The currently playing item. */
  currentItem: CollectionItemDto | null;
  /** Collection name for display. */
  collectionName: string;
  /** Collection ID for linking back. */
  collectionId: string | null;
  /** Shuffle state. */
  shuffle: boolean;
  /** Loop state. */
  loop: boolean;
  /** Slideshow auto-advance duration for images (seconds). 0 = no auto-advance. */
  slideshowDurationSeconds: number;
  /** Whether auto-advance is paused (user is browsing away from the current item page). */
  isOnCurrentPage: boolean;

  /** Start a new playlist from collection items. */
  startPlaylist: (
    items: CollectionItemDto[],
    collectionName: string,
    startIndex?: number,
    options?: PlaylistStartOptions,
  ) => void;
  /** Clear/dismiss the playlist. */
  clearPlaylist: () => void;
  /** Advance to the next item. */
  next: () => void;
  /** Go to the previous item. */
  previous: () => void;
  /** Jump to a specific position in the ordered queue. */
  jumpTo: (position: number) => void;
  /** Toggle shuffle. */
  toggleShuffle: () => void;
  /** Toggle loop. */
  toggleLoop: () => void;
  /**
   * Report that content has finished playing. Only advances the playlist
   * if the reported entity matches the current playlist item.
   */
  reportContentEnded: (
    entityType: CollectionEntityType,
    entityId: string,
  ) => void;
  /** Check whether the given entity is the current playlist item. */
  isPlaylistItem: (
    entityType: CollectionEntityType,
    entityId: string,
  ) => boolean;
}

const PlaylistContext = createContext<PlaylistContextValue | null>(null);

export function PlaylistProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [items, setItems] = useState<CollectionItemDto[]>([]);
  const [playOrder, setPlayOrder] = useState<number[]>([]);
  const [orderPosition, setOrderPosition] = useState(0);
  const [collectionName, setCollectionName] = useState("");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [loop, setLoop] = useState(false);
  const [slideshowDurationSeconds, setSlideshowDurationSeconds] = useState(0);

  const isActive = items.length > 0;
  const currentIndex = playOrder[orderPosition] ?? 0;
  const currentItem = items[currentIndex] ?? null;

  // Items in play order for display in the queue sheet
  const orderedItems = useMemo(
    () => playOrder.map((i) => items[i]).filter(Boolean),
    [items, playOrder],
  );

  // Check if user is currently viewing the page for the current item
  const isOnCurrentPage = currentItem
    ? pathname === getEntityHref(currentItem)
    : false;

  // Keep refs for values needed in callbacks to avoid stale closures
  const collectionIdRef = useRef(collectionId);
  collectionIdRef.current = collectionId;

  const navigateToItem = useCallback(
    (item: CollectionItemDto) => {
      const href = getEntityHref(item);
      const from = collectionIdRef.current
        ? `/collections/${collectionIdRef.current}`
        : undefined;
      router.push(from ? buildHrefWithFrom(href, from) : href);
    },
    [router],
  );

  const startPlaylist = useCallback(
    (
      newItems: CollectionItemDto[],
      name: string,
      startIndex = 0,
      options?: PlaylistStartOptions,
    ) => {
      setItems(newItems);
      setCollectionName(name);
      setCollectionId(newItems[0]?.collectionId ?? null);
      setLoop(false);
      setSlideshowDurationSeconds(options?.slideshowDurationSeconds ?? 0);

      let order: number[];
      let pos: number;

      if (options?.shuffle) {
        // Pre-calculate shuffled order, put the start item first
        const shuffled = fisherYatesShuffle(newItems.map((_, i) => i));
        const currentPos = shuffled.indexOf(startIndex);
        if (currentPos > 0) {
          [shuffled[0], shuffled[currentPos]] = [
            shuffled[currentPos],
            shuffled[0],
          ];
        }
        order = shuffled;
        pos = 0;
        setShuffle(true);
      } else {
        order = newItems.map((_, i) => i);
        pos = startIndex;
        setShuffle(false);
      }

      setPlayOrder(order);
      setOrderPosition(pos);

      const firstItem = newItems[order[pos]];
      if (firstItem) {
        navigateToItem(firstItem);
      }
    },
    [navigateToItem],
  );

  const clearPlaylist = useCallback(() => {
    setItems([]);
    setPlayOrder([]);
    setOrderPosition(0);
    setCollectionName("");
    setCollectionId(null);
    setSlideshowDurationSeconds(0);
  }, []);

  const next = useCallback(() => {
    if (items.length === 0) return;

    let newPos = orderPosition + 1;
    if (newPos >= playOrder.length) {
      if (loop) {
        newPos = 0;
      } else {
        const returnTo = collectionIdRef.current;
        clearPlaylist();
        if (returnTo) router.push(`/collections/${returnTo}`);
        return;
      }
    }

    const newIndex = playOrder[newPos];
    setOrderPosition(newPos);
    navigateToItem(items[newIndex]);
  }, [items, orderPosition, playOrder, loop, clearPlaylist, navigateToItem, router]);

  const previous = useCallback(() => {
    if (items.length === 0) return;

    let newPos = orderPosition - 1;
    if (newPos < 0) {
      if (loop) {
        newPos = playOrder.length - 1;
      } else {
        return;
      }
    }

    const newIndex = playOrder[newPos];
    setOrderPosition(newPos);
    navigateToItem(items[newIndex]);
  }, [items, orderPosition, playOrder, loop, navigateToItem]);

  const jumpTo = useCallback(
    (position: number) => {
      if (position < 0 || position >= playOrder.length) return;
      setOrderPosition(position);
      const itemIndex = playOrder[position];
      navigateToItem(items[itemIndex]);
    },
    [items, playOrder, navigateToItem],
  );

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const newShuffle = !prev;
      if (newShuffle) {
        const shuffled = fisherYatesShuffle(items.map((_, i) => i));
        // Put current item first in the new shuffled order
        const currentPos = shuffled.indexOf(currentIndex);
        if (currentPos > 0) {
          [shuffled[0], shuffled[currentPos]] = [
            shuffled[currentPos],
            shuffled[0],
          ];
        }
        setPlayOrder(shuffled);
        setOrderPosition(0);
      } else {
        const normalOrder = items.map((_, i) => i);
        setPlayOrder(normalOrder);
        setOrderPosition(currentIndex);
      }
      return newShuffle;
    });
  }, [items, currentIndex]);

  const toggleLoop = useCallback(() => setLoop((l) => !l), []);

  const reportContentEnded = useCallback(
    (entityType: CollectionEntityType, entityId: string) => {
      const cur = items[currentIndex];
      if (!cur) return;
      if (cur.entityType === entityType && cur.entityId === entityId) {
        next();
      }
    },
    [items, currentIndex, next],
  );

  const isPlaylistItem = useCallback(
    (entityType: CollectionEntityType, entityId: string): boolean => {
      if (!isActive || !currentItem) return false;
      return (
        currentItem.entityType === entityType &&
        currentItem.entityId === entityId
      );
    },
    [isActive, currentItem],
  );

  return (
    <PlaylistContext.Provider
      value={{
        isActive,
        items,
        orderedItems,
        currentPosition: orderPosition,
        currentItem,
        collectionName,
        collectionId,
        shuffle,
        loop,
        slideshowDurationSeconds,
        isOnCurrentPage,
        startPlaylist,
        clearPlaylist,
        next,
        previous,
        jumpTo,
        toggleShuffle,
        toggleLoop,
        reportContentEnded,
        isPlaylistItem,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylistContext() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) {
    throw new Error("usePlaylistContext must be used within PlaylistProvider");
  }
  return ctx;
}
