"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Mac: ⌘⇧Z — one-hand friendly; Windows/Linux: Ctrl+Shift+Z. Uses `code` so layout/locale stays reliable. */
function isModShiftZ(e: KeyboardEvent): boolean {
  if (!e.shiftKey || e.altKey) return false;
  if (!e.metaKey && !e.ctrlKey) return false;
  return e.code === "KeyZ" || e.key?.toLowerCase() === "z";
}

interface SearchContextValue {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
}

const SearchContext = createContext<SearchContextValue>({
  open: false,
  openPalette: () => {},
  closePalette: () => {},
});

export function useSearchPalette() {
  return useContext(SearchContext);
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);

  // Capture phase on window so we run before other handlers (e.g. video hotkeys) and can stop propagation.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isModShiftZ(e)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
        return;
      }
      if (e.key === "Escape" && openRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  return (
    <SearchContext.Provider value={{ open, openPalette, closePalette }}>
      {children}
    </SearchContext.Provider>
  );
}
