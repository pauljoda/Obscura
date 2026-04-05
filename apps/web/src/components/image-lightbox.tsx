"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Maximize,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Bookmark,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { toApiUrl } from "../lib/api";
import { isVideoImage } from "../lib/image-media";
import { ImageLightboxFilmstrip } from "./image-lightbox-filmstrip";
import { ImageLightboxInfo } from "./image-lightbox-info";
import type { ImageListItemDto, GalleryChapterDto } from "@obscura/contracts";

interface ImageLightboxProps {
  images: ImageListItemDto[];
  initialIndex: number;
  chapters?: GalleryChapterDto[];
  onClose: () => void;
  onImageUpdate?: (imageId: string, patch: Partial<ImageListItemDto>) => void;
  availableTags?: import("../lib/api").TagItem[];
}

export function ImageLightbox({
  images,
  initialIndex,
  chapters = [],
  onClose,
  onImageUpdate,
  availableTags,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowInterval] = useState(4000);
  const [showChapters, setShowChapters] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentImage = images[currentIndex];
  const fullUrl = currentImage ? toApiUrl(currentImage.fullPath) ?? null : null;

  // Reset zoom/pan on index change
  useEffect(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, [currentIndex]);

  // Preload adjacent images
  useEffect(() => {
    [-2, -1, 1, 2].forEach((offset) => {
      const idx = currentIndex + offset;
      if (idx >= 0 && idx < images.length) {
        const url = toApiUrl(images[idx].fullPath);
        if (url) {
          const img = new Image();
          img.src = url;
        }
      }
    });
  }, [currentIndex, images]);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Slideshow
  useEffect(() => {
    if (!slideshowActive) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % images.length);
    }, slideshowInterval);
    return () => clearInterval(timer);
  }, [slideshowActive, slideshowInterval, images.length]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          setCurrentIndex((i) => Math.max(0, i - 1));
          break;
        case "ArrowRight":
          setCurrentIndex((i) => Math.min(images.length - 1, i + 1));
          break;
        case " ":
          e.preventDefault();
          setSlideshowActive((v) => !v);
          break;
        case "i":
        case "I":
          setShowInfo((v) => !v);
          break;
        case "f":
        case "F":
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.();
          } else {
            document.exitFullscreen?.();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, images.length]);

  // Zoom helpers
  const clampZoom = useCallback((z: number) => Math.max(1, Math.min(8, z)), []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const newZoom = clampZoom(zoom * (1 - e.deltaY * 0.001));
      if (newZoom === 1) {
        setPanX(0);
        setPanY(0);
      }
      setZoom(newZoom);
    },
    [zoom, clampZoom]
  );

  const handleDoubleClick = useCallback(() => {
    if (zoom > 1) {
      setZoom(1);
      setPanX(0);
      setPanY(0);
    } else {
      setZoom(2.5);
    }
  }, [zoom]);

  // Pan handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (zoom <= 1) return;
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [zoom, panX, panY]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPanX(dragStartRef.current.panX + dx);
      setPanY(dragStartRef.current.panY + dy);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(images.length - 1, index)));
    },
    [images.length]
  );

  if (!currentImage) return null;

  const content = (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col select-none">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 bg-black/50 z-10">
        <div className="flex items-center gap-2 sm:gap-3 text-white/80 text-sm min-w-0">
          <span className="text-mono-sm flex-shrink-0">
            {currentIndex + 1} / {images.length}
          </span>
          <span className="text-white/50 truncate max-w-[120px] sm:max-w-[200px] hidden sm:inline">{currentImage.title}</span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {/* Slideshow toggle */}
          <button
            onClick={() => setSlideshowActive((v) => !v)}
            className={cn(
              "p-2 rounded-sm transition-colors",
              slideshowActive ? "text-accent-500" : "text-white/60 hover:text-white"
            )}
            title="Slideshow (Space)"
          >
            {slideshowActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          {/* Chapters dropdown */}
          {chapters.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowChapters((v) => !v)}
                className="p-2 rounded-sm text-white/60 hover:text-white transition-colors"
                title="Chapters"
              >
                <Bookmark className="h-4 w-4" />
              </button>
              {showChapters && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowChapters(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-surface-2 border border-border-subtle rounded-sm py-1 shadow-lg">
                    {chapters.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => {
                          goTo(ch.imageIndex - 1);
                          setShowChapters(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-[0.72rem] text-text-muted hover:text-text-primary hover:bg-surface-3 text-left"
                      >
                        <span className="text-text-disabled">#{ch.imageIndex}</span>
                        <span className="truncate">{ch.title}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Zoom controls — hidden on mobile */}
          <button
            onClick={() => setZoom(clampZoom(zoom - 0.5))}
            className="hidden sm:flex p-2 rounded-sm text-white/60 hover:text-white transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="hidden sm:inline text-mono-sm text-white/50 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(clampZoom(zoom + 0.5))}
            className="hidden sm:flex p-2 rounded-sm text-white/60 hover:text-white transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {/* Info toggle */}
          <button
            onClick={() => setShowInfo((v) => !v)}
            className={cn(
              "p-2 rounded-sm transition-colors",
              showInfo ? "text-accent-500" : "text-white/60 hover:text-white"
            )}
            title="Info (I)"
          >
            <Info className="h-4 w-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.();
              } else {
                document.exitFullscreen?.();
              }
            }}
            className="p-2 rounded-sm text-white/60 hover:text-white transition-colors"
            title="Fullscreen (F)"
          >
            <Maximize className="h-4 w-4" />
          </button>

          {/* Close — always last, prominent on mobile */}
          <button
            onClick={onClose}
            className="p-2 rounded-sm text-white/80 hover:text-white bg-white/10 sm:bg-transparent transition-colors"
            title="Close (Esc)"
          >
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 flex items-center justify-center overflow-hidden relative",
          zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
        )}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: "none" }}
      >
        {fullUrl && (
          isVideoImage(currentImage) ? (
            <video
              ref={videoRef}
              key={currentImage.id}
              src={fullUrl}
              autoPlay
              loop
              playsInline
              onClick={(e) => {
                e.stopPropagation();
                const vid = e.currentTarget;
                if (vid.paused) {
                  vid.play();
                } else {
                  vid.pause();
                }
              }}
              className="max-h-full max-w-full object-contain cursor-pointer"
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                willChange: "transform",
                transition: isDragging ? "none" : "transform 0.15s ease-out",
              }}
              draggable={false}
            />
          ) : (
            <img
              src={fullUrl}
              alt={currentImage.title}
              className="max-h-full max-w-full object-contain"
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                willChange: "transform",
                transition: isDragging ? "none" : "transform 0.15s ease-out",
              }}
              draggable={false}
            />
          )
        )}

        {/* Nav arrows */}
        {currentIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((i) => i - 1);
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {currentIndex < images.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((i) => i + 1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Filmstrip */}
      <div className="bg-black/80 border-t border-white/10">
        <ImageLightboxFilmstrip
          images={images}
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
        />
      </div>

      {/* Info panel */}
      <ImageLightboxInfo
        image={currentImage}
        open={showInfo}
        onClose={() => setShowInfo(false)}
        onImageUpdate={onImageUpdate}
        availableTags={availableTags}
      />
    </div>
  );

  return createPortal(content, document.body);
}
