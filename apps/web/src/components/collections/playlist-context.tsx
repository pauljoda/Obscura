"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import type {
  CollectionItemDto,
  CollectionEntityType,
} from "@obscura/contracts";

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getEntityHref(item: CollectionItemDto): string {
  switch (item.entityType) {
    case "scene":
      return `/scenes/${item.entityId}`;
    case "gallery":
      return `/galleries/${item.entityId}`;
    case "image":
      return `/images/${item.entityId}`;
    case "audio-track":
      return `/audio/${item.entityId}`;
    default:
      return "#";
  }
}

export interface PlaylistContextValue {
  /** Whether a playlist is currently active. */
  isActive: boolean;
  /** The items in the current playlist queue. */
  items: CollectionItemDto[];
  /** Current position in the queue. */
  currentIndex: number;
  /** The currently playing item. */
  currentItem: CollectionItemDto | null;
  /** Collection name for display. */
  collectionName: string;
  /** Shuffle state. */
  shuffle: boolean;
  /** Loop state. */
  loop: boolean;
  /** Whether auto-advance is paused (user is browsing away from the current item page). */
  isOnCurrentPage: boolean;

  /** Start a new playlist from collection items. */
  startPlaylist: (
    items: CollectionItemDto[],
    collectionName: string,
    startIndex?: number,
  ) => void;
  /** Clear/dismiss the playlist. */
  clearPlaylist: () => void;
  /** Advance to the next item. Called by entity pages when content ends. */
  next: () => void;
  /** Go to the previous item. */
  previous: () => void;
  /** Jump to a specific index in the queue. */
  jumpTo: (index: number) => void;
  /** Toggle shuffle. */
  toggleShuffle: () => void;
  /** Toggle loop. */
  toggleLoop: () => void;
  /** Report that the current content has finished playing (video ended, image timer, etc.). */
  reportContentEnded: () => void;
}

const PlaylistContext = createContext<PlaylistContextValue | null>(null);

export function PlaylistProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [items, setItems] = useState<CollectionItemDto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [collectionName, setCollectionName] = useState("");
  const [shuffle, setShuffle] = useState(false);
  const [loop, setLoop] = useState(false);
  const [playOrder, setPlayOrder] = useState<number[]>([]);
  const [orderPosition, setOrderPosition] = useState(0);

  const isActive = items.length > 0;
  const currentItem = items[currentIndex] ?? null;

  // Check if user is currently viewing the page for the current item
  const isOnCurrentPage = currentItem
    ? pathname === getEntityHref(currentItem)
    : false;

  const navigateToItem = useCallback(
    (item: CollectionItemDto) => {
      router.push(getEntityHref(item));
    },
    [router],
  );

  const startPlaylist = useCallback(
    (
      newItems: CollectionItemDto[],
      name: string,
      startIndex = 0,
    ) => {
      setItems(newItems);
      setCollectionName(name);
      setCurrentIndex(startIndex);
      const order = newItems.map((_, i) => i);
      setPlayOrder(order);
      setOrderPosition(startIndex);
      setShuffle(false);
      setLoop(false);

      if (newItems[startIndex]) {
        navigateToItem(newItems[startIndex]);
      }
    },
    [navigateToItem],
  );

  const clearPlaylist = useCallback(() => {
    setItems([]);
    setCurrentIndex(0);
    setCollectionName("");
    setPlayOrder([]);
    setOrderPosition(0);
  }, []);

  const next = useCallback(() => {
    if (items.length === 0) return;

    let newPos = orderPosition + 1;
    if (newPos >= playOrder.length) {
      if (loop) {
        newPos = 0;
      } else {
        clearPlaylist();
        return;
      }
    }

    const newIndex = playOrder[newPos];
    setOrderPosition(newPos);
    setCurrentIndex(newIndex);
    navigateToItem(items[newIndex]);
  }, [items, orderPosition, playOrder, loop, clearPlaylist, navigateToItem]);

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
    setCurrentIndex(newIndex);
    navigateToItem(items[newIndex]);
  }, [items, orderPosition, playOrder, loop, navigateToItem]);

  const jumpTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length) return;
      setCurrentIndex(index);
      const pos = playOrder.indexOf(index);
      if (pos >= 0) setOrderPosition(pos);
      navigateToItem(items[index]);
    },
    [items, playOrder, navigateToItem],
  );

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const newShuffle = !prev;
      if (newShuffle) {
        const shuffled = fisherYatesShuffle(items.map((_, i) => i));
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

  const reportContentEnded = useCallback(() => {
    // Auto-advance to next when content ends
    next();
  }, [next]);

  return (
    <PlaylistContext.Provider
      value={{
        isActive,
        items,
        currentIndex,
        currentItem,
        collectionName,
        shuffle,
        loop,
        isOnCurrentPage,
        startPlaylist,
        clearPlaylist,
        next,
        previous,
        jumpTo,
        toggleShuffle,
        toggleLoop,
        reportContentEnded,
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
