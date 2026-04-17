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
  CalendarRange,
  Users,
  RotateCcw,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { ImageGrid } from "../image-grid";
import { ImageFeed } from "../image-feed";
import { useCurrentPath } from "../../hooks/use-current-path";
import { ImageLightbox } from "../image-lightbox";
import {
  fetchImages,
  fetchPerformers,
  fetchStudios,
  fetchTags,
  type PerformerItem,
  type StudioItem,
  type TagItem,
} from "../../lib/api";
import type { ImageListItemDto } from "@obscura/contracts";
import { NsfwTagLabel, tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import type { ImageListSortKey, ImagesListPrefs } from "../../lib/images-list-prefs";
import {
  clearImagesListPrefsCookie,
  defaultImagesListPrefs,
  imagesListPrefsToFetchParams,
  isDefaultImagesListPrefs,
  writeImagesListPrefsCookie,
} from "../../lib/images-list-prefs";

export type ImageViewMode = "grid" | "feed";

type SortDir = "asc" | "desc";

const defaultSortDir: Record<ImageListSortKey, SortDir> = {
  recent: "desc",
  title: "asc",
  date: "desc",
  rating: "desc",
};

const sortOptions: { value: ImageListSortKey; label: string }[] = [
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
  initialStudios: StudioItem[];
  initialPerformers: PerformerItem[];
  initialListPrefs: ImagesListPrefs;
}

export function ImagesPageClient({
  initialImages,
  initialTags,
  initialTotal,
  initialStudios,
  initialPerformers,
  initialListPrefs,
}: ImagesPageClientProps) {
  const { mode: nsfwMode } = useNsfw();
  const currentPath = useCurrentPath();
  const [filterTags, setFilterTags] = useState(initialTags);
  const [filterStudios, setFilterStudios] = useState(initialStudios);
  const [filterPerformers, setFilterPerformers] = useState(initialPerformers);
  const imagePageTagsForFilters = useMemo(
    () => tagsVisibleInNsfwMode(filterTags, nsfwMode),
    [filterTags, nsfwMode],
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
  const [sortBy, setSortBy] = useState<ImageListSortKey>(initialListPrefs.sortBy);
  const [sortDir, setSortDir] = useState<SortDir>(initialListPrefs.sortDir);
  const [searchQuery, setSearchQuery] = useState(initialListPrefs.search);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(initialListPrefs.activeFilters);
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
  const skipFirstNsfwRefetch = useRef(true);

  useEffect(() => {
    if (skipFirstNsfwRefetch.current) {
      skipFirstNsfwRefetch.current = false;
      return;
    }
    void Promise.all([
      fetchTags({ nsfw: nsfwMode }),
      fetchStudios({ nsfw: nsfwMode }),
      fetchPerformers({
        nsfw: nsfwMode,
        sort: "scenes",
        order: "desc",
        limit: 300,
      }),
    ])
      .then(([t, s, p]) => {
        setFilterTags(t.tags);
        setFilterStudios(s.studios);
        setFilterPerformers(p.performers);
      })
      .catch(() => {});
  }, [nsfwMode]);

  useEffect(() => {
    const prefs: ImagesListPrefs = {
      sortBy,
      sortDir,
      search: searchQuery,
      activeFilters,
    };
    if (isDefaultImagesListPrefs(prefs)) {
      clearImagesListPrefsCookie();
    } else {
      writeImagesListPrefsCookie(prefs);
    }
  }, [sortBy, sortDir, searchQuery, activeFilters]);

  const buildParams = useCallback(() => {
    return imagesListPrefsToFetchParams(
      {
        sortBy,
        sortDir,
        search: deferredSearchQuery,
        activeFilters,
      },
      nsfwMode,
    );
  }, [activeFilters, deferredSearchQuery, sortBy, sortDir, nsfwMode]);

  const imageFilterChipFilters = useMemo(() => {
    const resLabels: Record<string, string> = {
      "4K": "4K",
      "1080p": "1080p",
      "720p": "720p",
      "480p": "480p",
    };
    return activeFilters.map((f) => {
      let v = f.value;
      if (f.type === "studio") {
        v = filterStudios.find((s) => s.id === f.value)?.name ?? f.value;
      } else if (f.type === "ratingMin") {
        v = `${f.value}★+`;
      } else if (f.type === "ratingMax") {
        v = `≤${f.value}★`;
      } else if (f.type === "organized") {
        v = f.value === "true" ? "Yes" : "No";
      } else if (f.type === "resolution") {
        v = resLabels[f.value] ?? f.value;
      }
      return { label: f.label, value: v };
    });
  }, [activeFilters, filterStudios]);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchImages({ ...buildParams(), limit: 80, offset: 0 });
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
    const exclusive = new Set([
      "studio",
      "ratingMin",
      "ratingMax",
      "dateFrom",
      "dateTo",
      "resolution",
      "organized",
    ]);
    setActiveFilters((prev) => {
      const existing = prev.findIndex((f) => f.type === type && f.value === value);
      if (existing >= 0) return prev.filter((_, i) => i !== existing);
      if (exclusive.has(type)) {
        return [...prev.filter((f) => f.type !== type), { label, type, value }];
      }
      return [...prev, { label, type, value }];
    });
  };

  const handleClearFiltersAndSort = useCallback(() => {
    const d = defaultImagesListPrefs();
    setSortBy(d.sortBy);
    setSortDir(d.sortDir);
    setSearchQuery(d.search);
    setActiveFilters(d.activeFilters);
  }, []);

  const currentSort = sortOptions.find((s) => s.value === sortBy);
  const canClearListPrefs =
    !isDefaultImagesListPrefs({
      sortBy,
      sortDir,
      search: searchQuery,
      activeFilters,
    });

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
              {imageFilterChipFilters.map((filter, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap"
                >
                  <span className="text-accent-400/70">{filter.label}:</span>
                  <span className="text-accent-200">{filter.value}</span>
                  <button
                    type="button"
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
            type="button"
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 text-[0.72rem] transition-colors duration-fast",
              filterPanelOpen
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2",
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

          {canClearListPrefs && (
            <button
              type="button"
              onClick={handleClearFiltersAndSort}
              title="Clear filters, sort, search, and saved preferences"
              className={cn(
                "flex items-center gap-1 px-2 py-1.5",
                "text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2",
                "transition-colors duration-fast",
              )}
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        {/* Filter panel */}
        {filterPanelOpen && (
          <div className="surface-well mt-px p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <div className="text-kicker mb-2">Rating</div>
                <div className="space-y-2">
                  <div className="text-[0.6rem] font-mono uppercase tracking-wider text-text-disabled">
                    At least
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={`im-min-${n}`}
                        type="button"
                        onClick={() => handleAddFilter("ratingMin", "Min rating", String(n))}
                        className={cn(
                          "tag-chip cursor-pointer transition-colors duration-fast",
                          activeFilters.some((f) => f.type === "ratingMin" && f.value === String(n))
                            ? "tag-chip-accent"
                            : "tag-chip-default hover:tag-chip-accent",
                        )}
                      >
                        {n}★+
                      </button>
                    ))}
                  </div>
                  <div className="text-[0.6rem] font-mono uppercase tracking-wider text-text-disabled">
                    At most
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={`im-max-${n}`}
                        type="button"
                        onClick={() => handleAddFilter("ratingMax", "Max rating", String(n))}
                        className={cn(
                          "tag-chip cursor-pointer transition-colors duration-fast",
                          activeFilters.some((f) => f.type === "ratingMax" && f.value === String(n))
                            ? "tag-chip-accent"
                            : "tag-chip-default hover:tag-chip-accent",
                        )}
                      >
                        ≤{n}★
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-kicker mb-2">Image date</div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[0.7rem] text-text-muted">
                    <CalendarRange className="h-3 w-3 shrink-0 text-text-disabled" />
                    <span className="font-mono text-[0.6rem] uppercase tracking-wider">From</span>
                    <input
                      type="date"
                      className="flex-1 min-w-0 bg-surface-1 border border-border-subtle px-2 py-1 text-[0.72rem] text-text-primary focus:outline-none focus:border-border-accent"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) handleAddFilter("dateFrom", "Date from", v);
                      }}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[0.7rem] text-text-muted">
                    <CalendarRange className="h-3 w-3 shrink-0 text-text-disabled" />
                    <span className="font-mono text-[0.6rem] uppercase tracking-wider">To</span>
                    <input
                      type="date"
                      className="flex-1 min-w-0 bg-surface-1 border border-border-subtle px-2 py-1 text-[0.72rem] text-text-primary focus:outline-none focus:border-border-accent"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) handleAddFilter("dateTo", "Date to", v);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <div className="text-kicker mb-2">Resolution</div>
                <div className="flex flex-wrap gap-1">
                  {["4K", "1080p", "720p", "480p"].map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => handleAddFilter("resolution", "Resolution", res)}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        activeFilters.some((f) => f.type === "resolution" && f.value === res)
                          ? "tag-chip-accent"
                          : "tag-chip-default hover:tag-chip-accent",
                      )}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-kicker mb-2">Organized</div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => handleAddFilter("organized", "Organized", "true")}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some((f) => f.type === "organized" && f.value === "true")
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddFilter("organized", "Organized", "false")}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      activeFilters.some((f) => f.type === "organized" && f.value === "false")
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    No
                  </button>
                </div>
              </div>

              {filterStudios.length > 0 && (
                <div className="md:col-span-2 xl:col-span-1">
                  <div className="text-kicker mb-2">Studio</div>
                  <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto tag-scroll-area">
                    {filterStudios.map((studio) => (
                      <button
                        key={studio.id}
                        type="button"
                        onClick={() => handleAddFilter("studio", "Studio", studio.id)}
                        className={cn(
                          "tag-chip cursor-pointer transition-colors duration-fast",
                          activeFilters.some((f) => f.type === "studio" && f.value === studio.id)
                            ? "tag-chip-accent"
                            : "tag-chip-default hover:tag-chip-accent",
                        )}
                      >
                        {studio.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {imagePageTagsForFilters.length > 0 && (
                <div className="md:col-span-2 xl:col-span-3">
                  <div className="text-kicker mb-2">Tags</div>
                  <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                    {imagePageTagsForFilters.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleAddFilter("tag", "Tag", tag.name)}
                        className={cn(
                          "tag-chip cursor-pointer transition-colors duration-fast",
                          activeFilters.some((f) => f.type === "tag" && f.value === tag.name)
                            ? "tag-chip-info"
                            : "tag-chip-default hover:tag-chip-info",
                        )}
                      >
                        <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filterPerformers.filter((p) => p.videoCount > 0).length > 0 && (
                <div className="md:col-span-2 xl:col-span-3">
                  <div className="flex items-center gap-1.5 text-kicker mb-2">
                    <Users className="h-3 w-3 text-text-disabled" />
                    Performers
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto tag-scroll-area">
                    {tagsVisibleInNsfwMode(filterPerformers, nsfwMode)
                      .filter((p) => p.videoCount > 0)
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAddFilter("performer", "Performer", p.name)}
                          className={cn(
                            "tag-chip cursor-pointer transition-colors duration-fast",
                            activeFilters.some((f) => f.type === "performer" && f.value === p.name)
                              ? "tag-chip-info"
                              : "tag-chip-default hover:tag-chip-info",
                          )}
                        >
                          <NsfwTagLabel isNsfw={p.isNsfw}>{p.name}</NsfwTagLabel>
                          <span className="text-text-disabled ml-1">{p.videoCount}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile active filters */}
        {activeFilters.length > 0 && (
          <div className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hidden">
            {imageFilterChipFilters.map((filter, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap"
              >
                <span className="text-accent-400/70">{filter.label}:</span>
                <span className="text-accent-200">{filter.value}</span>
                <button
                  type="button"
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
          from={currentPath}
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
          from={currentPath}
        />
      )}

      {lightboxOpen && (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          availableTags={filterTags}
          availablePerformers={filterPerformers}
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
