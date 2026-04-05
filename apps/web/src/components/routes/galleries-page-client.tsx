"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { Images } from "lucide-react";
import { GalleryGrid } from "../gallery-grid";
import { ImageGrid } from "../image-grid";
import { ImageLightbox } from "../image-lightbox";
import { GalleryFilterBar } from "../gallery-filter-bar";
import type { GalleryViewMode, GallerySortOption, SortDir } from "../gallery-filter-bar";
import {
  fetchGalleries,
  fetchImages,
  type StudioItem,
  type TagItem,
} from "../../lib/api";
import type { GalleryListItemDto, ImageListItemDto } from "@obscura/contracts";

const PAGE_SIZE = 60;

interface ActiveFilter {
  label: string;
  type: string;
  value: string;
}

interface GalleriesPageClientProps {
  initialGalleries: GalleryListItemDto[];
  initialStudios: StudioItem[];
  initialTags: TagItem[];
  initialTotal: number;
}

export function GalleriesPageClient({
  initialGalleries,
  initialStudios,
  initialTags,
  initialTotal,
}: GalleriesPageClientProps) {
  const [viewMode, setViewMode] = useState<GalleryViewMode>("grid");
  const [sortBy, setSortBy] = useState<GallerySortOption>("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [galleries, setGalleries] = useState(initialGalleries);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Flat view state (all images)
  const [flatImages, setFlatImages] = useState<ImageListItemDto[]>([]);
  const [flatTotal, setFlatTotal] = useState(0);
  const [flatLoadingMore, setFlatLoadingMore] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const hydratedRef = useRef(false);
  const isFlat = viewMode === "flat";

  const buildParams = useCallback(() => {
    const tagFilters = activeFilters.filter((f) => f.type === "tag").map((f) => f.value);
    const studioFilter = activeFilters.find((f) => f.type === "studio")?.value;
    const typeFilter = activeFilters.find((f) => f.type === "type")?.value;

    return {
      search: deferredSearchQuery || undefined,
      sort: sortBy,
      order: sortDir as "asc" | "desc",
      tag: tagFilters.length > 0 ? tagFilters : undefined,
      studio: studioFilter,
      type: typeFilter,
    };
  }, [deferredSearchQuery, sortBy, sortDir, activeFilters]);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      if (isFlat) {
        const result = await fetchImages({
          search: deferredSearchQuery || undefined,
          sort: sortBy,
          order: sortDir as "asc" | "desc",
          tag: buildParams().tag,
          limit: 80,
        });
        startTransition(() => {
          setFlatImages(result.images);
          setFlatTotal(result.total);
          setTotal(result.total);
        });
      } else {
        const result = await fetchGalleries({
          ...buildParams(),
          root: viewMode === "browser" ? "all" : undefined,
          limit: viewMode === "browser" ? 2000 : PAGE_SIZE,
        });
        startTransition(() => {
          setGalleries(result.galleries);
          setTotal(result.total);
        });
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [buildParams, viewMode, isFlat, deferredSearchQuery, sortBy, sortDir]);

  const loadMore = useCallback(async () => {
    if (isFlat) {
      if (flatLoadingMore || flatImages.length >= flatTotal) return;
      setFlatLoadingMore(true);
      try {
        const result = await fetchImages({
          search: deferredSearchQuery || undefined,
          sort: sortBy,
          order: sortDir as "asc" | "desc",
          tag: buildParams().tag,
          limit: 80,
          offset: flatImages.length,
        });
        startTransition(() => {
          setFlatImages((prev) => {
            const existingIds = new Set(prev.map((img) => img.id));
            const newItems = result.images.filter((img) => !existingIds.has(img.id));
            return [...prev, ...newItems];
          });
        });
      } finally {
        setFlatLoadingMore(false);
      }
    } else {
      if (loadingMore || galleries.length >= total) return;
      setLoadingMore(true);
      try {
        const result = await fetchGalleries({
          ...buildParams(),
          limit: PAGE_SIZE,
          offset: galleries.length,
        });
        startTransition(() => {
          setGalleries((prev) => {
            const existingIds = new Set(prev.map((g) => g.id));
            const newItems = result.galleries.filter((g) => !existingIds.has(g.id));
            return [...prev, ...newItems];
          });
        });
      } finally {
        setLoadingMore(false);
      }
    }
  }, [buildParams, isFlat, galleries.length, total, loadingMore, flatImages.length, flatTotal, flatLoadingMore, deferredSearchQuery, sortBy, sortDir]);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    void loadData();
  }, [loadData]);

  const handleSortChange = (sort: GallerySortOption, dir?: SortDir) => {
    setSortBy(sort);
    if (dir) setSortDir(dir);
  };

  const handleAddFilter = (type: string, label: string, value: string) => {
    setActiveFilters((prev) => {
      const existing = prev.findIndex((f) => f.type === type && f.value === value);
      if (existing >= 0) {
        return prev.filter((_, i) => i !== existing);
      }
      if (type === "studio" || type === "type") {
        return [...prev.filter((f) => f.type !== type), { label, type, value }];
      }
      return [...prev, { label, type, value }];
    });
  };

  const hasMore = isFlat
    ? flatImages.length < flatTotal
    : galleries.length < total;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2.5">
          <Images className="h-5 w-5 text-text-accent" />
          Galleries
        </h1>
        <p className="text-text-muted text-[0.78rem] mt-1">
          {isFlat
            ? flatTotal > 0
              ? `${flatTotal} ${flatTotal === 1 ? "image" : "images"} across all galleries`
              : "No images found"
            : total > 0
              ? `${total} ${total === 1 ? "gallery" : "galleries"} in your library`
              : "Browse image galleries from your library"}
        </p>
      </div>

      <GalleryFilterBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        activeFilters={activeFilters}
        onRemoveFilter={(i) => setActiveFilters((prev) => prev.filter((_, idx) => idx !== i))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        availableTags={initialTags}
        onAddFilter={handleAddFilter}
      />

      {isFlat ? (
        <>
          <ImageGrid
            images={flatImages}
            onImageClick={(index) => {
              setLightboxIndex(index);
              setLightboxOpen(true);
            }}
            hasMore={flatImages.length < flatTotal}
            onLoadMore={loadMore}
            loadingMore={flatLoadingMore}
          />
          {lightboxOpen && (
            <ImageLightbox
              images={flatImages}
              initialIndex={lightboxIndex}
              onClose={() => setLightboxOpen(false)}
            />
          )}
        </>
      ) : (
        <GalleryGrid
          galleries={galleries}
          viewMode={viewMode}
          loading={loading}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      )}
    </div>
  );
}
