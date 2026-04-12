"use client";

import { useState, useCallback, useMemo } from "react";
import type { CollectionItemDto } from "@obscura/contracts";

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface PlaylistState {
  items: CollectionItemDto[];
  currentIndex: number;
  isPlaying: boolean;
  shuffle: boolean;
  loop: boolean;
  /** The effective play order (may be shuffled). */
  playOrder: number[];
  /** Position within the play order. */
  orderPosition: number;
}

export interface PlaylistActions {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  toggleShuffle: () => void;
  toggleLoop: () => void;
  setItems: (items: CollectionItemDto[]) => void;
  currentItem: CollectionItemDto | null;
  hasNext: boolean;
  hasPrevious: boolean;
}

export function usePlaylist(
  initialItems: CollectionItemDto[],
): PlaylistState & PlaylistActions {
  const [items, setItemsRaw] = useState(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [loop, setLoop] = useState(false);
  const [playOrder, setPlayOrder] = useState<number[]>(() =>
    initialItems.map((_, i) => i),
  );
  const [orderPosition, setOrderPosition] = useState(0);

  const currentItem = items[currentIndex] ?? null;

  const hasNext = useMemo(() => {
    if (loop) return items.length > 0;
    return orderPosition < playOrder.length - 1;
  }, [loop, orderPosition, playOrder.length, items.length]);

  const hasPrevious = useMemo(() => {
    if (loop) return items.length > 0;
    return orderPosition > 0;
  }, [loop, orderPosition, items.length]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(
    () => setIsPlaying((p) => !p),
    [],
  );

  const next = useCallback(() => {
    if (items.length === 0) return;

    let newPos = orderPosition + 1;
    if (newPos >= playOrder.length) {
      if (loop) {
        newPos = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    setOrderPosition(newPos);
    setCurrentIndex(playOrder[newPos]);
    setIsPlaying(true);
  }, [items.length, orderPosition, playOrder, loop]);

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

    setOrderPosition(newPos);
    setCurrentIndex(playOrder[newPos]);
    setIsPlaying(true);
  }, [items.length, orderPosition, playOrder, loop]);

  const jumpTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length) return;
      setCurrentIndex(index);
      const pos = playOrder.indexOf(index);
      if (pos >= 0) setOrderPosition(pos);
      setIsPlaying(true);
    },
    [items.length, playOrder],
  );

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const newShuffle = !prev;
      if (newShuffle) {
        const shuffled = fisherYatesShuffle(
          items.map((_, i) => i),
        );
        // Move current index to front
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

  const setItems = useCallback(
    (newItems: CollectionItemDto[]) => {
      setItemsRaw(newItems);
      const order = shuffle
        ? fisherYatesShuffle(newItems.map((_, i) => i))
        : newItems.map((_, i) => i);
      setPlayOrder(order);
      setOrderPosition(0);
      setCurrentIndex(order[0] ?? 0);
    },
    [shuffle],
  );

  return {
    items,
    currentIndex,
    isPlaying,
    shuffle,
    loop,
    playOrder,
    orderPosition,
    play,
    pause,
    togglePlay,
    next,
    previous,
    jumpTo,
    toggleShuffle,
    toggleLoop,
    setItems,
    currentItem,
    hasNext,
    hasPrevious,
  };
}
