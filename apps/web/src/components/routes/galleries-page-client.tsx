"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
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
import type { GalleriesListPrefs } from "../../lib/galleries-list-prefs";
import {
  defaultGalleriesListPrefs,
  galleriesListPrefsToFetchParams,
  isDefaultGalleriesListPrefs,
  writeGalleriesListPrefsCookie,
  clearGalleriesListPrefsCookie,
} from "../../lib/galleries-list-prefs";

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
  initialListPrefs: GalleriesListPrefs;
}

export function GalleriesPageClient({
  initialGalleries,
  initialStudios,
  initialTags,
  initialTotal,
  initialListPrefs,
}: GalleriesPageClientProps) {
  const [viewMode, setViewMode] = useState<GalleryViewMode>(initialListPrefs.viewMode);
  const [sortBy, setSortBy] = useState<GallerySortOption>(initialListPrefs.sortBy);
  const [sortDir, setSortDir] = useState<SortDir>(initialListPrefs.sortDir);
  const [searchQuery, setSearchQuery] = useState(initialListPrefs.search);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(initialListPrefs.activeFilters);
  const [galleries, setGalleries] = useState(initialGalleries);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const prefs: GalleriesListPrefs = {
      viewMode,
      sortBy,
      sortDir,
      search: searchQuery,
      activeFilters,
    };
    if (isDefaultGalleriesListPrefs(prefs)) {
      clearGalleriesListPrefsCookie();
    } else {
      writeGalleriesListPrefsCookie(prefs);
    }
  }, [viewMode, sortBy, sortDir, searchQuery, activeFilters]);

  const handleClearFiltersAndSort = useCallback(() => {
    const d = defaultGalleriesListPrefs();
    setViewMode(d.viewMode);
    setSortBy(d.sortBy);
    setSortDir(d.sortDir);
    setSearchQuery(d.search);
    setActiveFilters(d.activeFilters);
  }, []);

  const buildParams = useCallback(() => {
    const base = galleriesListPrefsToFetchParams({
      viewMode,
      sortBy,
      sortDir,
      search: deferredSearchQuery,
      activeFilters,
    });
    const { limit: _lim, ...rest } = base;
    return { ...rest, search: deferredSearchQuery || undefined };
  }, [deferredSearchQuery, sortBy, sortDir, activeFilters, viewMode]);

  const galleryFilterBarFilters = useMemo(() => {
    return activeFilters.map((f) => {
      let v = f.value;
      if (f.type === "studio") {
        v = initialStudios.find((s) => s.id === f.value)?.name ?? f.value;
      } else if (f.type === "ratingMin") {
        v = `${f.value}★+`;
      } else if (f.type === "ratingMax") {
        v = `≤${f.value}★`;
      } else if (f.type === "organized") {
        v = f.value === "true" ? "Yes" : "No";
      } else if (f.type === "imageCountMin") {
        v = `${f.value}+ images`;
      }
      return { type: f.type, label: f.label, value: v };
    });
  }, [activeFilters, initialStudios]);

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
        setGalleries((prev) => {
          const existingIds = new Set(prev.map((g) => g.id));
          const newItems = result.galleries.filter((g) => !existingIds.has(g.id));
          return [...prev, ...newItems];
        });
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
    const exclusive = new Set([
      "studio",
      "type",
      "ratingMin",
      "ratingMax",
      "dateFrom",
      "dateTo",
      "imageCountMin",
      "organized",
    ]);
    setActiveFilters((prev) => {
      const existing = prev.findIndex((f) => f.type === type && f.value === value);
      if (existing >= 0) {
        return prev.filter((_, i) => i !== existing);
      }
      if (exclusive.has(type)) {
        return [...prev.filter((f) => f.type !== type), { label, type, value }];
      }
      return [...prev, { label, type, value }];
    });
  };

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
        activeFilters={galleryFilterBarFilters}
        onRemoveFilter={(i) => setActiveFilters((prev) => prev.filter((_, idx) => idx !== i))}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        availableStudios={initialStudios}
        availableTags={initialTags}
        onAddFilter={handleAddFilter}
        onClearFiltersAndSort={handleClearFiltersAndSort}
        canClearFiltersAndSort={
          !isDefaultGalleriesListPrefs({
            viewMode,
            sortBy,
            sortDir,
            search: searchQuery,
            activeFilters,
          })
        }
      />

      <GalleryGrid
        galleries={galleries}
        viewMode={viewMode}
        loading={loading}
        hasMore={galleries.length < total}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
      />
    </div>
  );
}
