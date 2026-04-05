"use client";

import { X, Star } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { ImageListItemDto } from "@obscura/contracts";

interface ImageLightboxInfoProps {
  image: ImageListItemDto;
  open: boolean;
  onClose: () => void;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export function ImageLightboxInfo({ image, open, onClose }: ImageLightboxInfoProps) {
  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full w-72 bg-surface-2 border-l border-border-subtle z-[101]",
        "transition-transform duration-moderate",
        open ? "translate-x-0" : "translate-x-full"
      )}
      style={{ transitionTimingFunction: "var(--ease-mechanical)" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <span className="text-sm font-medium text-text-primary">Image Info</span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-sm text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-48px)]">
        <div>
          <div className="text-kicker mb-1">Filename</div>
          <p className="text-[0.78rem] text-text-primary break-all">{image.title}</p>
        </div>

        {(image.width || image.height) && (
          <div>
            <div className="text-kicker mb-1">Dimensions</div>
            <p className="text-mono-sm text-text-muted">
              {image.width} × {image.height}
            </p>
          </div>
        )}

        {image.fileSize && (
          <div>
            <div className="text-kicker mb-1">File Size</div>
            <p className="text-mono-sm text-text-muted">{formatFileSize(image.fileSize)}</p>
          </div>
        )}

        {image.format && (
          <div>
            <div className="text-kicker mb-1">Format</div>
            <p className="text-mono-sm text-text-muted">{image.format.toUpperCase()}</p>
          </div>
        )}

        {image.rating != null && (
          <div>
            <div className="text-kicker mb-1">Rating</div>
            <div className="flex gap-0.5">
              {[20, 40, 60, 80, 100].map((v) => (
                <Star
                  key={v}
                  className={cn(
                    "h-4 w-4",
                    image.rating != null && image.rating >= v
                      ? "text-accent-500 fill-accent-500"
                      : "text-text-disabled"
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {image.tags.length > 0 && (
          <div>
            <div className="text-kicker mb-1">Tags</div>
            <div className="flex flex-wrap gap-1">
              {image.tags.map((tag) => (
                <span key={tag.id} className="tag-chip tag-chip-default text-[0.55rem]">
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
