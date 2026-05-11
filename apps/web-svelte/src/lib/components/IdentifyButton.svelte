<script lang="ts">
  import { Loader2, ScanSearch, AlertCircle, Search, Info } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import {
    fetchInstalledScrapers,
    executePlugin,
    fetchInstalledPlugins,
    fetchStashBoxEndpoints,
    identifyViaStashBox,
    scrapeVideo,
    type InstalledPlugin,
  } from "$lib/api/scrapers";
  import type {
    NormalizedScrapeResult,
    ScrapeResult,
    ScraperPackage,
    StashBoxEndpoint,
    VideoDetail,
  } from "$lib/api/types";
  import { fetchVideoDetail, fetchVideoSeriesLibraryDetail } from "$lib/api/videos";
  import { filterNsfwAware } from "$lib/nsfw/aware-providers";
  import { buildLocalSeasonsInput } from "$lib/identify/identify-video-series-runner";
  import { portal } from "$lib/actions/portal";
  import {
    layoutPlayerMobileFlyout,
    playerFlyoutStyleToString,
  } from "$lib/player/flyout-layout";
  import CascadeReviewDrawer from "./identify/CascadeReviewDrawer.svelte";
  import LegacyVideoReviewDrawer from "./identify/LegacyVideoReviewDrawer.svelte";

  type EntityKind = "video_series" | "video_movie" | "video_episode" | "book";
  type ProviderKind = "plugin" | "stashbox" | "scraper";

  interface IdentifyProvider {
    id: string;
    name: string;
    kind: ProviderKind;
    action?: string | null;
    version?: string | null;
    helper?: string | null;
  }

  interface Props {
    entityKind: EntityKind;
    entityId: string;
    title: string;
    label?: string;
    class?: string;
  }

  let { entityKind, entityId, title, label, class: className }: Props = $props();

  const CAPABILITY_BY_KIND: Record<EntityKind, string[]> = {
    video_series: ["seriesCascade", "seriesByName", "folderByName"],
    video_movie: ["movieByName", "videoByName"],
    video_episode: ["episodeByName", "episodeByFragment", "videoByName"],
    book: ["bookByName", "comicByName", "mangaByName"],
  };
  const ACTION_BY_KIND: Record<EntityKind, string[]> = {
    video_series: ["seriesCascade", "seriesByName", "folderByName"],
    video_movie: ["movieByName", "videoByName"],
    video_episode: ["episodeByName", "episodeByFragment", "videoByName"],
    book: ["bookByName", "comicByName", "mangaByName"],
  };

  let plugins = $state<InstalledPlugin[]>([]);
  let scrapers = $state<ScraperPackage[]>([]);
  let stashBoxEndpoints = $state<StashBoxEndpoint[]>([]);
  let videoDetail = $state<VideoDetail | null>(null);
  let loadingProviders = $state(false);
  let open = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let infoMessage = $state<string | null>(null);
  let drawerOpen = $state<string | null>(null);
  let legacyReview = $state<{
    result: ScrapeResult;
    normalized: NormalizedScrapeResult;
    matchedScraper: string;
  } | null>(null);
  let buttonEl: HTMLButtonElement | undefined = $state();
  let menuStyle = $state<string | null>(null);
  let menuIsWide = $state(false);
  let searchQuery = $state("");
  let searchInputEl: HTMLInputElement | undefined = $state();

  const isVideoEntity = $derived(entityKind !== "video_series" && entityKind !== "book");

  $effect(() => {
    if (
      !open ||
      loadingProviders ||
      plugins.length > 0 ||
      scrapers.length > 0 ||
      stashBoxEndpoints.length > 0
    )
      return;
    loadingProviders = true;
    const detailPromise = isVideoEntity
      ? fetchVideoDetail(entityId).catch(() => null)
      : Promise.resolve(null);
    Promise.all([
      fetchInstalledPlugins(),
      fetchInstalledScrapers(),
      fetchStashBoxEndpoints(),
      detailPromise,
    ])
      .then(([pluginList, scraperRes, stashBoxRes, detail]) => {
        plugins = pluginList.filter((p) => p.enabled);
        scrapers = scraperRes.packages.filter((s) => s.enabled);
        stashBoxEndpoints = stashBoxRes.endpoints.filter((e) => e.enabled);
        videoDetail = detail;
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load identify providers";
      })
      .finally(() => {
        loadingProviders = false;
      });
  });

  // Focus the search field when the flyout opens.
  $effect(() => {
    if (!open) {
      searchQuery = "";
      return;
    }
    queueMicrotask(() => searchInputEl?.focus());
  });

  const visiblePlugins = $derived(filterNsfwAware(plugins));
  const visibleScrapers = $derived(filterNsfwAware(scrapers));
  const visibleStashBoxEndpoints = $derived(filterNsfwAware(stashBoxEndpoints));
  const eligibleCapabilities = $derived(CAPABILITY_BY_KIND[entityKind]);
  const eligiblePlugins = $derived(
    visiblePlugins.filter((p) => {
      const caps = p.capabilities ?? {};
      return eligibleCapabilities.some((key) => !!caps[key]);
    }),
  );
  const supportsLegacyVideoProviders = $derived(entityKind !== "video_series" && entityKind !== "book");
  const eligibleScrapers = $derived(
    supportsLegacyVideoProviders
      ? visibleScrapers.filter((s) => {
          const caps = s.capabilities ?? {};
          return (
            !!caps.sceneByName ||
            !!caps.sceneByURL ||
            !!caps.sceneByFragment ||
            !!caps.sceneByQueryFragment
          );
        })
      : [],
  );
  const eligibleStashBoxEndpoints = $derived(
    supportsLegacyVideoProviders ? visibleStashBoxEndpoints : [],
  );

  const hasPhash = $derived(videoDetail?.fingerprints?.hasPhash ?? null);
  const hasAnyFingerprint = $derived(
    videoDetail
      ? !!(
          videoDetail.fingerprints?.hasPhash ||
          videoDetail.fingerprints?.hasOshash ||
          videoDetail.fingerprints?.hasChecksumMd5
        )
      : null,
  );

  function stashBoxHelper(): string | null {
    if (!isVideoEntity) return null;
    if (!videoDetail) return "fingerprint / title";
    if (!hasPhash && !hasAnyFingerprint) {
      return "no fingerprint · title only";
    }
    if (!hasPhash) {
      return "no phash · oshash/md5/title";
    }
    return "fingerprint / title";
  }

  const allProviderGroups = $derived<
    Array<{ label: string; providers: IdentifyProvider[] }>
  >([
    ...(eligiblePlugins.length > 0
      ? [
          {
            label: "Obscura Plugins",
            providers: eligiblePlugins.map((p) => ({
              id: `plugin:${p.id}`,
              name: p.name,
              kind: "plugin" as const,
              action: actionFor(p),
              version: p.version,
              helper: null,
            })),
          },
        ]
      : []),
    ...(eligibleStashBoxEndpoints.length > 0
      ? [
          {
            label: "Stash-Box",
            providers: eligibleStashBoxEndpoints.map((ep) => ({
              id: `stashbox:${ep.id}`,
              name: ep.name,
              kind: "stashbox" as const,
              action: stashBoxHelper(),
              helper: !hasPhash && hasPhash !== null
                ? "No phash on this video — fingerprint match unavailable"
                : null,
            })),
          },
        ]
      : []),
    ...(eligibleScrapers.length > 0
      ? [
          {
            label: "Community Scrapers",
            providers: eligibleScrapers.map((s) => ({
              id: `scraper:${s.id}`,
              name: s.name,
              kind: "scraper" as const,
              action: "auto",
              version: s.version,
              helper: null,
            })),
          },
        ]
      : []),
  ]);

  const normalizedQuery = $derived(searchQuery.trim().toLowerCase());
  const providerGroups = $derived(
    normalizedQuery
      ? allProviderGroups
          .map((g) => ({
            label: g.label,
            providers: g.providers.filter(
              (p) =>
                p.name.toLowerCase().includes(normalizedQuery) ||
                g.label.toLowerCase().includes(normalizedQuery) ||
                (p.action ?? "").toLowerCase().includes(normalizedQuery),
            ),
          }))
          .filter((g) => g.providers.length > 0)
      : allProviderGroups,
  );

  const eligibleProviderCount = $derived(
    allProviderGroups.reduce((count, group) => count + group.providers.length, 0),
  );
  const filteredProviderCount = $derived(
    providerGroups.reduce((count, group) => count + group.providers.length, 0),
  );

  const defaultLabel = $derived(
    label ??
      (entityKind === "video_movie"
        ? "Identify Movie"
        : entityKind === "book"
          ? "Identify Book"
        : entityKind === "video_series"
          ? "Identify Series"
          : "Re-identify"),
  );

  $effect(() => {
    if (!open) {
      menuStyle = null;
      return;
    }

    buttonEl;

    const mql = window.matchMedia("(min-width: 640px)");
    const runLayout = () => {
      menuIsWide = mql.matches;
      if (!buttonEl) {
        menuStyle = null;
        return;
      }
      const rect = buttonEl.getBoundingClientRect();
      const flyoutLayout = layoutPlayerMobileFlyout(rect, {
        vh: window.innerHeight,
        vw: window.innerWidth,
        maxHeightVh: 0.72,
        gap: 10,
        gutter: 12,
        preferredWidth: 360,
        minWidth: 280,
      });
      if (mql.matches) {
        menuStyle = playerFlyoutStyleToString(flyoutLayout);
      } else {
        menuStyle = playerFlyoutStyleToString({
          ...flyoutLayout,
          left: "12px",
          right: "12px",
          width: undefined,
          minWidth: undefined,
          maxWidth: undefined,
        });
      }
    };

    runLayout();
    const onMql = () => runLayout();
    mql.addEventListener("change", onMql);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", runLayout);
    vv?.addEventListener("scroll", runLayout);
    window.addEventListener("resize", runLayout);
    window.addEventListener("scroll", runLayout, true);
    return () => {
      mql.removeEventListener("change", onMql);
      vv?.removeEventListener("resize", runLayout);
      vv?.removeEventListener("scroll", runLayout);
      window.removeEventListener("resize", runLayout);
      window.removeEventListener("scroll", runLayout, true);
    };
  });

  function actionFor(plugin: InstalledPlugin): string | null {
    const caps = plugin.capabilities ?? {};
    for (const a of ACTION_BY_KIND[entityKind]) {
      if (caps[a]) return a;
    }
    return null;
  }

  function shouldUseLegacyReview(action: string, res: { normalized?: unknown }) {
    return action.startsWith("video") && !!res.normalized;
  }

  function savedScrapeResult(res: { result: unknown }, providerName: string): ScrapeResult {
    const saved = res.result as ScrapeResult | null;
    if (!saved?.id) {
      throw new Error(`${providerName} did not persist a scrape result.`);
    }
    return saved;
  }

  function showLegacyReview(
    result: ScrapeResult,
    normalized: NormalizedScrapeResult,
    matchedScraper: string,
  ) {
    legacyReview = { result, normalized, matchedScraper };
    drawerOpen = null;
    open = false;
  }

  async function runPlugin(plugin: InstalledPlugin) {
    busy = true;
    error = null;
    infoMessage = null;
    try {
      const action = actionFor(plugin);
      if (!action) {
        throw new Error(
          `${plugin.name} does not advertise a ${entityKind} lookup capability.`,
        );
      }
      let pluginInput: Record<string, unknown> = { title, name: title };
      if (entityKind === "video_series") {
        try {
          const detail = await fetchVideoSeriesLibraryDetail(entityId);
          const extra = buildLocalSeasonsInput(detail);
          if (extra) pluginInput = { ...pluginInput, ...extra };
        } catch {
          // non-fatal
        }
      }

      const res = await executePlugin(plugin.id, action, pluginInput, {
        saveResult: true,
        entityId,
      });
      if (!res.ok) throw new Error(`${plugin.name} returned no result.`);
      const saved = savedScrapeResult(res, plugin.name);
      if (shouldUseLegacyReview(action, res)) {
        showLegacyReview(saved, res.normalized as NormalizedScrapeResult, plugin.name);
      } else {
        drawerOpen = saved.id;
        legacyReview = null;
        open = false;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Identify failed";
    } finally {
      busy = false;
    }
  }

  async function runStashBox(endpoint: StashBoxEndpoint) {
    busy = true;
    error = null;
    infoMessage = null;
    try {
      const res = await identifyViaStashBox(endpoint.id, entityId);
      if (!res.result || !res.normalized) {
        const tried = res.triedMethods?.length
          ? ` Tried: ${res.triedMethods.join(" → ")}.`
          : "";
        infoMessage = `${endpoint.name}: ${res.message ?? "No results found."}${tried}`;
        return;
      }
      showLegacyReview(res.result, res.normalized, endpoint.name);
    } catch (err) {
      error = err instanceof Error ? err.message : "Identify failed";
    } finally {
      busy = false;
    }
  }

  async function runScraper(scraper: ScraperPackage) {
    busy = true;
    error = null;
    infoMessage = null;
    try {
      const video = await fetchVideoDetail(entityId);
      const res = await scrapeVideo(scraper.id, entityId, "auto", {
        url: video.url ?? undefined,
      });
      if (!res.result || !res.normalized) {
        const tried = res.triedActions?.length
          ? ` Tried: ${res.triedActions.join(" → ")}.`
          : "";
        infoMessage = `${scraper.name}: ${res.message ?? "No results found."}${tried}`;
        return;
      }
      showLegacyReview(res.result, res.normalized, scraper.name);
    } catch (err) {
      error = err instanceof Error ? err.message : "Identify failed";
    } finally {
      busy = false;
    }
  }

  async function runProvider(provider: IdentifyProvider) {
    const realId = provider.id.replace(/^(plugin|stashbox|scraper):/, "");
    if (provider.kind === "plugin") {
      const plugin = eligiblePlugins.find((p) => p.id === realId);
      if (plugin) await runPlugin(plugin);
      return;
    }
    if (provider.kind === "stashbox") {
      const endpoint = eligibleStashBoxEndpoints.find((ep) => ep.id === realId);
      if (endpoint) await runStashBox(endpoint);
      return;
    }
    const scraper = eligibleScrapers.find((s) => s.id === realId);
    if (scraper) await runScraper(scraper);
  }

  async function reloadAfterAccepted() {
    legacyReview = null;
    drawerOpen = null;
    if (typeof window !== "undefined") window.location.reload();
  }

  function providerEmptyMessage() {
    if (entityKind === "video_series") {
      return "Install an enabled series-capable Obscura plugin and try again.";
    }
    if (entityKind === "book") {
      return "Install an enabled book-capable Obscura plugin and try again.";
    }
    return "Install an enabled Obscura plugin, Stash-Box endpoint, or community scraper and try again.";
  }

  function entityKindReadable(kind: EntityKind): string {
    if (kind === "video_movie") return "movie";
    if (kind === "video_series") return "series";
    if (kind === "book") return "book";
    return "episode";
  }
</script>

<div class={cn("relative", className)}>
  <button
    type="button"
    bind:this={buttonEl}
    onclick={() => (open = !open)}
    disabled={busy}
    class={cn(
      "flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors surface-card",
      "hover:border-border-accent",
      busy && "opacity-50 cursor-not-allowed",
    )}
    title={defaultLabel}
  >
    {#if busy}
      <Loader2 class="h-3.5 w-3.5 animate-spin" />
    {:else}
      <ScanSearch class="h-3.5 w-3.5" />
    {/if}
    {defaultLabel}
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div use:portal class="fixed inset-0 z-[170]" onclick={() => (open = false)}></div>
    <div
      use:portal
      class={cn(
        "fixed z-[180] flex flex-col player-dropdown overscroll-contain",
        menuIsWide && "min-w-[280px] max-w-[360px]",
        menuStyle ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      style={menuStyle ?? undefined}
    >
      <!-- Sticky header: title + search + alerts -->
      <div class="flex flex-col border-b border-white/10">
        <div class="px-3 pt-2 pb-1 text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
          Identify from
        </div>
        {#if eligibleProviderCount > 0}
          <div class="relative px-2 pb-2">
            <Search
              class="pointer-events-none absolute left-3.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted"
            />
            <input
              bind:this={searchInputEl}
              type="text"
              bind:value={searchQuery}
              placeholder="Search providers…"
              class="w-full border border-white/10 bg-black/30 pl-7 pr-2 py-1.5 text-[0.72rem] text-text-primary placeholder:text-text-muted/70 focus:outline-none focus:border-border-accent"
              onkeydown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  if (searchQuery) searchQuery = "";
                  else open = false;
                }
              }}
            />
          </div>
        {/if}
        {#if error}
          <div
            class="mx-2 mb-2 flex items-start gap-1.5 border border-status-error/30 bg-status-error/10 px-2 py-1.5 text-[0.68rem] text-status-error-text"
          >
            <AlertCircle class="h-3 w-3 flex-shrink-0 mt-[1px]" />
            <span class="min-w-0">{error}</span>
          </div>
        {/if}
        {#if infoMessage}
          <div
            class="mx-2 mb-2 flex items-start gap-1.5 border border-white/15 bg-white/5 px-2 py-1.5 text-[0.68rem] text-text-muted"
          >
            <Info class="h-3 w-3 flex-shrink-0 mt-[1px]" />
            <span class="min-w-0">{infoMessage}</span>
          </div>
        {/if}
      </div>

      <!-- Scrollable provider list -->
      <div class="min-h-0 flex-1 overflow-y-auto py-1">
        {#if loadingProviders}
          <div class="flex items-center gap-2 px-3 py-2 text-[0.7rem] text-text-muted">
            <Loader2 class="h-3 w-3 animate-spin" /> Loading providers…
          </div>
        {/if}
        {#if !loadingProviders && eligibleProviderCount === 0}
          <div class="flex items-start gap-2 px-3 py-2 text-[0.7rem] text-text-muted">
            <AlertCircle class="h-3 w-3 flex-shrink-0 mt-[1px]" />
            <span>
              No enabled provider supports
              <code class="font-mono text-text-accent">{entityKindReadable(entityKind)}</code>
              lookup. {providerEmptyMessage()}
            </span>
          </div>
        {/if}
        {#if !loadingProviders && eligibleProviderCount > 0 && filteredProviderCount === 0}
          <div class="px-3 py-2 text-[0.7rem] text-text-muted">
            No providers match
            <span class="font-mono text-text-accent">"{searchQuery}"</span>.
          </div>
        {/if}
        {#if !loadingProviders}
          {#each providerGroups as group (group.label)}
            <div class="px-3 pb-1 pt-2 text-[0.56rem] uppercase tracking-[0.14em] text-text-disabled">
              {group.label}
            </div>
            {#each group.providers as provider (provider.id)}
              <button
                type="button"
                onclick={() => void runProvider(provider)}
                disabled={busy}
                class="w-full px-3 py-1.5 text-left text-[0.72rem] text-text-muted hover:text-text-primary hover:bg-white/8 transition-colors"
              >
                <div class="truncate font-medium text-text-primary">{provider.name}</div>
                <div class="truncate text-[0.6rem] text-text-disabled">
                  {provider.action ?? "—"}
                  {provider.version ? ` · ${provider.version}` : ""}
                </div>
                {#if provider.helper}
                  <div class="mt-0.5 flex items-start gap-1 text-[0.58rem] text-amber-300/85">
                    <Info class="h-2.5 w-2.5 flex-shrink-0 mt-[1px]" />
                    <span class="truncate">{provider.helper}</span>
                  </div>
                {/if}
              </button>
            {/each}
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if drawerOpen && entityKind !== "book"}
  <CascadeReviewDrawer
    scrapeResultId={drawerOpen}
    {entityKind}
    {entityId}
    label={title}
    onAccepted={reloadAfterAccepted}
    onClose={() => (drawerOpen = null)}
  />
{/if}

{#if legacyReview}
  <LegacyVideoReviewDrawer
    result={legacyReview.result}
    normalized={legacyReview.normalized}
    matchedScraper={legacyReview.matchedScraper}
    onAccepted={reloadAfterAccepted}
    onRejected={() => (legacyReview = null)}
    onClose={() => (legacyReview = null)}
  />
{/if}
