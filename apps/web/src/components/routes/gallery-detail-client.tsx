"use client";

import { useState, useCallback } from "react";
import { ArrowLeft, Images } from "lucide-react";
import Link from "next/link";
import { ImageGrid } from "../image-grid";
import { ImageLightbox } from "../image-lightbox";
import { GalleryMetadataPanel } from "../gallery-metadata-panel";
import { fetchGalleryImages } from "../../lib/api";
import type { GalleryDetailDto, ImageListItemDto } from "@obscura/contracts";

interface GalleryDetailClientProps {
  initialGallery: GalleryDetailDto;
}

export function GalleryDetailClient({ initialGallery }: GalleryDetailClientProps) {
  const [gallery, setGallery] = useState(initialGallery);
  const [images, setImages] = useState<ImageListItemDto[]>(initialGallery.images);
  const [imageTotal] = useState(initialGallery.imageTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const handleGalleryUpdate = useCallback((patch: Partial<GalleryDetailDto>) => {
    setGallery((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleImageClick = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const result = await fetchGalleryImages(gallery.id, {
        limit: 60,
        offset: images.length,
      });
      setImages((prev) => [...prev, ...result.images]);
    } finally {
      setLoadingMore(false);
    }
  }, [gallery.id, images.length]);

  const handleChapterJump = useCallback((imageIndex: number) => {
    // Open lightbox at the chapter's image index (1-based to 0-based)
    const idx = Math.max(0, imageIndex - 1);
    if (idx < images.length) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  }, [images.length]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/galleries"
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2.5">
            <Images className="h-5 w-5 text-text-accent" />
            {gallery.title}
          </h1>
          <p className="text-text-muted text-[0.78rem] mt-0.5">
            {gallery.imageCount} images
            {gallery.galleryType !== "virtual" && ` \u00B7 ${gallery.galleryType}`}
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Left: Images + sub-galleries */}
        <div className="space-y-6">
          <ImageGrid
            images={images}
            onImageClick={handleImageClick}
            hasMore={images.length < imageTotal}
            onLoadMore={handleLoadMore}
            loadingMore={loadingMore}
          />

          {/* Sub-galleries */}
          {gallery.children.length > 0 && (
            <div>
              <h3 className="text-kicker mb-3">Sub-galleries</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {gallery.children.map((child) => (
                  <Link key={child.id} href={`/galleries/${child.id}`}>
                    <div className="surface-card-sharp p-3 hover:bg-surface-2 transition-colors">
                      <h4 className="text-[0.78rem] font-medium text-text-primary truncate">
                        {child.title}
                      </h4>
                      <span className="text-[0.65rem] text-text-muted flex items-center gap-1 mt-0.5">
                        <Images className="h-3 w-3" />
                        {child.imageCount} images
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Metadata panel */}
        <div className="lg:sticky lg:top-5 lg:self-start">
          <div className="surface-well p-4">
            <GalleryMetadataPanel
              gallery={gallery}
              onGalleryUpdate={handleGalleryUpdate}
              onChapterJump={handleChapterJump}
            />
          </div>
        </div>
      </div>

      {/* Image lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          chapters={gallery.chapters}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
