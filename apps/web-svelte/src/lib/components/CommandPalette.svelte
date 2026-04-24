<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { Search, X, Clock, ArrowRight, Trash2 } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { SearchResponseDto, SearchResultItem } from "@obscura/contracts";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import SeriesThumbnail from "$lib/components/thumbnails/SeriesThumbnail.svelte";
  import GalleryThumbnail from "$lib/components/thumbnails/GalleryThumbnail.svelte";
  import ImageThumbnail from "$lib/components/thumbnails/ImageThumbnail.svelte";
  import PerformerThumbnail from "$lib/components/thumbnails/PerformerThumbnail.svelte";
  import StudioThumbnail from "$lib/components/thumbnails/StudioThumbnail.svelte";
  import TagThumbnail from "$lib/components/thumbnails/TagThumbnail.svelte";
  import AudioLibraryThumbnail from "$lib/components/thumbnails/AudioLibraryThumbnail.svelte";
  import AudioTrackThumbnail from "$lib/components/thumbnails/AudioTrackThumbnail.svelte";
  import type { VideoCardData } from "$lib/video-card-data";
  import { useSearch } from "$lib/stores/search.svelte";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import { entityTerms } from "$lib/terminology";
  import { fetchSearch } from "$lib/api/media";
  import { recentSearches } from "$lib/hooks/recent-searches.svelte";
  import { SEARCH_KIND_CONFIG } from "./search-kind-config";
  import { toApiUrl } from "$lib/api/core";
  import { buildHrefWithFrom } from "$lib/back-navigation";

  const search = useSearch();
  const nsfw = useNsfw();
  const recent = recentSearches();

  let query = $state("");
  let results = $state<SearchResponseDto | null>(null);
  let loading = $state(false);
  let inputRef = $state<HTMLInputElement | null>(null);

  let activeRequest = 0;
  const currentPath = $derived(`${page.url.pathname}${page.url.search}`);
  const open = $derived(search.open);
  const hasQuery = $derived(query.trim().length >= 2);
  const hasResults = $derived(
    results != null && results.groups.some((group) => group.items.length > 0),
  );

  function closePalette() {
    search.closePalette();
  }

  function clearQuery() {
    query = "";
    results = null;
    loading = false;
  }

  async function runSearch(term: string) {
    const trimmed = term.trim();
    const requestId = ++activeRequest;

    if (trimmed.length < 2) {
      results = null;
      loading = false;
      return;
    }

    loading = true;
    try {
      const data = await fetchSearch({
        q: trimmed,
        limit: 6,
        nsfw: nsfw.mode,
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
  }

  function navigateTo(href: string) {
    const trimmed = query.trim();
    if (trimmed) recent.add(trimmed);
    closePalette();
    void goto(buildHrefWithFrom(href, currentPath));
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

  function submitSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    recent.add(trimmed);
    closePalette();
    void goto(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  $effect(() => {
    if (!open) {
      query = "";
      results = null;
      loading = false;
      activeRequest += 1;
      return;
    }

    if (browser) {
      requestAnimationFrame(() => inputRef?.focus());
    }
  });

  $effect(() => {
    if (!browser || !open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  });

  $effect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      results = null;
      loading = false;
      activeRequest += 1;
      return;
    }

    loading = true;
    const timer = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  });
</script>

{#if open}
  <div class="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] sm:pt-[10vh]">
    <button
      type="button"
      class="absolute inset-0 bg-black/60 backdrop-blur-sm"
      aria-label="Close search"
      onclick={closePalette}
    ></button>

    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      class={cn(
        "relative mx-4 flex max-h-[70vh] w-full max-w-2xl flex-col",
        "surface-elevated border border-border-subtle shadow-2xl",
      )}
    >
      <div class="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
        <Search class="h-4 w-4 shrink-0 text-text-muted" />
        <input
          bind:this={inputRef}
          bind:value={query}
          type="text"
          placeholder={`Search ${entityTerms.videos.toLowerCase()}, ${entityTerms.performers.toLowerCase()}, ${entityTerms.studios.toLowerCase()}, ${entityTerms.tags.toLowerCase()}...`}
          class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled focus:outline-none"
          onkeydown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitSearch();
            }
          }}
        />
        {#if query}
          <button
            type="button"
            class="text-text-disabled transition-colors duration-fast hover:text-text-muted"
            aria-label="Clear search"
            onclick={clearQuery}
          >
            <X class="h-3.5 w-3.5" />
          </button>
        {/if}
        <kbd class="kbd hidden shrink-0 text-text-disabled sm:inline-flex">ESC</kbd>
      </div>

      <div class="flex-1 overflow-y-auto">
        {#if !hasQuery}
          {#if recent.value.length === 0}
            <div class="px-4 py-8 text-center">
              <Search class="mx-auto mb-2 h-5 w-5 text-text-disabled opacity-50" />
              <div class="text-sm text-text-disabled">Start typing to search...</div>
            </div>
          {:else}
            <div class="py-1">
              <div class="flex items-center justify-between px-4 py-1.5">
                <span class="text-kicker">Recent Searches</span>
                <button
                  type="button"
                  class="flex items-center gap-1 text-[0.6rem] text-text-disabled transition-colors duration-fast hover:text-text-muted"
                  onclick={recent.clear}
                >
                  <Trash2 class="h-2.5 w-2.5" />
                  Clear
                </button>
              </div>
              {#each recent.value as previousQuery (previousQuery)}
                <div class="group flex items-center gap-2 px-4 py-1.5 transition-colors duration-fast hover:bg-surface-2">
                  <Clock class="h-3.5 w-3.5 shrink-0 text-text-disabled" />
                  <button
                    type="button"
                    class="flex-1 truncate text-left text-sm text-text-muted group-hover:text-text-primary"
                    onclick={() => {
                      query = previousQuery;
                    }}
                  >
                    {previousQuery}
                  </button>
                  <button
                    type="button"
                    class="opacity-0 transition-all duration-fast group-hover:opacity-100 text-text-disabled hover:text-text-muted"
                    onclick={() => recent.remove(previousQuery)}
                    aria-label={`Remove ${previousQuery}`}
                  >
                    <X class="h-3 w-3" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        {:else if loading && !results}
          <div class="px-4 py-8 text-center">
            <div class="text-sm text-text-disabled">Searching...</div>
          </div>
        {:else if results && !hasResults && !loading}
          <div class="px-4 py-8 text-center">
            <div class="text-sm text-text-disabled">No results for "{query}"</div>
          </div>
        {:else if results && hasResults}
          <div class="py-1">
            {#each results.groups.filter((group) => group.items.length > 0) as group (group.kind)}
              <div class="py-1">
                <div class="flex items-center justify-between px-4 py-1.5">
                  <span class="text-kicker">{group.label}</span>
                  <span class="text-[0.6rem] text-text-disabled">{group.total}</span>
                </div>
                {#each group.items as item, itemIndex (item.id)}
                  {#if item.kind === "video"}
                    <VideoCard
                      video={videoSearchItemToCardData(item)}
                      variant="compact"
                      index={itemIndex}
                      onSelect={navigateTo}
                    />
                  {:else}
                    {@const Icon = SEARCH_KIND_CONFIG[item.kind]?.icon}
                    <button
                      type="button"
                      class="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-fast hover:bg-surface-2"
                      onclick={() => navigateTo(item.href)}
                    >
                      <div
                        class={cn(
                          "flex shrink-0 items-center justify-center overflow-hidden bg-surface-1",
                          item.kind === "performer"
                            ? "h-8 w-8"
                            : item.kind === "video-series" || item.kind === "gallery"
                              ? "h-10 w-7"
                              : "h-8 w-8",
                        )}
                      >
                        {#if item.kind === "video-series"}
                          <SeriesThumbnail
                            title={item.title}
                            coverImagePath={item.imagePath}
                            isNsfw={item.meta?.isNsfw === true}
                            videoCount={typeof item.meta?.videoCount === "number"
                              ? item.meta.videoCount
                              : null}
                            showCount={false}
                            class="h-full w-full"
                          />
                        {:else if item.kind === "gallery"}
                          <GalleryThumbnail
                            title={item.title}
                            coverImagePath={item.imagePath}
                            imageCount={typeof item.meta?.imageCount === "number"
                              ? item.meta.imageCount
                              : null}
                            isNsfw={item.meta?.isNsfw === true}
                            size="compact"
                            aspectClass="h-full w-full"
                            showCount={false}
                          />
                        {:else if item.kind === "image"}
                          <ImageThumbnail
                            title={item.title}
                            thumbnailPath={item.imagePath}
                            previewPath={typeof item.meta?.previewPath === "string"
                              ? item.meta.previewPath
                              : null}
                            isVideo={typeof item.meta?.previewPath === "string" && !!item.meta.previewPath}
                            isNsfw={item.meta?.isNsfw === true}
                            size="compact"
                            aspectClass="h-full w-full"
                            showChips={false}
                          />
                        {:else if item.kind === "performer"}
                          <PerformerThumbnail
                            performer={{
                              name: item.title,
                              imagePath: item.imagePath,
                              isNsfw: item.meta?.isNsfw === true,
                              videoCount: typeof item.meta?.videoCount === "number" ? item.meta.videoCount : 0,
                              seriesCount: typeof item.meta?.seriesCount === "number" ? item.meta.seriesCount : 0,
                              galleryCount: typeof item.meta?.galleryCount === "number" ? item.meta.galleryCount : 0,
                              imageCount: typeof item.meta?.imageCount === "number" ? item.meta.imageCount : 0,
                              audioLibraryCount: typeof item.meta?.audioLibraryCount === "number" ? item.meta.audioLibraryCount : 0,
                              audioTrackCount: typeof item.meta?.audioTrackCount === "number" ? item.meta.audioTrackCount : 0,
                            }}
                            compact
                            showChips={false}
                            class="h-full w-full"
                          />
                        {:else if item.kind === "studio"}
                          <StudioThumbnail
                            studio={{
                              name: item.title,
                              imagePath: item.imagePath,
                              isNsfw: item.meta?.isNsfw === true,
                            }}
                            size="compact"
                            aspectClass="h-full w-full"
                            showChips={false}
                          />
                        {:else if item.kind === "tag"}
                          <TagThumbnail
                            tag={{
                              name: item.title,
                              imagePath: item.imagePath,
                              isNsfw: item.meta?.isNsfw === true,
                            }}
                            size="compact"
                            aspectClass="h-full w-full"
                            showLabel={false}
                          />
                        {:else if item.kind === "audio-library"}
                          <AudioLibraryThumbnail
                            library={{
                              title: item.title,
                              coverImagePath: item.imagePath,
                              isNsfw: item.meta?.isNsfw === true,
                            }}
                            size="compact"
                            aspectClass="h-full w-full"
                            showChips={false}
                            showPlayOverlay={false}
                          />
                        {:else if item.kind === "audio-track"}
                          <AudioTrackThumbnail
                            track={{
                              title: item.title,
                              coverImagePath: item.imagePath,
                              isNsfw: item.meta?.isNsfw === true,
                            }}
                            size="compact"
                            aspectClass="h-full w-full"
                            showChips={false}
                            showPlayOverlay={false}
                          />
                        {:else if item.imagePath}
                          <img src={toApiUrl(item.imagePath)} alt="" class="h-full w-full object-cover" />
                        {:else if Icon}
                          <Icon class="h-3.5 w-3.5 text-text-disabled" />
                        {/if}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-sm text-text-primary">{item.title}</div>
                        {#if item.subtitle}
                          <div class="truncate text-[0.68rem] text-text-muted">{item.subtitle}</div>
                        {/if}
                      </div>
                      <span class="tag-chip tag-chip-default shrink-0 text-[0.6rem]">
                        {SEARCH_KIND_CONFIG[item.kind]?.label ?? item.kind}
                      </span>
                    </button>
                  {/if}
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if hasQuery}
        <div class="flex items-center justify-between border-t border-border-subtle px-4 py-2">
          <button
            type="button"
            class="flex items-center gap-1.5 text-[0.72rem] text-text-muted transition-colors duration-fast hover:text-text-accent"
            onclick={submitSearch}
          >
            <span>See all results</span>
            <ArrowRight class="h-3 w-3" />
          </button>
          <span class="font-mono text-[0.6rem] text-text-disabled">
            {loading ? "..." : `${results?.durationMs ?? 0}ms`}
          </span>
        </div>
      {/if}
    </div>
  </div>
{/if}
