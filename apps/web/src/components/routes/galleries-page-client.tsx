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
import { GalleryFilterBar } from "../gallery-filter-bar";
import type { GalleryViewMode, GallerySortOption, SortDir } from "../gallery-filter-bar";
import {
  fetchGalleries,
  type StudioItem,
  type TagItem,
} from "../../lib/api";
import type { GalleryListItemDto } from "@obscura/contracts";

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

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const hydratedRef = useRef(false);

  const buildParams = useCallback(() => {
    const tagFilters = activeFilters.filter((f) => f.type === "tag").map((f) => f.value);
    const perfFilters = activeFilters.filter((f) => f.type === "performer").map((f) => f.value);
    const studioFilter = activeFilters.find((f) => f.type === "studio")?.value;
    const typeFilter = activeFilters.find((f) => f.type === "type")?.value;

    return {
      search: deferredSearchQuery || undefined,
      sort: sortBy,
      order: sortDir as "asc" | "desc",
      tag: tagFilters.length > 0 ? tagFilters : undefined,
      performer: perfFilters.length > 0 ? perfFilters : undefined,
      studio: studioFilter,
      type: typeFilter,
    };
  }, [deferredSearchQuery, sortBy, sortDir, activeFilters]);

  const loadGalleries = useCallback(async () => {
    setLoading(true);

    try {
      const result = await fetchGalleries({
        ...buildParams(),
        limit: viewMode === "browser" ? 2000 : PAGE_SIZE,
      });

      startTransition(() => {
        setGalleries(result.galleries);
        setTotal(result.total);
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [buildParams, viewMode]);

  const loadMore = useCallback(async () => {
    if (loadingMore || galleries.length >= total) return;
    setLoadingMore(true);

    try {
      const result = await fetchGalleries({
        ...buildParams(),
        limit: PAGE_SIZE,
        offset: galleries.length,
      });

      startTransition(() => {
        setGalleries((prev) => [...prev, ...result.galleries]);
      });
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, galleries.length, total, loadingMore]);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    void loadGalleries();
  }, [loadGalleries]);

  const handleSortChange = (sort: GallerySortOption, dir?: SortDir) => {
    setSortBy(sort);
    if (dir) setSortDir(dir);
  };

  const handleAddFilter = (type: string, label: string, value: string) => {
    setActiveFilters((prev) => {
      // Toggle: remove if already exists
      const existing = prev.findIndex((f) => f.type === type && f.value === value);
      if (existing >= 0) {
        return prev.filter((_, i) => i !== existing);
      }
      // For single-value types, replace
      if (type === "studio" || type === "type") {
        return [...prev.filter((f) => f.type !== type), { label, type, value }];
      }
      return [...prev, { label, type, value }];
    });
  };

  const hasMore = galleries.length < total;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2.5">
          <Images className="h-5 w-5 text-text-accent" />
          Galleries
        </h1>
        <p className="text-text-muted text-[0.78rem] mt-1">
          {total > 0
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
        availableStudios={initialStudios}
        availableTags={initialTags}
        onAddFilter={handleAddFilter}
      />

      <GalleryGrid
        galleries={galleries}
        viewMode={viewMode}
        loading={loading}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
      />
    </div>
  );
}
