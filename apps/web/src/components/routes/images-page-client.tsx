"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { Image as ImageIcon } from "lucide-react";
import { ImageGrid } from "../image-grid";
import { ImageLightbox } from "../image-lightbox";
import { GalleryFilterBar } from "../gallery-filter-bar";
import type { GallerySortOption, SortDir } from "../gallery-filter-bar";
import { fetchImages, type TagItem } from "../../lib/api";
import type { ImageListItemDto } from "@obscura/contracts";

interface ActiveFilter {
  label: string;
  type: string;
  value: string;
}

interface ImagesPageClientProps {
  initialImages: ImageListItemDto[];
  initialTags: TagItem[];
  initialTotal: number;
}

export function ImagesPageClient({
  initialImages,
  initialTags,
  initialTotal,
}: ImagesPageClientProps) {
  const [sortBy, setSortBy] = useState<GallerySortOption>("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [images, setImages] = useState(initialImages);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const hydratedRef = useRef(false);

  const buildParams = useCallback(() => {
    const tagFilters = activeFilters.filter((f) => f.type === "tag").map((f) => f.value);
    const perfFilters = activeFilters.filter((f) => f.type === "performer").map((f) => f.value);

    return {
      search: deferredSearchQuery || undefined,
      sort: sortBy,
      order: sortDir as "asc" | "desc",
      tag: tagFilters.length > 0 ? tagFilters : undefined,
      performer: perfFilters.length > 0 ? perfFilters : undefined,
    };
  }, [deferredSearchQuery, sortBy, sortDir, activeFilters]);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchImages({ ...buildParams(), limit: 80 });
      startTransition(() => {
        setImages(result.images);
        setTotal(result.total);
      });
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    void loadImages();
  }, [loadImages]);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const result = await fetchImages({
        ...buildParams(),
        limit: 80,
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
  }, [buildParams, images.length]);

  const handleSortChange = (sort: GallerySortOption, dir?: SortDir) => {
    setSortBy(sort);
    if (dir) setSortDir(dir);
  };

  const handleAddFilter = (type: string, label: string, value: string) => {
    setActiveFilters((prev) => {
      const existing = prev.findIndex((f) => f.type === type && f.value === value);
      if (existing >= 0) return prev.filter((_, i) => i !== existing);
      return [...prev, { label, type, value }];
    });
  };

  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2.5">
          <ImageIcon className="h-5 w-5 text-text-accent" />
          Images
        </h1>
        <p className="text-text-muted text-[0.78rem] mt-1">
          {total > 0
            ? `${total} ${total === 1 ? "image" : "images"} across all galleries`
            : "Browse all images in your library"}
        </p>
      </div>

      <GalleryFilterBar
        viewMode="grid"
        onViewModeChange={() => {}}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        activeFilters={activeFilters}
        onRemoveFilter={(i) => setActiveFilters((prev) => prev.filter((_, idx) => idx !== i))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search images..."
        availableTags={initialTags}
        onAddFilter={handleAddFilter}
      />

      {loading ? (
        <div className="surface-well flex items-center justify-center py-20">
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
            Loading...
          </div>
        </div>
      ) : (
        <ImageGrid
          images={images}
          onImageClick={handleImageClick}
          hasMore={images.length < total}
          onLoadMore={handleLoadMore}
          loadingMore={loadingMore}
        />
      )}

      {lightboxOpen && (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
