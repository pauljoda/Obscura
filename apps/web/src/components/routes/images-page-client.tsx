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
import { useSearchParams, useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  Search,
  ArrowUpDown,
  ChevronDown,
  Check,
  SlidersHorizontal,
  LayoutGrid,
  Newspaper,
  X,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { ImageGrid } from "../image-grid";
import { ImageFeed } from "../image-feed";
import { ImageLightbox } from "../image-lightbox";
import { fetchImages, type TagItem } from "../../lib/api";
import type { ImageListItemDto } from "@obscura/contracts";
import { NsfwTagLabel, tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";

export type ImageViewMode = "grid" | "feed";

type ImageSortOption = "recent" | "title" | "date" | "rating";
type SortDir = "asc" | "desc";

const defaultSortDir: Record<ImageSortOption, SortDir> = {
  recent: "desc",
  title: "asc",
  date: "desc",
  rating: "desc",
};

const sortOptions: { value: ImageSortOption; label: string }[] = [
  { value: "recent", label: "Recently Added" },
  { value: "date", label: "Date" },
  { value: "title", label: "Title A-Z" },
  { value: "rating", label: "Rating" },
];

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
  const { mode: nsfwMode } = useNsfw();
  const imagePageTagsForFilters = useMemo(
    () => tagsVisibleInNsfwMode(initialTags, nsfwMode),
    [initialTags, nsfwMode],
  );
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialView = (searchParams.get("view") === "feed" ? "feed" : "grid") as ImageViewMode;
  const [viewMode, setViewMode] = useState<ImageViewMode>(initialView);

  const handleViewModeChange = useCallback(
    (mode: ImageViewMode) => {
      setViewMode(mode);
      router.replace(`/images?view=${mode}`, { scroll: false });
    },
    [router],
  );
  const [sortBy, setSortBy] = useState<ImageSortOption>("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [images, setImages] = useState(initialImages);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const hydratedRef = useRef(false);

  const buildParams = useCallback(() => {
    const tagFilters = activeFilters.filter((f) => f.type === "tag").map((f) => f.value);
    return {
      search: deferredSearchQuery || undefined,
      sort: sortBy,
      order: sortDir as "asc" | "desc",
      tag: tagFilters.length > 0 ? tagFilters : undefined,
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

  const handleAddFilter = (type: string, label: string, value: string) => {
    setActiveFilters((prev) => {
      const existing = prev.findIndex((f) => f.type === type && f.value === value);
      if (existing >= 0) return prev.filter((_, i) => i !== existing);
      return [...prev, { label, type, value }];
    });
  };

  const currentSort = sortOptions.find((s) => s.value === sortBy);

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

      {/* Toolbar */}
      <div className="space-y-0">
        {/* Search row */}
        <div className="surface-well flex items-center gap-2 px-3 py-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled pointer-events-none" />
            <input
              type="text"
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full bg-transparent pl-7 pr-3 py-1.5 text-[0.78rem] text-text-primary",
                "placeholder:text-text-disabled focus:outline-none transition-colors duration-fast"
              )}
            />
          </div>

          {activeFilters.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 border-l border-border-subtle pl-2">
              {activeFilters.map((filter, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap"
                >
                  <span className="text-accent-400/70">{filter.label}:</span>
                  <span className="text-accent-200">{filter.value}</span>
                  <button
                    onClick={() => setActiveFilters((prev) => prev.filter((_, idx) => idx !== i))}
                    className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Controls row */}
        <div className="surface-well mt-px flex items-center gap-2 px-3 py-1.5">
          {/* Sort */}
          <div className="flex items-center">
            <div className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2 transition-colors duration-fast"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{currentSort?.label}</span>
                <ChevronDown className="h-3 w-3 text-text-disabled" />
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 w-44 surface-elevated py-1">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSortBy(opt.value);
                          setSortDir(defaultSortDir[opt.value]);
                          setSortOpen(false);
                        }}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 text-[0.72rem] text-left transition-colors duration-fast",
                          sortBy === opt.value
                            ? "text-text-accent bg-accent-950"
                            : "text-text-muted hover:text-text-primary hover:bg-surface-3"
                        )}
                      >
                        <Check className={cn("h-3 w-3", sortBy === opt.value ? "opacity-100" : "opacity-0")} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              title={sortDir === "asc" ? "Ascending" : "Descending"}
              className="flex h-7 w-7 items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-fast"
            >
              <ChevronDown className={cn("h-3.5 w-3.5", sortDir === "asc" && "rotate-180")} />
            </button>
          </div>

          <div className="flex-1" />

          {/* View mode toggle */}
          <div className="flex items-center border border-border-subtle overflow-hidden">
            <button
              onClick={() => handleViewModeChange("grid")}
              title="Grid view"
              className={cn(
                "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
                viewMode === "grid"
                  ? "text-text-accent bg-accent-950"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-2"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleViewModeChange("feed")}
              title="Feed view"
              className={cn(
                "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
                viewMode === "feed"
                  ? "text-text-accent bg-accent-950"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-2"
              )}
            >
              <Newspaper className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 text-[0.72rem] transition-colors duration-fast",
              filterPanelOpen
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilters.length > 0 && (
              <span className="flex h-4 w-4 items-center justify-center bg-accent-800 text-[0.55rem] font-bold text-accent-200">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {filterPanelOpen && imagePageTagsForFilters.length > 0 && (
          <div className="surface-well mt-px p-3">
            <div className="text-kicker mb-2">Tags</div>
            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
              {imagePageTagsForFilters.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleAddFilter("tag", "Tag", tag.name)}
                  className={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    activeFilters.some((f) => f.label === "Tag" && f.value === tag.name)
                      ? "tag-chip-info"
                      : "tag-chip-default hover:tag-chip-info"
                  )}
                >
                  <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile active filters */}
        {activeFilters.length > 0 && (
          <div className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hidden">
            {activeFilters.map((filter, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap"
              >
                <span className="text-accent-400/70">{filter.label}:</span>
                <span className="text-accent-200">{filter.value}</span>
                <button
                  onClick={() => setActiveFilters((prev) => prev.filter((_, idx) => idx !== i))}
                  className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="surface-well flex items-center justify-center py-20">
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <div className="h-4 w-4 animate-spin border-2 border-accent-500 border-t-transparent" />
            Loading...
          </div>
        </div>
      ) : viewMode === "feed" ? (
        <ImageFeed
          images={images}
          onImageClick={(index) => {
            setLightboxIndex(index);
            setLightboxOpen(true);
          }}
          onImageUpdate={(imageId, patch) => {
            setImages((prev) =>
              prev.map((img) => (img.id === imageId ? { ...img, ...patch } : img))
            );
          }}
          hasMore={images.length < total}
          onLoadMore={handleLoadMore}
          loadingMore={loadingMore}
        />
      ) : (
        <ImageGrid
          images={images}
          onImageClick={(index) => {
            setLightboxIndex(index);
            setLightboxOpen(true);
          }}
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
          availableTags={initialTags}
          onImageUpdate={(imageId, patch) => {
            setImages((prev) =>
              prev.map((img) => (img.id === imageId ? { ...img, ...patch } : img))
            );
          }}
        />
      )}
    </div>
  );
}
