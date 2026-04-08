"use client";

import { useRef, useCallback, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { useNsfw } from "./nsfw/nsfw-context";

const LONG_PRESS_MS = 5000;
const MOVE_CANCEL_PX = 14;

interface MobileMoreNavButtonProps {
  isMoreActive: boolean;
  sheetOpen: boolean;
  onToggleSheet: () => void;
}

export function MobileMoreNavButton({
  isMoreActive,
  sheetOpen,
  onToggleSheet,
}: MobileMoreNavButtonProps) {
  const { toggleShowOffMode } = useNsfw();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const clearLongPress = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      startRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        startRef.current = null;
        suppressClickRef.current = true;
        toggleShowOffMode();
        try {
          navigator.vibrate?.(20);
        } catch {
          /* ignore */
        }
      }, LONG_PRESS_MS);
    },
    [toggleShowOffMode],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const start = startRef.current;
      if (!start || timerRef.current === null) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
        clearLongPress();
      }
    },
    [clearLongPress],
  );

  const endPointer = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      clearLongPress();
    },
    [clearLongPress],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (suppressClickRef.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressClickRef.current = false;
        return;
      }
      onToggleSheet();
    },
    [onToggleSheet],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onLostPointerCapture={clearLongPress}
      className={cn(
        "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[0.65rem] transition-colors duration-fast",
        "cursor-pointer select-none touch-manipulation",
        isMoreActive
          ? "text-text-accent"
          : "text-text-disabled hover:text-text-muted",
      )}
      style={{ WebkitTouchCallout: "none" }}
      aria-label="More navigation. Press and hold five seconds to toggle SFW and full NSFW."
      aria-expanded={sheetOpen}
    >
      <MoreHorizontal className="h-5 w-5" />
      <span>More</span>
    </button>
  );
}
