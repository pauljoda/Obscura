"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Calendar, Film, HardDrive, ImageOff, Loader2, Star } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { canUseInlineVideoPreview, isVideoImage } from "../../lib/image-media";
import type { ImageCardData } from "./image-card-data";

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

interface ImageEntityCardProps {
  image: ImageCardData;
  variant?: "grid" | "feed" | "compact";
  onSelect?: (href: string) => void;
}

export function ImageEntityCard({
  image,
  variant = "grid",
  onSelect,
}: ImageEntityCardProps) {
  if (variant === "feed") {
    return <ImageFeedCard image={image} onSelect={onSelect} />;
  }

  if (variant === "compact") {
    return <ImageCompactCard image={image} onSelect={onSelect} />;
  }

  return <ImageGridCard image={image} onSelect={onSelect} />;
}

function ImageGridCard({
  image,
  onSelect,
}: {
  image: ImageCardData;
  onSelect?: (href: string) => void;
}) {
  const [error, setError] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { rootMargin: "320px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const canPreview =
    canUseInlineVideoPreview({
      id: image.id,
      title: image.title,
      date: image.date ?? null,
      rating: image.rating ?? null,
      organized: false,
      width: image.width ?? null,
      height: image.height ?? null,
      format: image.format ?? null,
      isVideo: image.isVideo,
      fileSize: image.fileSize ?? null,
      thumbnailPath: image.thumbnail ?? null,
      previewPath: image.preview ?? null,
      fullPath: image.full ?? null,
      galleryId: null,
      sortOrder: 0,
      studioId: null,
      performers: [],
      tags: [],
      createdAt: "",
    }) && !previewFailed;

  const showVideoPreview = canPreview && inView && hovering && image.preview;

  const content = (
    <>
      {error || !image.thumbnail ? (
        <div className="flex items-center justify-center bg-surface-2 aspect-square">
          <ImageOff className="h-6 w-6 text-text-disabled" />
        </div>
      ) : showVideoPreview ? (
        <video
          src={image.preview}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          poster={image.thumbnail}
          onError={() => setPreviewFailed(true)}
          className="w-full object-cover rounded-sm group-hover:brightness-110 transition-all duration-fast"
        />
      ) : (
        <img
          src={image.thumbnail}
          alt={image.title}
          loading="lazy"
          decoding="async"
          onError={() => setError(true)}
          className="w-full object-cover rounded-sm group-hover:brightness-110 transition-all duration-fast"
        />
      )}

      {effectiveVideo(image) && (
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-sm bg-black/70 px-1.5 py-0.5 text-[0.65rem] text-white/90 backdrop-blur-sm">
          <Film className="h-3 w-3" />
        </div>
      )}
    </>
  );

  const className =
    "block w-full cursor-pointer group focus:outline-none focus:ring-2 focus:ring-accent-500 rounded-sm overflow-hidden";

  return (
    <div
      ref={containerRef}
      className="group relative mb-1 break-inside-avoid"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      {onSelect ? (
        <button type="button" onClick={() => onSelect(image.href)} className={className}>
          {content}
        </button>
      ) : (
        <Link href={image.href} className={className}>
          {content}
        </Link>
      )}
    </div>
  );
}

function ImageFeedCard({
  image,
  onSelect,
}: {
  image: ImageCardData;
  onSelect?: (href: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!effectiveVideo(image)) return;
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setActivated(Boolean(entry?.isIntersecting)),
      { rootMargin: "200px", threshold: 0.3 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [image]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (activated) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [activated]);

  const sizeStr = formatFileSize(image.fileSize);
  const videoSrc = activated ? image.full : image.preview;

  const media = (
    <>
      <div className="relative bg-surface-2">
        {error || !image.thumbnail ? (
          <div className="flex items-center justify-center bg-surface-2 aspect-video">
            <ImageOff className="h-8 w-8 text-text-disabled" />
          </div>
        ) : effectiveVideo(image) && videoSrc ? (
          <video
            ref={videoRef}
            key={activated ? "full" : "preview"}
            src={videoSrc}
            loop
            muted
            playsInline
            preload={activated ? "auto" : "none"}
            poster={image.thumbnail}
            onError={() => setError(true)}
            className="w-full object-contain bg-black"
            style={{ maxHeight: "70vh" }}
          />
        ) : (
          <img
            src={image.full ?? image.thumbnail}
            alt={image.title}
            loading="lazy"
            decoding="async"
            onError={() => setError(true)}
            className="w-full object-contain bg-black"
            style={{ maxHeight: "70vh" }}
          />
        )}

        {effectiveVideo(image) && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded-sm bg-black/70 px-2 py-1 text-xs text-white/90 backdrop-blur-sm">
            <Film className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        <h3 className="text-sm font-medium text-text-primary truncate">{image.title}</h3>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.72rem] text-text-muted">
          {image.date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {image.date}
            </span>
          )}
          {sizeStr && (
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {sizeStr}
            </span>
          )}
          {image.width && image.height && (
            <span className="font-mono text-text-disabled">
              {image.width}×{image.height}
            </span>
          )}
          {image.format && (
            <span className="font-mono text-text-disabled uppercase">{image.format}</span>
          )}
        </div>

        {image.rating != null && image.rating > 0 && (
          <div className="flex gap-0.5 text-accent-500">
            {Array.from({ length: Math.round(image.rating / 20) }).map((_, index) => (
              <Star key={index} className="h-3.5 w-3.5 fill-current" />
            ))}
          </div>
        )}

        {image.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {image.tags.map((tag) => (
              <span key={tag} className="tag-chip tag-chip-default text-[0.6rem]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );

  const className =
    "block w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-inset";

  return (
    <div
      ref={containerRef}
      className="surface-card-sharp overflow-hidden"
      style={{ overflowAnchor: "none" }}
    >
      {onSelect ? (
        <button type="button" onClick={() => onSelect(image.href)} className={className}>
          {media}
        </button>
      ) : (
        <Link href={image.href} className={className}>
          {media}
        </Link>
      )}
    </div>
  );
}

function ImageCompactCard({
  image,
  onSelect,
}: {
  image: ImageCardData;
  onSelect?: (href: string) => void;
}) {
  const content = (
    <>
      <div className="shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center h-8 w-12 rounded-sm">
        {image.thumbnail ? (
          <img src={image.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageOff className="h-3.5 w-3.5 text-text-disabled" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">{image.title}</div>
        <div className="text-[0.68rem] text-text-muted truncate">
          {image.galleryTitle || (image.width && image.height ? `${image.width}×${image.height}` : "Image")}
        </div>
      </div>
      <span className="shrink-0 tag-chip tag-chip-default text-[0.6rem]">image</span>
    </>
  );

  if (onSelect) {
    return (
      <button
        onClick={() => onSelect(image.href)}
        className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={image.href}
      className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
    >
      {content}
    </Link>
  );
}

function effectiveVideo(image: ImageCardData): boolean {
  return image.isVideo || Boolean(image.format && ["mp4", "mov", "webm", "mkv"].includes(image.format.toLowerCase()));
}
