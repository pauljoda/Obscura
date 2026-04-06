"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  X,
  Film,
  Users,
  Building2,
  Tag,
  Images,
  Image,
  ChevronDown,
  Loader2,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { EntityKind, SearchResultItem, SearchResultGroup } from "@obscura/contracts";
import { useSearch } from "../../hooks/use-search";
import { fetchSearch, toApiUrl } from "../../lib/api";
import { GalleryEntityCard } from "../galleries/gallery-entity-card";
import { searchGalleryItemToCardData } from "../galleries/gallery-card-data";
import { ImageEntityCard } from "../images/image-entity-card";
import { searchImageItemToCardData } from "../images/image-card-data";
import { PerformerEntityCard } from "../performers/performer-entity-card";
import { searchPerformerItemToCardData } from "../performers/performer-card-data";
import { SceneCard } from "../scenes/scene-card";
import { searchSceneItemToCardData } from "../scenes/scene-card-data";
import { StudioEntityCard } from "../studios/studio-entity-card";
import { searchStudioItemToCardData } from "../studios/studio-card-data";
import { TagEntityCard } from "../tags/tag-entity-card";
import { searchTagItemToCardData } from "../tags/tag-card-data";

const ALL_KINDS: EntityKind[] = ["scene", "performer", "studio", "tag", "gallery", "image"];

const KIND_CONFIG: Record<EntityKind, { label: string; icon: typeof Film; href: string }> = {
  scene: { label: "Scenes", icon: Film, href: "/scenes" },
  performer: { label: "Performers", icon: Users, href: "/performers" },
  studio: { label: "Studios", icon: Building2, href: "/studios" },
  tag: { label: "Tags", icon: Tag, href: "/tags" },
  gallery: { label: "Galleries", icon: Images, href: "/galleries" },
  image: { label: "Images", icon: Image, href: "/images" },
};

const PAGE_SIZE = 20;

interface SearchPageClientProps {
  initialQuery: string;
  initialKinds: string;
}

export function SearchPageClient({ initialQuery, initialKinds }: SearchPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(initialQuery);
  const [activeKinds, setActiveKinds] = useState<Set<EntityKind>>(() => {
    if (initialKinds) {
      return new Set(initialKinds.split(",").filter((k): k is EntityKind => ALL_KINDS.includes(k as EntityKind)));
    }
    return new Set(ALL_KINDS);
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Expanded sections with "show more" loaded data
  const [expandedData, setExpandedData] = useState<Record<string, {
    items: SearchResultItem[];
    total: number;
    loading: boolean;
  }>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  const kindsArray = useMemo(() => Array.from(activeKinds), [activeKinds]);

  const { data, loading } = useSearch(query, {
    debounceMs: 300,
    kinds: kindsArray.length < ALL_KINDS.length ? kindsArray : undefined,
    limit: 6,
    rating: minRating ?? undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  // Sync query to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (activeKinds.size < ALL_KINDS.length) {
        params.set("kinds", Array.from(activeKinds).join(","));
      }
      const qs = params.toString();
      router.replace(`/search${qs ? `?${qs}` : ""}`, { scroll: false });
    }, 500);
    return () => clearTimeout(timer);
  }, [query, activeKinds, router]);

  // Reset expanded data when query changes
  useEffect(() => {
    setExpandedData({});
  }, [query, minRating, dateFrom, dateTo]);

  const toggleKind = useCallback((kind: EntityKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        if (next.size > 1) next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }, []);

  const handleLoadMore = useCallback(
    async (kind: EntityKind, currentCount: number, total: number) => {
      const key = kind;
      setExpandedData((prev) => ({
        ...prev,
        [key]: { items: prev[key]?.items ?? [], total, loading: true },
      }));

      try {
        const result = await fetchSearch({
          q: query,
          kind,
          limit: PAGE_SIZE,
          offset: currentCount,
          rating: minRating ?? undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });

        const group = result.groups[0];
        if (group) {
          setExpandedData((prev) => ({
            ...prev,
            [key]: {
              items: [...(prev[key]?.items ?? []), ...group.items],
              total: group.total,
              loading: false,
            },
          }));
        }
      } catch {
        setExpandedData((prev) => ({
          ...prev,
          [key]: { ...prev[key]!, loading: false },
        }));
      }
    },
    [query, minRating, dateFrom, dateTo]
  );

  const hasQuery = query.trim().length >= 2;
  const hasResults = data && data.groups.some((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Search header */}
      <div className="space-y-3">
        <div className="surface-well flex items-center gap-2 px-3 py-2">
          <Search className="h-4 w-4 text-text-disabled shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search everything..."
            className={cn(
              "flex-1 bg-transparent text-sm text-text-primary",
              "placeholder:text-text-disabled",
              "focus:outline-none"
            )}
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-text-disabled hover:text-text-muted transition-colors duration-fast"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {loading && (
            <Loader2 className="h-3.5 w-3.5 text-text-disabled animate-spin" />
          )}
        </div>

        {/* Entity kind toggles + filter button */}
        <div className="flex items-center gap-2 flex-wrap">
          {ALL_KINDS.map((kind) => {
            const config = KIND_CONFIG[kind];
            const Icon = config.icon;
            const active = activeKinds.has(kind);
            return (
              <button
                key={kind}
                onClick={() => toggleKind(kind)}
                className={cn(
                  "tag-chip cursor-pointer transition-colors duration-fast flex items-center gap-1.5",
                  active ? "tag-chip-accent" : "tag-chip-default"
                )}
              >
                <Icon className="h-3 w-3" />
                {config.label}
              </button>
            );
          })}

          <div className="h-4 w-px bg-border-subtle" />

          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              "tag-chip cursor-pointer transition-colors duration-fast flex items-center gap-1.5",
              filtersOpen ? "tag-chip-info" : "tag-chip-default"
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filters
            {(minRating || dateFrom || dateTo) && (
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-accent-800 text-[0.5rem] font-bold text-accent-200">
                !
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div className="surface-well p-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-kicker mb-2">Min Rating</div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMinRating(minRating === n ? null : n)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-sm transition-colors duration-fast",
                      minRating && n <= minRating
                        ? "text-text-accent"
                        : "text-text-disabled hover:text-text-muted"
                    )}
                  >
                    <Star className="h-3.5 w-3.5" fill={minRating && n <= minRating ? "currentColor" : "none"} />
                  </button>
                ))}
                {minRating && (
                  <button
                    onClick={() => setMinRating(null)}
                    className="ml-1 text-text-disabled hover:text-text-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <div className="text-kicker mb-2">Date From</div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="control-input text-[0.75rem] w-full"
              />
            </div>
            <div>
              <div className="text-kicker mb-2">Date To</div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="control-input text-[0.75rem] w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {!hasQuery && (
        <div className="flex flex-col items-center justify-center py-20 text-text-disabled">
          <Search className="h-8 w-8 mb-3 opacity-30" />
          <div className="text-sm">Enter a search term to find scenes, performers, studios, and more</div>
        </div>
      )}

      {hasQuery && loading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 text-text-disabled animate-spin" />
        </div>
      )}

      {hasQuery && data && !hasResults && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-text-disabled">
          <Search className="h-8 w-8 mb-3 opacity-30" />
          <div className="text-sm">No results for &ldquo;{query}&rdquo;</div>
        </div>
      )}

      {hasQuery && data && hasResults && (
        <div className="space-y-6">
          {data.groups
            .filter((g) => g.items.length > 0 && activeKinds.has(g.kind))
            .map((group) => {
              const expanded = expandedData[group.kind];
              const items = expanded
                ? [...group.items, ...expanded.items]
                : group.items;
              const total = expanded?.total ?? group.total;
              const hasMore = items.length < total;
              const isLoadingMore = expanded?.loading ?? false;

              return (
                <SearchSection
                  key={group.kind}
                  kind={group.kind}
                  items={items}
                  total={total}
                  hasMore={hasMore}
                  loadingMore={isLoadingMore}
                  onLoadMore={() => handleLoadMore(group.kind, items.length, total)}
                />
              );
            })}
          <div className="text-center text-[0.6rem] font-mono text-text-disabled py-2">
            {data.durationMs}ms
          </div>
        </div>
      )}
    </div>
  );
}

function SearchSection({
  kind,
  items,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  kind: EntityKind;
  items: SearchResultItem[];
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const config = KIND_CONFIG[kind];
  const Icon = config.icon;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-medium text-text-primary">{config.label}</span>
          <span className="text-[0.65rem] font-mono text-text-disabled">{total}</span>
        </div>
        <Link
          href={config.href}
          className="text-[0.68rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
        >
          Browse all
        </Link>
      </div>

      {/* Results grid */}
      <div
        className={cn(
          "grid gap-2",
          kind === "scene"
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : kind === "gallery"
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : kind === "image"
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
            : kind === "performer"
            ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5"
            : kind === "studio"
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : kind === "tag"
            ? "columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-0 block"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {items.map((item) => (
          <SearchCard key={item.id} item={item} />
        ))}
      </div>

      {/* Show more */}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-sm",
              "text-[0.72rem] text-text-muted",
              "surface-well hover:text-text-primary",
              "transition-colors duration-fast",
              loadingMore && "opacity-60 cursor-wait"
            )}
          >
            {loadingMore ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Show more ({total - items.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

function SearchCard({ item }: { item: SearchResultItem }) {
  if (item.kind === "scene") {
    const scene = searchSceneItemToCardData(item);

    if (scene) {
      return <SceneCard scene={scene} />;
    }
  }

  if (item.kind === "gallery") {
    const gallery = searchGalleryItemToCardData(item);

    if (gallery) {
      return <GalleryEntityCard gallery={gallery} />;
    }
  }

  if (item.kind === "image") {
    const image = searchImageItemToCardData(item);

    if (image) {
      return <ImageEntityCard image={image} />;
    }
  }

  if (item.kind === "performer") {
    const performer = searchPerformerItemToCardData(item);

    if (performer) {
      return <PerformerEntityCard performer={performer} />;
    }
  }

  if (item.kind === "studio") {
    const studio = searchStudioItemToCardData(item);

    if (studio) {
      return <StudioEntityCard studio={studio} />;
    }
  }

  const Icon = KIND_CONFIG[item.kind].icon;
  const imgSrc = toApiUrl(item.imagePath);

  if (item.kind === "tag") {
    const tag = searchTagItemToCardData(item);

    if (tag) {
      return <TagEntityCard tag={tag} />;
    }
  }

  return (
    <Link
      href={item.href}
      className="surface-card-sharp group flex items-center gap-3 p-2 transition-colors duration-fast"
    >
      {/* Thumbnail */}
      <div
        className={cn(
          "shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center",
          item.kind === "performer"
            ? "h-12 w-12 rounded-full"
            : "h-12 w-20 rounded-sm"
        )}
      >
        {imgSrc ? (
          <img src={imgSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-4 w-4 text-text-disabled" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary group-hover:text-text-accent truncate transition-colors duration-fast">
          {item.title}
        </div>
        {item.subtitle && (
          <div className="text-[0.68rem] text-text-muted truncate">{item.subtitle}</div>
        )}
        {item.rating && (
          <div className="flex items-center gap-0.5 mt-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-2.5 w-2.5",
                  i < item.rating! ? "text-text-accent" : "text-text-disabled/30"
                )}
                fill={i < item.rating! ? "currentColor" : "none"}
              />
            ))}
          </div>
        )}
      </div>

      {/* Type indicator */}
      <span className="shrink-0 tag-chip tag-chip-default text-[0.55rem]">
        {item.kind}
      </span>
    </Link>
  );
}
