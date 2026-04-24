<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    Search as SearchIcon,
    X,
    ChevronDown,
    Loader2,
    SlidersHorizontal,
    Star,
    Layers,
    Image as ImageIcon,
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type {
    EntityKind,
    SearchResponseDto,
    SearchResultItem,
  } from "@obscura/contracts";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import SeriesThumbnail from "$lib/components/thumbnails/SeriesThumbnail.svelte";
  import GalleryThumbnail from "$lib/components/thumbnails/GalleryThumbnail.svelte";
  import ImageThumbnail from "$lib/components/thumbnails/ImageThumbnail.svelte";
  import PerformerThumbnail from "$lib/components/thumbnails/PerformerThumbnail.svelte";
  import StudioThumbnail from "$lib/components/thumbnails/StudioThumbnail.svelte";
  import TagThumbnail from "$lib/components/thumbnails/TagThumbnail.svelte";
  import AudioLibraryThumbnail from "$lib/components/thumbnails/AudioLibraryThumbnail.svelte";
  import AudioTrackThumbnail from "$lib/components/thumbnails/AudioTrackThumbnail.svelte";
  import { fetchSearch } from "$lib/api/media";
  import { toApiUrl } from "$lib/api/core";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import { entityTerms } from "$lib/terminology";
  import { buildHrefWithFrom } from "$lib/back-navigation";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import type { VideoCardData } from "$lib/video-card-data";
  import {
    ALL_SEARCH_KINDS,
    SEARCH_KIND_CONFIG,
  } from "$lib/components/search-kind-config";

  const PAGE_SIZE = 20;
  const INITIAL_LIMIT = 6;

  const nsfw = useNsfw();
  const currentPath = $derived(`${page.url.pathname}${page.url.search}`);

  let query = $state(page.url.searchParams.get("q") ?? "");
  let activeKinds = $state<Set<EntityKind>>(initialKinds());
  let filtersOpen = $state(false);
  let minRating = $state<number | null>(null);
  let dateFrom = $state("");
  let dateTo = $state("");

  let results = $state<SearchResponseDto | null>(null);
  let loading = $state(false);
  let expanded = $state<
    Record<string, { items: SearchResultItem[]; total: number; loading: boolean }>
  >({});

  let inputRef: HTMLInputElement | undefined = $state();
  let activeRequest = 0;

  function initialKinds(): Set<EntityKind> {
    const raw = page.url.searchParams.get("kinds");
    if (!raw) return new Set(ALL_SEARCH_KINDS);
    const parsed = raw
      .split(",")
      .filter((k): k is EntityKind => (ALL_SEARCH_KINDS as string[]).includes(k));
    return parsed.length > 0 ? new Set(parsed) : new Set(ALL_SEARCH_KINDS);
  }

  const kindsArray = $derived(Array.from(activeKinds));
  const hasQuery = $derived(query.trim().length >= 2);
  const hasResults = $derived(
    results != null && results.groups.some((g) => g.items.length > 0),
  );
  const hasFiltersApplied = $derived(
    minRating != null || dateFrom !== "" || dateTo !== "",
  );

  $effect(() => {
    inputRef?.focus();
  });

  // Keep URL in sync (debounced).
  $effect(() => {
    const q = query.trim();
    const kindsList = Array.from(activeKinds);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (kindsList.length < ALL_SEARCH_KINDS.length) {
        params.set("kinds", kindsList.join(","));
      }
      const qs = params.toString();
      void goto(`/search${qs ? `?${qs}` : ""}`, {
        replaceState: true,
        keepFocus: true,
        noScroll: true,
      });
    }, 400);
    return () => window.clearTimeout(timer);
  });

  // Debounced fetch.
  $effect(() => {
    const q = query.trim();
    const kindsList = kindsArray;
    const rating = minRating;
    const from = dateFrom;
    const to = dateTo;
    const nsfwMode = nsfw.mode;

    expanded = {};

    if (q.length < 2) {
      results = null;
      loading = false;
      activeRequest += 1;
      return;
    }

    loading = true;
    const requestId = ++activeRequest;
    const timer = window.setTimeout(async () => {
      try {
        const data = await fetchSearch({
          q,
          kinds:
            kindsList.length > 0 && kindsList.length < ALL_SEARCH_KINDS.length
              ? kindsList
              : undefined,
          limit: INITIAL_LIMIT,
          rating: rating ?? undefined,
          dateFrom: from || undefined,
          dateTo: to || undefined,
          nsfw: nsfwMode,
        });
        if (requestId === activeRequest) {
          results = data;
        }
      } catch {
        if (requestId === activeRequest) {
          results = null;
        }
      } finally {
        if (requestId === activeRequest) {
          loading = false;
        }
      }
    }, 300);

    return () => window.clearTimeout(timer);
  });

  function kindLabel(kind: EntityKind): string {
    if (kind === "video") return entityTerms.videos;
    if (kind === "performer") return entityTerms.performers;
    if (kind === "studio") return entityTerms.studios;
    if (kind === "tag") return entityTerms.tags;
    return SEARCH_KIND_CONFIG[kind].label;
  }

  function toggleKind(kind: EntityKind) {
    const next = new Set(activeKinds);
    if (next.has(kind)) {
      if (next.size > 1) next.delete(kind);
    } else {
      next.add(kind);
    }
    activeKinds = next;
  }

  async function loadMore(kind: EntityKind, currentCount: number, total: number) {
    expanded = {
      ...expanded,
      [kind]: {
        items: expanded[kind]?.items ?? [],
        total,
        loading: true,
      },
    };

    try {
      const data = await fetchSearch({
        q: query.trim(),
        kind,
        limit: PAGE_SIZE,
        offset: currentCount,
        rating: minRating ?? undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        nsfw: nsfw.mode,
      });
      const group = data.groups[0];
      if (group) {
        expanded = {
          ...expanded,
          [kind]: {
            items: [...(expanded[kind]?.items ?? []), ...group.items],
            total: group.total,
            loading: false,
          },
        };
      } else {
        expanded = {
          ...expanded,
          [kind]: { ...expanded[kind]!, loading: false },
        };
      }
    } catch {
      expanded = {
        ...expanded,
        [kind]: { ...expanded[kind]!, loading: false },
      };
    }
  }

  function videoSearchItemToCardData(item: SearchResultItem): VideoCardData {
    const meta = item.meta ?? {};
    const durationSeconds =
      typeof meta.durationSeconds === "number" ? meta.durationSeconds : undefined;
    return {
      id: item.id,
      href: buildHrefWithFrom(item.href, currentPath),
      title: item.title,
      thumbnail: toApiUrl(item.imagePath ?? undefined),
      cardThumbnail: toApiUrl(
        (meta.cardThumbnailPath as string | null | undefined) ?? undefined,
      ),
      trickplaySprite: toApiUrl(
        (meta.spritePath as string | null | undefined) ?? undefined,
      ),
      trickplayVtt: toApiUrl(
        (meta.trickplayVttPath as string | null | undefined) ?? undefined,
      ),
      scrubDurationSeconds: durationSeconds,
      duration:
        typeof meta.durationFormatted === "string" ? meta.durationFormatted : undefined,
      resolution: typeof meta.resolution === "string" ? meta.resolution : undefined,
      codec: typeof meta.codec === "string" ? meta.codec : undefined,
      fileSize:
        typeof meta.fileSizeFormatted === "string" ? meta.fileSizeFormatted : undefined,
      studio: typeof meta.studio === "string" ? meta.studio : undefined,
      views: typeof meta.views === "number" ? meta.views : undefined,
      rating: item.rating ?? undefined,
      hasSubtitles: false,
    };
  }

  function isNsfwItem(item: SearchResultItem): boolean {
    const v = item.meta?.isNsfw;
    return v === true;
  }

  function gridClassFor(kind: EntityKind): string {
    switch (kind) {
      case "video":
        return "grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
      case "video-series":
        return "grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
      case "gallery":
        return "grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
      case "image":
        return "grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5";
      case "performer":
        return "grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5";
      case "studio":
        return "grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
      case "tag":
        return "grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
      default:
        return "grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    }
  }

  function groupItemsFor(kind: EntityKind, baseItems: SearchResultItem[]) {
    const extra = expanded[kind];
    const items = extra ? [...baseItems, ...extra.items] : baseItems;
    return items;
  }
</script>

<svelte:head>
  <title>Search · Obscura</title>
</svelte:head>

<div class="space-y-4">
  <!-- Search header -->
  <div class="space-y-3">
    <div class="surface-well flex items-center gap-2 px-3 py-2">
      <SearchIcon class="h-4 w-4 shrink-0 text-text-disabled" />
      <input
        bind:this={inputRef}
        bind:value={query}
        type="text"
        placeholder="Search everything..."
        class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled focus:outline-none"
      />
      {#if query}
        <button
          type="button"
          class="text-text-disabled transition-colors duration-fast hover:text-text-muted"
          onclick={() => {
            query = "";
            inputRef?.focus();
          }}
          aria-label="Clear search"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      {/if}
      {#if loading}
        <Loader2 class="h-3.5 w-3.5 animate-spin text-text-disabled" />
      {/if}
    </div>

    <!-- Entity kind toggles + filters button -->
    <div class="flex flex-wrap items-center gap-2">
      {#each ALL_SEARCH_KINDS as kind (kind)}
        {@const config = SEARCH_KIND_CONFIG[kind]}
        {@const Icon = config.icon}
        {@const active = activeKinds.has(kind)}
        <button
          type="button"
          class={cn(
            "tag-chip flex cursor-pointer items-center gap-1.5 transition-colors duration-fast",
            active ? "tag-chip-accent" : "tag-chip-default",
          )}
          onclick={() => toggleKind(kind)}
        >
          <Icon class="h-3 w-3" />
          {kindLabel(kind)}
        </button>
      {/each}

      <div class="h-4 w-px bg-border-subtle"></div>

      <button
        type="button"
        class={cn(
          "tag-chip flex cursor-pointer items-center gap-1.5 transition-colors duration-fast",
          filtersOpen ? "tag-chip-info" : "tag-chip-default",
        )}
        onclick={() => (filtersOpen = !filtersOpen)}
      >
        <SlidersHorizontal class="h-3 w-3" />
        Filters
        {#if hasFiltersApplied}
          <span class="flex h-3.5 w-3.5 items-center justify-center bg-accent-800 text-[0.5rem] font-bold text-accent-200">
            !
          </span>
        {/if}
      </button>
    </div>

    <!-- Filter panel -->
    {#if filtersOpen}
      <div class="surface-well grid grid-cols-1 gap-4 p-3 sm:grid-cols-3">
        <div>
          <div class="text-kicker mb-2">Min Rating</div>
          <div class="flex items-center gap-1">
            {#each [1, 2, 3, 4, 5] as n (n)}
              <button
                type="button"
                class={cn(
                  "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
                  minRating && n <= minRating
                    ? "text-text-accent"
                    : "text-text-disabled hover:text-text-muted",
                )}
                onclick={() => (minRating = minRating === n ? null : n)}
                aria-label={`Rating ${n}`}
              >
                <Star
                  class="h-3.5 w-3.5"
                  fill={minRating && n <= minRating ? "currentColor" : "none"}
                />
              </button>
            {/each}
            {#if minRating}
              <button
                type="button"
                class="ml-1 text-text-disabled hover:text-text-muted"
                onclick={() => (minRating = null)}
                aria-label="Clear rating"
              >
                <X class="h-3 w-3" />
              </button>
            {/if}
          </div>
        </div>
        <div>
          <div class="text-kicker mb-2">Date From</div>
          <input
            type="date"
            bind:value={dateFrom}
            class="control-input w-full text-[0.75rem]"
          />
        </div>
        <div>
          <div class="text-kicker mb-2">Date To</div>
          <input
            type="date"
            bind:value={dateTo}
            class="control-input w-full text-[0.75rem]"
          />
        </div>
      </div>
    {/if}
  </div>

  <!-- Results states -->
  {#if !hasQuery}
    <div class="flex flex-col items-center justify-center py-20 text-text-disabled">
      <SearchIcon class="mb-3 h-8 w-8 opacity-30" />
      <div class="text-sm">
        Enter a search term to find videos, actors, studios, and more
      </div>
    </div>
  {:else if loading && !results}
    <div class="flex items-center justify-center py-20">
      <Loader2 class="h-5 w-5 animate-spin text-text-disabled" />
    </div>
  {:else if results && !hasResults && !loading}
    <div class="flex flex-col items-center justify-center py-20 text-text-disabled">
      <SearchIcon class="mb-3 h-8 w-8 opacity-30" />
      <div class="text-sm">No results for "{query}"</div>
    </div>
  {:else if results && hasResults}
    <div class="space-y-6">
      {#each results.groups.filter((g) => g.items.length > 0 && activeKinds.has(g.kind)) as group (group.kind)}
        {@const items = groupItemsFor(group.kind, group.items)}
        {@const total = expanded[group.kind]?.total ?? group.total}
        {@const loadingMore = expanded[group.kind]?.loading ?? false}
        {@const hasMore = items.length < total}
        {@const Icon = SEARCH_KIND_CONFIG[group.kind].icon}

        <section>
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon class="h-4 w-4 text-text-muted" />
              <span class="text-sm font-medium text-text-primary">
                {kindLabel(group.kind)}
              </span>
              <span class="font-mono text-[0.65rem] text-text-disabled">{total}</span>
            </div>
            <a
              href={SEARCH_KIND_CONFIG[group.kind].href}
              class="text-[0.68rem] text-text-muted transition-colors duration-fast hover:text-text-accent"
            >
              Browse all
            </a>
          </div>

          <div class={gridClassFor(group.kind)}>
            {#each items as item, index (item.id)}
              {#if item.kind === "video"}
                <VideoCard
                  video={videoSearchItemToCardData(item)}
                  variant="grid"
                  index={index}
                />
              {:else if item.kind === "video-series"}
                <a
                  href={buildHrefWithFrom(item.href, currentPath)}
                  class="surface-card-sharp overflow-hidden transition-colors duration-fast hover:border-border-accent"
                >
                  <SeriesThumbnail
                    title={item.title}
                    coverImagePath={item.imagePath}
                    isNsfw={isNsfwItem(item)}
                    videoCount={typeof item.meta?.videoCount === "number"
                      ? item.meta.videoCount
                      : null}
                  />
                  <div class="space-y-1 p-2.5">
                    <h4 class="truncate text-body font-medium text-text-primary">
                      {item.title}
                    </h4>
                    {#if item.subtitle}
                      <div class="truncate text-[0.65rem] text-text-muted">
                        {item.subtitle}
                      </div>
                    {/if}
                  </div>
                </a>
              {:else if item.kind === "gallery"}
                {@const gradient = VIDEO_CARD_GRADIENTS[index % VIDEO_CARD_GRADIENTS.length]}
                {@const previewPaths = (() => {
                  try {
                    const raw = item.meta?.previewImagePaths;
                    return typeof raw === "string" ? (JSON.parse(raw) as string[]) : [];
                  } catch {
                    return [] as string[];
                  }
                })()}
                {@const imageCount = typeof item.meta?.imageCount === "number"
                  ? item.meta.imageCount
                  : null}
                <a
                  href={buildHrefWithFrom(item.href, currentPath)}
                  class="surface-card-sharp overflow-hidden transition-colors duration-fast hover:border-border-accent"
                >
                  <GalleryThumbnail
                    title={item.title}
                    coverImagePath={item.imagePath}
                    previewImagePaths={previewPaths}
                    imageCount={imageCount}
                    isNsfw={isNsfwItem(item)}
                    size="grid"
                    gradientFallback={gradient}
                  />
                  <div class="space-y-1 p-2.5">
                    <h4 class="truncate text-body font-medium text-text-primary">
                      {item.title}
                    </h4>
                    {#if item.subtitle}
                      <div class="truncate text-[0.65rem] text-text-muted">
                        {item.subtitle}
                      </div>
                    {/if}
                  </div>
                </a>
              {:else if item.kind === "image"}
                {@const previewPath = typeof item.meta?.previewPath === "string"
                  ? item.meta.previewPath
                  : null}
                {@const width = typeof item.meta?.width === "number" ? item.meta.width : null}
                {@const height = typeof item.meta?.height === "number" ? item.meta.height : null}
                {@const format = typeof item.meta?.format === "string" ? item.meta.format : null}
                <a
                  href={buildHrefWithFrom(item.href, currentPath)}
                  class="surface-card-sharp group overflow-hidden transition-colors duration-fast hover:border-border-accent"
                >
                  <ImageThumbnail
                    title={item.title}
                    thumbnailPath={item.imagePath}
                    previewPath={previewPath}
                    isVideo={!!previewPath}
                    isNsfw={isNsfwItem(item)}
                    width={width}
                    height={height}
                    size="grid"
                  />
                  {#if item.title}
                    <div class="px-1.5 py-1 text-[0.62rem] text-text-muted truncate">
                      {item.title}
                    </div>
                  {/if}
                </a>
              {:else if item.kind === "performer"}
                {@const gradient = VIDEO_CARD_GRADIENTS[index % VIDEO_CARD_GRADIENTS.length]}
                <a
                  href={buildHrefWithFrom(item.href, currentPath)}
                  class="surface-card-sharp flex flex-col overflow-hidden transition-colors duration-fast hover:border-border-accent"
                >
                  <PerformerThumbnail
                    performer={{
                      name: item.title,
                      imagePath: item.imagePath,
                      isNsfw: isNsfwItem(item),
                      videoCount: typeof item.meta?.videoCount === "number" ? item.meta.videoCount : 0,
                      seriesCount: typeof item.meta?.seriesCount === "number" ? item.meta.seriesCount : 0,
                      galleryCount: typeof item.meta?.galleryCount === "number" ? item.meta.galleryCount : 0,
                      imageCount: typeof item.meta?.imageCount === "number" ? item.meta.imageCount : 0,
                      audioLibraryCount: typeof item.meta?.audioLibraryCount === "number" ? item.meta.audioLibraryCount : 0,
                      audioTrackCount: typeof item.meta?.audioTrackCount === "number" ? item.meta.audioTrackCount : 0,
                    }}
                    gradientFallback={gradient}
                  />
                  <div class="space-y-0.5 p-2">
                    <h4 class="truncate text-[0.8rem] font-medium leading-tight text-text-primary">
                      {item.title}
                    </h4>
                    {#if item.subtitle}
                      <p class="truncate text-[0.62rem] text-text-muted">
                        {item.subtitle}
                      </p>
                    {/if}
                  </div>
                </a>
              {:else if item.kind === "studio"}
                <a
                  href={buildHrefWithFrom(item.href, currentPath)}
                  class="surface-card-sharp flex items-center gap-3 overflow-hidden p-2 transition-colors duration-fast hover:border-border-accent"
                >
                  <div class="h-16 w-20 shrink-0">
                    <StudioThumbnail
                      studio={{
                        name: item.title,
                        imagePath: item.imagePath,
                        isNsfw: isNsfwItem(item),
                      }}
                      aspectClass="aspect-[4/3] h-full w-full"
                      showChips={false}
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm text-text-primary">{item.title}</div>
                    {#if item.subtitle}
                      <div class="truncate text-[0.65rem] text-text-muted">
                        {item.subtitle}
                      </div>
                    {/if}
                  </div>
                </a>
              {:else if item.kind === "tag"}
                <a
                  href={buildHrefWithFrom(item.href, currentPath)}
                  class="block transition-transform duration-fast"
                >
                  <TagThumbnail
                    tag={{
                      name: item.title,
                      imagePath: item.imagePath,
                      isNsfw: isNsfwItem(item),
                      videoCount:
                        typeof item.meta?.videoCount === "number" ? item.meta.videoCount : 0,
                      imageCount:
                        typeof item.meta?.imageCount === "number" ? item.meta.imageCount : 0,
                    }}
                  />
                </a>
              {:else if item.kind === "audio-library"}
                <a
                  href={buildHrefWithFrom(item.href, currentPath)}
                  class="surface-card-sharp flex items-center gap-3 p-2 transition-colors duration-fast hover:border-border-accent group/card"
                >
                  <div class="h-16 w-16 shrink-0">
                    <AudioLibraryThumbnail
                      library={{
                        title: item.title,
                        coverImagePath: item.imagePath,
                        isNsfw: isNsfwItem(item),
                        trackCount:
                          typeof item.meta?.trackCount === "number"
                            ? item.meta.trackCount
                            : null,
                      }}
                      aspectClass="h-full w-full"
                      showPlayOverlay={false}
                      gradientIndex={index}
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm text-text-primary">{item.title}</div>
                    {#if item.subtitle}
                      <div class="truncate text-[0.65rem] text-text-muted">
                        {item.subtitle}
                      </div>
                    {/if}
                  </div>
                </a>
              {:else if item.kind === "audio-track"}
                <a
                  href={buildHrefWithFrom(item.href, currentPath)}
                  class="surface-card-sharp flex items-center gap-3 p-2 transition-colors duration-fast hover:border-border-accent group/card"
                >
                  <div class="h-16 w-16 shrink-0">
                    <AudioTrackThumbnail
                      track={{
                        title: item.title,
                        coverImagePath: item.imagePath,
                        isNsfw: isNsfwItem(item),
                        trackNumber:
                          typeof item.meta?.trackNumber === "number"
                            ? item.meta.trackNumber
                            : null,
                      }}
                      aspectClass="h-full w-full"
                      showPlayOverlay={false}
                      gradientIndex={index}
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm text-text-primary">{item.title}</div>
                    {#if item.subtitle}
                      <div class="truncate text-[0.65rem] text-text-muted">
                        {item.subtitle}
                      </div>
                    {/if}
                  </div>
                </a>
              {/if}
            {/each}
          </div>

          {#if hasMore}
            <div class="mt-3 flex justify-center">
              <button
                type="button"
                class={cn(
                  "surface-well flex items-center gap-1.5 px-4 py-1.5 text-[0.72rem] text-text-muted transition-colors duration-fast hover:text-text-primary",
                  loadingMore && "cursor-wait opacity-60",
                )}
                disabled={loadingMore}
                onclick={() => loadMore(group.kind, items.length, total)}
              >
                {#if loadingMore}
                  <Loader2 class="h-3 w-3 animate-spin" />
                {:else}
                  <ChevronDown class="h-3 w-3" />
                {/if}
                Show more ({total - items.length} remaining)
              </button>
            </div>
          {/if}
        </section>
      {/each}

      <div class="py-2 text-center font-mono text-[0.6rem] text-text-disabled">
        {results.durationMs}ms
      </div>
    </div>
  {/if}
</div>
