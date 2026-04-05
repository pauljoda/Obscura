"use client";

import { useState, useCallback } from "react";
import { ArrowLeft, Images, LayoutGrid, LayoutList, Newspaper } from "lucide-react";
import Link from "next/link";
import { cn } from "@obscura/ui/lib/utils";
import { ImageGrid } from "../image-grid";
import { ImageFeed } from "../image-feed";
import { ImageLightbox } from "../image-lightbox";
import { GalleryMetadataPanel } from "../gallery-metadata-panel";
import { GalleryCard } from "../gallery-card";
import { GalleryListItem } from "../gallery-list-item";
import { fetchGalleryImages, toApiUrl, type TagItem } from "../../lib/api";
import type { GalleryDetailDto, GalleryListItemDto, ImageListItemDto } from "@obscura/contracts";

interface GalleryDetailClientProps {
  initialGallery: GalleryDetailDto;
  availableTags?: TagItem[];
}

export function GalleryDetailClient({ initialGallery, availableTags }: GalleryDetailClientProps) {
  const [gallery, setGallery] = useState(initialGallery);
  const [images, setImages] = useState<ImageListItemDto[]>(initialGallery.images);
  const [imageTotal] = useState(initialGallery.imageTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [subGalleryView, setSubGalleryView] = useState<"grid" | "list">("grid");
  const [imageViewMode, setImageViewMode] = useState<"grid" | "feed">("grid");

  const backHref = gallery.parentId ? `/galleries/${gallery.parentId}` : "/galleries";

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
      setImages((prev) => {
        const existingIds = new Set(prev.map((img) => img.id));
        const newItems = result.images.filter((img) => !existingIds.has(img.id));
        return [...prev, ...newItems];
      });
    } finally {
      setLoadingMore(false);
    }
  }, [gallery.id, images.length]);

  const handleChapterJump = useCallback((imageIndex: number) => {
    const idx = Math.max(0, imageIndex - 1);
    if (idx < images.length) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  }, [images.length]);

  // Build child gallery DTOs for card rendering
  const childGalleries: GalleryListItemDto[] = gallery.children.map((child) => ({
    id: child.id,
    title: child.title,
    galleryType: "folder" as const,
    coverImagePath: child.coverImagePath,
    previewImagePaths: child.previewImagePaths ?? [],
    imageCount: child.imageCount,
    rating: null,
    organized: false,
    date: null,
    studioId: null,
    studioName: null,
    performers: [],
    tags: [],
    parentId: gallery.id,
    createdAt: gallery.createdAt,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
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
            {gallery.children.length > 0 && ` \u00B7 ${gallery.children.length} sub-galleries`}
            {gallery.galleryType !== "virtual" && ` \u00B7 ${gallery.galleryType}`}
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Left: Sub-galleries + Images */}
        <div className="space-y-6">
          {/* Sub-galleries section (above images) */}
          {gallery.children.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-kicker">Sub-galleries</h3>
                <div className="flex items-center rounded-sm border border-border-subtle overflow-hidden">
                  <button
                    onClick={() => setSubGalleryView("grid")}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center transition-colors duration-fast",
                      subGalleryView === "grid"
                        ? "text-text-accent bg-accent-950"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-2"
                    )}
                  >
                    <LayoutGrid className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setSubGalleryView("list")}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center transition-colors duration-fast",
                      subGalleryView === "list"
                        ? "text-text-accent bg-accent-950"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-2"
                    )}
                  >
                    <LayoutList className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {subGalleryView === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {childGalleries.map((child) => (
                    <Link key={child.id} href={`/galleries/${child.id}`}>
                      <GalleryCard gallery={child} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {childGalleries.map((child) => (
                    <Link key={child.id} href={`/galleries/${child.id}`}>
                      <GalleryListItem gallery={child} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Images section */}
          {images.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                {gallery.children.length > 0 && (
                  <h3 className="text-kicker">Images</h3>
                )}
                <div className="flex items-center rounded-sm border border-border-subtle overflow-hidden ml-auto">
                  <button
                    onClick={() => setImageViewMode("grid")}
                    title="Grid view"
                    className={cn(
                      "flex h-6 w-6 items-center justify-center transition-colors duration-fast",
                      imageViewMode === "grid"
                        ? "text-text-accent bg-accent-950"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-2"
                    )}
                  >
                    <LayoutGrid className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setImageViewMode("feed")}
                    title="Feed view"
                    className={cn(
                      "flex h-6 w-6 items-center justify-center transition-colors duration-fast",
                      imageViewMode === "feed"
                        ? "text-text-accent bg-accent-950"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-2"
                    )}
                  >
                    <Newspaper className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {imageViewMode === "feed" ? (
                <ImageFeed
                  images={images}
                  onImageClick={handleImageClick}
                  hasMore={images.length < imageTotal}
                  onLoadMore={handleLoadMore}
                  loadingMore={loadingMore}
                />
              ) : (
                <ImageGrid
                  images={images}
                  onImageClick={handleImageClick}
                  hasMore={images.length < imageTotal}
                  onLoadMore={handleLoadMore}
                  loadingMore={loadingMore}
                />
              )}
            </div>
          )}

          {images.length === 0 && gallery.children.length === 0 && (
            <div className="surface-well flex flex-col items-center justify-center py-16 text-center">
              <Images className="h-8 w-8 text-text-disabled mb-2" />
              <p className="text-text-muted text-sm">This gallery is empty</p>
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
          availableTags={availableTags}
        />
      )}
    </div>
  );
}
