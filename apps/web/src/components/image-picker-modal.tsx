"use client";

import { useEffect, useCallback } from "react";
import { X, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";

interface ImagePickerModalProps {
  images: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  title?: string;
}

export function ImagePickerModal({
  images,
  selectedIndex,
  onSelect,
  onClose,
  title = "Select Image",
}: ImagePickerModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onSelect(selectedIndex > 0 ? selectedIndex - 1 : images.length - 1);
      if (e.key === "ArrowRight") onSelect(selectedIndex < images.length - 1 ? selectedIndex + 1 : 0);
    },
    [onClose, onSelect, selectedIndex, images.length],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full max-h-[90vh] mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 surface-elevated rounded-t-lg">
          <span className="text-sm font-medium text-text-primary">
            {title} ({selectedIndex + 1} of {images.length})
          </span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Large preview with nav arrows */}
        <div className="flex-1 min-h-0 surface-panel flex items-center justify-center p-4 overflow-hidden relative">
          {images.length > 1 && (
            <>
              <button
                onClick={() => onSelect(selectedIndex > 0 ? selectedIndex - 1 : images.length - 1)}
                className="absolute left-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => onSelect(selectedIndex < images.length - 1 ? selectedIndex + 1 : 0)}
                className="absolute right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          <img
            src={images[selectedIndex] ?? images[0]}
            alt={`Image ${selectedIndex + 1}`}
            className="max-w-full max-h-[60vh] object-contain rounded"
          />
        </div>

        {/* Thumbnail grid */}
        <div className="surface-elevated rounded-b-lg p-4">
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
            {images.map((url, i) => (
              <button
                key={i}
                onClick={() => onSelect(i)}
                className={cn(
                  "aspect-[3/4] rounded overflow-hidden bg-surface-3 border-2 transition-all duration-fast",
                  i === selectedIndex
                    ? "border-border-accent ring-2 ring-accent-500/30"
                    : "border-transparent hover:border-border-subtle opacity-60 hover:opacity-100",
                )}
              >
                <img
                  src={url}
                  alt={`Option ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-3 gap-2">
            <button
              onClick={onClose}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded text-xs font-medium transition-all duration-fast",
                "bg-accent-950 text-text-accent border border-border-accent hover:bg-accent-900",
              )}
            >
              <Check className="h-3 w-3" />
              Use Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
