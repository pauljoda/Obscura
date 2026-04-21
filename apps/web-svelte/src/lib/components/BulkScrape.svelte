<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    Check,
    Loader2,
    ScanSearch,
    Play,
    Square,
    SkipForward,
    Film,
    FolderOpen,
    Images,
    Image,
    Library,
    Music,
    Users,
    Building2,
    Tag,
    Fingerprint,
  } from "@lucide/svelte";
  import { Checkbox, cn } from "@obscura/ui-svelte";
  import { fetchVideos } from "$lib/api/videos";
  import {
    fetchAllPerformers,
  } from "$lib/api/entities";
  import { fetchStudios, fetchTags } from "$lib/api/entities";
  import {
    fetchInstalledScrapers,
    fetchStashBoxEndpoints,
    fetchInstalledPlugins,
    type InstalledPlugin,
  } from "$lib/api/scrapers";
  import { fetchSeries } from "$lib/api/videos";
  import {
    fetchGalleries,
    fetchImages,
    fetchAudioLibraries,
  } from "$lib/api/media";
  import type {
    VideoRow,
    PerformerRow,
    StudioRow,
    TagRow,
    Provider,
    ScraperPackage,
    StashBoxEndpoint,
    VideoListItem,
    PerformerItem,
    StudioItem,
    TagItem,
    Tab,
  } from "$lib/identify/scrape-types";
  import { VIDEO_FIELDS, tabEntityLabel } from "$lib/identify/scrape-types";
  import type {
    VideoSeriesRow,
    GalleryRow,
    ImageRow,
    AudioLibraryRow,
    AudioTrackRow,
  } from "$lib/identify/identify-types";
  import {
    VIDEO_SERIES_FIELDS,
    GALLERY_FIELDS,
    IMAGE_FIELDS,
    AUDIO_LIBRARY_FIELDS,
    AUDIO_TRACK_FIELDS,
  } from "$lib/identify/identify-types";
  import {
    runVideoScrape,
    seekVideoSingle,
    acceptAllVideos,
  } from "$lib/identify/scrape-videos-runner";
  import { runPerformerScrape, acceptAllPerformers } from "$lib/identify/scrape-performers-runner";
  import { runStudioScrape, acceptAllStudios } from "$lib/identify/scrape-studios-runner";
  import { runTagScrape, acceptAllTags } from "$lib/identify/scrape-tags-runner";
  import {
    runVideoSeriesIdentify,
    seekSeriesSingle,
    acceptAllVideoSeries,
  } from "$lib/identify/identify-video-series-runner";
  import {
    runAudioLibraryIdentify,
    seekAudioLibrarySingle,
    acceptAllAudioLibraries,
    runAudioTrackIdentify,
    seekAudioTrackSingle,
    acceptAllAudioTracks,
    runGalleryIdentify,
    seekGallerySingle,
    acceptAllGalleries,
    runImageIdentify,
    seekImageSingle,
    acceptAllImages,
    type MutableFlag,
  } from "$lib/identify/identify-runners";
  import { entityTerms } from "$lib/terminology";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import { filterNsfwAware } from "$lib/hooks/nsfw-aware-providers";
  import ProviderSelector from "./ProviderSelector.svelte";
  import VideosTab from "./scrape/VideosTab.svelte";
  import PerformersTab from "./scrape/PerformersTab.svelte";
  import StudiosTab from "./scrape/StudiosTab.svelte";
  import TagsTab from "./scrape/TagsTab.svelte";
  import PhashesTab from "./scrape/PhashesTab.svelte";
  import VideoSeriesTab from "./identify/VideoSeriesTab.svelte";
  import GalleriesTab from "./identify/GalleriesTab.svelte";
  import ImagesTab from "./identify/ImagesTab.svelte";
  import AudioLibrariesTab from "./identify/AudioLibrariesTab.svelte";
  import AudioTracksTab from "./identify/AudioTracksTab.svelte";

  const nsfw = useNsfw();

  let tab = $state<Tab>("videos");
  let stashBoxEndpoints = $state<StashBoxEndpoint[]>([]);
  let loading = $state(true);

  let videoRows = $state<VideoRow[]>([]);
  let videoScrapers = $state<ScraperPackage[]>([]);
  let perfRows = $state<PerformerRow[]>([]);
  let perfScrapers = $state<ScraperPackage[]>([]);
  let plugins = $state<InstalledPlugin[]>([]);
  let studioRows = $state<StudioRow[]>([]);
  let tagRows = $state<TagRow[]>([]);
  let seriesRows = $state<VideoSeriesRow[]>([]);
  let galleryRows = $state<GalleryRow[]>([]);
  let imageRows = $state<ImageRow[]>([]);
  let audioLibraryRows = $state<AudioLibraryRow[]>([]);
  let audioTrackRows = $state<AudioTrackRow[]>([]);

  let allVideos = $state<VideoListItem[]>([]);
  let allPerformers = $state<PerformerItem[]>([]);
  let videoTotalAvailable = $state(0);
  let performerTotalAvailable = $state(0);
  let loadingMoreVideos = $state(false);
  let loadingMorePerformers = $state(false);
  let allStudios = $state<StudioItem[]>([]);
  let allTags = $state<TagItem[]>([]);

  let running = $state(false);
  let autoAccept = $state(false);
  let selectedScraperId = $state<string>("");
  let showAll = $state(false);
  const abortRef: MutableFlag = { current: false };
  let expandedIds = $state<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedIds = next;
  }

  function expandAll() {
    if (tab === "videos") expandedIds = new Set(videoRows.map((r) => r.video.id));
    else if (tab === "video-series") expandedIds = new Set(seriesRows.map((r) => r.series.id));
    else if (tab === "galleries") expandedIds = new Set(galleryRows.map((r) => r.gallery.id));
    else if (tab === "images") expandedIds = new Set(imageRows.map((r) => r.image.id));
    else if (tab === "audio-libraries") expandedIds = new Set(audioLibraryRows.map((r) => r.library.id));
    else if (tab === "audio-tracks") expandedIds = new Set(audioTrackRows.map((r) => r.track.id));
    else if (tab === "performers") expandedIds = new Set(perfRows.map((r) => r.performer.id));
    else if (tab === "studios") expandedIds = new Set(studioRows.map((r) => r.studio.id));
    else if (tab === "tags") expandedIds = new Set(tagRows.map((r) => r.tag.id));
  }

  function collapseAll() {
    expandedIds = new Set();
  }

  async function loadData() {
    loading = true;
    try {
      const [
        videosRes,
        perfRes,
        studiosRes,
        tagsRes,
        scrapersRes,
        stashBoxRes,
        seriesRes,
        galleriesRes,
        imagesRes,
        audioRes,
        pluginsRes,
      ] = await Promise.all([
        fetchVideos({ sort: "created_at", nsfw: nsfw.mode, limit: 500, offset: 0 }),
        fetchAllPerformers({ sort: "name", order: "asc" }),
        fetchStudios(),
        fetchTags(),
        fetchInstalledScrapers(),
        fetchStashBoxEndpoints().catch(() => ({ endpoints: [] as StashBoxEndpoint[] })),
        fetchSeries({ root: "all", limit: 500, nsfw: nsfw.mode }).catch(() => ({
          items: [],
          total: 0,
          limit: 500,
          offset: 0,
        })),
        fetchGalleries({}).catch(() => ({ galleries: [], total: 0, limit: 100, offset: 0 })),
        fetchImages({}).catch(() => ({ images: [], total: 0, limit: 100, offset: 0 })),
        fetchAudioLibraries({}).catch(() => ({ items: [], total: 0 })),
        fetchInstalledPlugins().catch(() => [] as InstalledPlugin[]),
      ]);

      stashBoxEndpoints = stashBoxRes.endpoints.filter((e) => e.enabled);

      const unorganized = videosRes.videos.filter((video) => !video.organized);
      videoRows = unorganized.map((video) => ({
        video,
        status: "pending",
        selectedFields: new Set(VIDEO_FIELDS),
        excludedPerformers: new Set(),
        excludedTags: new Set(),
      }));

      const sparse = perfRes.performers.filter((p) => !p.imagePath || !p.gender);
      perfRows = sparse.map((performer) => ({
        performer,
        status: "pending",
        selectedFields: new Set<string>(),
      }));

      const sparseStudios = studiosRes.studios.filter((s) => !s.url || !s.imageUrl);
      studioRows = sparseStudios.map((studio) => ({
        studio,
        status: "pending",
        selectedFields: new Set<string>(),
      }));

      tagRows = tagsRes.tags.map((tag) => ({
        tag,
        status: "pending",
        selectedFields: new Set<string>(),
      }));

      allVideos = videosRes.videos;
      videoTotalAvailable = videosRes.total;
      allPerformers = perfRes.performers;
      performerTotalAvailable = perfRes.total;
      allStudios = studiosRes.studios;
      allTags = tagsRes.tags;

      const enabled = scrapersRes.packages.filter((s) => s.enabled);
      videoScrapers = enabled.filter((pkg) => {
        const caps = pkg.capabilities as Record<string, boolean> | null;
        return (
          caps &&
          (caps.sceneByURL || caps.sceneByFragment || caps.sceneByName || caps.sceneByQueryFragment)
        );
      });
      perfScrapers = enabled.filter((pkg) => {
        const caps = pkg.capabilities as Record<string, boolean> | null;
        return (
          caps && (caps.performerByURL || caps.performerByName || caps.performerByFragment)
        );
      });
      plugins = pluginsRes.filter((p) => p.enabled);

      const libraryRootSeriesIds = new Set(
        seriesRes.items
          .filter((series) => series.relativePath === ".")
          .map((series) => series.id),
      );
      const contentSeries = seriesRes.items.filter((series) => {
        if (libraryRootSeriesIds.has(series.id)) return false;
        if (series.parentId && libraryRootSeriesIds.has(series.parentId)) return true;
        if (!series.parentId) return true;
        return false;
      });
      seriesRows = contentSeries.map((series) => ({
        series,
        status: "pending",
        selectedFields: new Set(VIDEO_SERIES_FIELDS),
        wizardStep: "idle",
      }));
      galleryRows = galleriesRes.galleries.map((gallery) => ({
        gallery,
        status: "pending",
        selectedFields: new Set(GALLERY_FIELDS),
      }));
      imageRows = imagesRes.images
        .filter((img) => !img.organized)
        .map((image) => ({
          image,
          status: "pending",
          selectedFields: new Set(IMAGE_FIELDS),
        }));
      audioLibraryRows = audioRes.items.map((library) => ({
        library,
        status: "pending",
        selectedFields: new Set(AUDIO_LIBRARY_FIELDS),
      }));
      // Audio tracks: the React orchestrator only fetches libraries; individual
      // tracks populate when plugins drive them — start empty.
      audioTrackRows = [];
      void AUDIO_TRACK_FIELDS;
    } finally {
      loading = false;
    }
  }

  async function loadMoreVideos() {
    if (loadingMoreVideos || allVideos.length >= videoTotalAvailable) return;
    loadingMoreVideos = true;
    try {
      const res = await fetchVideos({
        sort: "created_at",
        nsfw: nsfw.mode,
        limit: 500,
        offset: allVideos.length,
      });
      if (res.videos.length === 0) return;
      const seen = new Set(allVideos.map((v) => v.id));
      allVideos = [...allVideos, ...res.videos.filter((v) => !seen.has(v.id))];
      videoTotalAvailable = res.total;
    } finally {
      loadingMoreVideos = false;
    }
  }

  async function loadMorePerformers() {
    if (loadingMorePerformers || allPerformers.length >= performerTotalAvailable) return;
    loadingMorePerformers = true;
    try {
      const res = await fetchAllPerformers({
        sort: "name",
        order: "asc",
      });
      if (res.performers.length === 0) return;
      allPerformers = res.performers;
      performerTotalAvailable = res.total;
    } finally {
      loadingMorePerformers = false;
    }
  }

  onMount(() => {
    void loadData();
  });

  // Rebuild rows when showAll toggles or when the source arrays change.
  // The existing row snapshots are read via `untrack` so writing the new
  // arrays does not re-trigger this effect (which would be an infinite
  // loop — Svelte 5 $effect re-runs on any tracked state it reads).
  $effect(() => {
    void showAll;
    void allVideos;
    void allPerformers;
    void allStudios;
    void allTags;
    if (!allVideos.length && !allPerformers.length && !allStudios.length && !allTags.length)
      return;

    untrack(() => {
      const filteredVideos = showAll
        ? allVideos
        : allVideos.filter((video) => !video.organized);
      const existingVideo = new Map(videoRows.map((r) => [r.video.id, r]));
      videoRows = filteredVideos.map(
        (video) =>
          existingVideo.get(video.id) ?? {
            video,
            status: "pending",
            selectedFields: new Set(VIDEO_FIELDS),
            excludedPerformers: new Set(),
            excludedTags: new Set(),
          },
      );

      const filteredPerfs = showAll
        ? allPerformers
        : allPerformers.filter((p) => !p.imagePath || !p.gender);
      const existingPerf = new Map(perfRows.map((r) => [r.performer.id, r]));
      perfRows = filteredPerfs.map(
        (performer) =>
          existingPerf.get(performer.id) ?? {
            performer,
            status: "pending",
            selectedFields: new Set(),
          },
      );

      const filteredStudios = showAll
        ? allStudios
        : allStudios.filter((s) => !s.url || !s.imageUrl);
      const existingStudio = new Map(studioRows.map((r) => [r.studio.id, r]));
      studioRows = filteredStudios.map(
        (studio) =>
          existingStudio.get(studio.id) ?? {
            studio,
            status: "pending",
            selectedFields: new Set(),
          },
      );

      const existingTag = new Map(tagRows.map((r) => [r.tag.id, r]));
      tagRows = allTags.map(
        (tagItem) =>
          existingTag.get(tagItem.id) ?? {
            tag: tagItem,
            status: "pending",
            selectedFields: new Set(),
          },
      );
    });
  });

  const rows = $derived(
    tab === "videos"
      ? videoRows
      : tab === "video-series"
        ? seriesRows
        : tab === "galleries"
          ? galleryRows
          : tab === "images"
            ? imageRows
            : tab === "audio-libraries"
              ? audioLibraryRows
              : tab === "audio-tracks"
                ? audioTrackRows
                : tab === "performers"
                  ? perfRows
                  : tab === "studios"
                    ? studioRows
                    : tab === "tags"
                      ? tagRows
                      : [],
  );
  const foundCount = $derived(rows.filter((r) => r.status === "found").length);
  const acceptedCount = $derived(rows.filter((r) => r.status === "accepted").length);
  const missedCount = $derived(
    rows.filter((r) => r.status === "no-result" || r.status === "error").length,
  );
  const processedCount = $derived(
    rows.filter((r) => r.status !== "pending" && r.status !== "scraping").length,
  );
  const totalCount = $derived(rows.length);

  const scrapersForTab = $derived(
    filterNsfwAware(tab === "videos" ? videoScrapers : tab === "performers" ? perfScrapers : []),
  );
  const nsfwAwarePlugins = $derived(filterNsfwAware(plugins));
  const nsfwAwareStashBoxEndpoints = $derived(filterNsfwAware(stashBoxEndpoints));

  const pluginsForTab = $derived(
    nsfwAwarePlugins.filter((p) => {
      const caps = p.capabilities ?? {};
      switch (tab) {
        case "videos":
          return caps.videoByURL || caps.videoByName || caps.videoByFragment;
        case "video-series":
          return caps.folderByName || caps.folderByFragment || caps.folderCascade;
        case "galleries":
          return caps.galleryByURL || caps.galleryByFragment;
        case "images":
          return caps.imageByURL;
        case "audio-libraries":
          return caps.audioLibraryByName;
        case "audio-tracks":
          return caps.audioByURL || caps.audioByFragment;
        case "performers":
          return caps.performerByURL || caps.performerByName || caps.performerByFragment;
        default:
          return false;
      }
    }),
  );

  const providersForTab = $derived<Provider[]>([
    ...nsfwAwareStashBoxEndpoints.map((ep) => ({
      id: `stashbox:${ep.id}`,
      name: ep.name,
      type: "stashbox" as const,
    })),
    ...pluginsForTab.map((p) => ({
      id: `plugin:${p.id}`,
      name: p.name,
      type: "scraper" as const,
    })),
    ...scrapersForTab.map((s) => ({
      id: `scraper:${s.id}`,
      name: s.name,
      type: "scraper" as const,
    })),
  ]);
  const totalProviderCount = $derived(providersForTab.length);

  function pluginListForSeek() {
    if (selectedScraperId.startsWith("plugin:")) {
      const realId = selectedScraperId.replace(/^plugin:/, "");
      return pluginsForTab.filter((p) => p.id === realId);
    }
    return pluginsForTab;
  }

  function handleRun() {
    const setRunningWrapped = (v: boolean) => (running = v);
    const pluginRunProps = {
      plugins: pluginsForTab,
      selectedProviderId: selectedScraperId,
      autoAccept,
      abortRef,
      setRunning: setRunningWrapped,
    };
    if (tab === "videos") {
      void runVideoScrape({
        videoRows,
        setVideoRows: (updater) => (videoRows = updater(videoRows)),
        videoScrapers,
        stashBoxEndpoints,
        selectedScraperId,
        autoAccept,
        abortRef,
        setRunning: setRunningWrapped,
        plugins: pluginsForTab,
      });
    } else if (tab === "video-series") {
      void runVideoSeriesIdentify({
        ...pluginRunProps,
        rows: seriesRows,
        setRows: (updater) => (seriesRows = updater(seriesRows)),
      });
    } else if (tab === "galleries") {
      void runGalleryIdentify({
        ...pluginRunProps,
        rows: galleryRows,
        setRows: (updater) => (galleryRows = updater(galleryRows)),
      });
    } else if (tab === "images") {
      void runImageIdentify({
        ...pluginRunProps,
        rows: imageRows,
        setRows: (updater) => (imageRows = updater(imageRows)),
      });
    } else if (tab === "audio-libraries") {
      void runAudioLibraryIdentify({
        ...pluginRunProps,
        rows: audioLibraryRows,
        setRows: (updater) => (audioLibraryRows = updater(audioLibraryRows)),
      });
    } else if (tab === "audio-tracks") {
      void runAudioTrackIdentify({
        ...pluginRunProps,
        rows: audioTrackRows,
        setRows: (updater) => (audioTrackRows = updater(audioTrackRows)),
      });
    } else if (tab === "performers") {
      void runPerformerScrape({
        perfRows,
        setPerfRows: (updater) => (perfRows = updater(perfRows)),
        perfScrapers,
        stashBoxEndpoints,
        selectedScraperId,
        autoAccept,
        abortRef,
        setRunning: setRunningWrapped,
      });
    } else if (tab === "studios") {
      void runStudioScrape({
        studioRows,
        setStudioRows: (updater) => (studioRows = updater(studioRows)),
        stashBoxEndpoints,
        selectedScraperId,
        autoAccept,
        abortRef,
        setRunning: setRunningWrapped,
      });
    } else if (tab === "tags") {
      void runTagScrape({
        tagRows,
        setTagRows: (updater) => (tagRows = updater(tagRows)),
        stashBoxEndpoints,
        selectedScraperId,
        autoAccept,
        abortRef,
        setRunning: setRunningWrapped,
      });
    }
  }

  async function handleAcceptAll() {
    if (tab === "videos") {
      await acceptAllVideos(videoRows, (updater) => (videoRows = updater(videoRows)));
      return;
    }
    if (tab === "video-series") {
      await acceptAllVideoSeries(seriesRows, (updater) => (seriesRows = updater(seriesRows)));
      return;
    }
    if (tab === "galleries") {
      await acceptAllGalleries(galleryRows, (updater) => (galleryRows = updater(galleryRows)));
      return;
    }
    if (tab === "images") {
      await acceptAllImages(imageRows, (updater) => (imageRows = updater(imageRows)));
      return;
    }
    if (tab === "audio-libraries") {
      await acceptAllAudioLibraries(
        audioLibraryRows,
        (updater) => (audioLibraryRows = updater(audioLibraryRows)),
      );
      return;
    }
    if (tab === "audio-tracks") {
      await acceptAllAudioTracks(
        audioTrackRows,
        (updater) => (audioTrackRows = updater(audioTrackRows)),
      );
      return;
    }
    if (tab === "performers") {
      await acceptAllPerformers(perfRows, (updater) => (perfRows = updater(perfRows)));
      return;
    }
    if (tab === "studios") {
      await acceptAllStudios(studioRows, (updater) => (studioRows = updater(studioRows)));
      return;
    }
    if (tab === "tags") {
      await acceptAllTags(tagRows, (updater) => (tagRows = updater(tagRows)));
    }
  }

  const TAB_META: Array<{
    key: Tab;
    label: string;
    icon: typeof Film;
    count: number | null;
  }> = $derived([
    { key: "videos", label: entityTerms.videos, icon: Film, count: videoRows.length },
    { key: "video-series", label: entityTerms.series, icon: FolderOpen, count: seriesRows.length },
    { key: "galleries", label: "Galleries", icon: Images, count: galleryRows.length },
    { key: "images", label: "Images", icon: Image, count: imageRows.length },
    { key: "audio-libraries", label: "Albums", icon: Library, count: audioLibraryRows.length },
    { key: "audio-tracks", label: "Tracks", icon: Music, count: audioTrackRows.length },
    { key: "performers", label: entityTerms.performers, icon: Users, count: perfRows.length },
    { key: "studios", label: "Studios", icon: Building2, count: studioRows.length },
    { key: "tags", label: "Tags", icon: Tag, count: tagRows.length },
    { key: "phashes", label: "pHashes", icon: Fingerprint, count: null },
  ]);
</script>

{#if loading}
  <div class="flex items-center justify-center py-20">
    <Loader2 class="h-6 w-6 animate-spin text-text-muted" />
  </div>
{:else}
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="flex items-center gap-2.5">
          <ScanSearch class="h-5 w-5 text-text-accent" />
          Identify
        </h1>
        <p class="mt-1 text-text-muted text-[0.78rem]">
          Match media against metadata providers and identification plugins
        </p>
      </div>
    </div>

    <div class="flex items-center gap-1 overflow-x-auto scrollbar-hidden">
      {#each TAB_META as meta (meta.key)}
        {@const isHiddenEmpty =
          ["video-series", "galleries", "images", "audio-libraries", "audio-tracks"].includes(
            meta.key,
          ) && meta.count === 0 && tab !== meta.key}
        {#if !isHiddenEmpty}
          {@const Icon = meta.icon}
          <button
            type="button"
            onclick={() => {
              if (!running) tab = meta.key;
            }}
            class={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-fast",
              tab === meta.key
                ? "bg-accent-950 text-text-accent border border-border-accent shadow-[var(--shadow-glow-accent)]"
                : "text-text-muted border border-transparent hover:text-text-secondary hover:bg-surface-3/40",
              running && tab !== meta.key && "opacity-40 cursor-not-allowed",
            )}
          >
            <Icon class="h-3.5 w-3.5" />
            {meta.label}
            {#if meta.count !== null}
              <span class="text-mono-sm text-text-disabled ml-1">{meta.count}</span>
            {/if}
          </button>
        {/if}
      {/each}
    </div>

    {#if tab === "phashes"}
      <PhashesTab />
    {:else}
      {#if processedCount > 0}
        <div class="grid grid-cols-4 gap-2">
          <div class="surface-stat px-3 py-2">
            <span class="text-kicker !text-text-disabled">Processed</span>
            <div class="text-lg font-semibold text-text-primary leading-tight">{processedCount}</div>
            {#if running}
              <div class="meter-track mt-1.5">
                <div
                  class="meter-fill"
                  style={`width: ${Math.round((processedCount / totalCount) * 100)}%`}
                ></div>
              </div>
            {/if}
          </div>
          <div class={cn("surface-stat px-3 py-2", foundCount > 0 && "surface-stat-accent")}>
            <span class="text-kicker !text-text-disabled">Found</span>
            <div
              class={cn(
                "text-lg font-semibold leading-tight",
                foundCount > 0 ? "text-text-accent" : "text-text-primary",
              )}
            >
              {foundCount}
            </div>
          </div>
          <div class="surface-stat px-3 py-2">
            <span class="text-kicker !text-text-disabled">Accepted</span>
            <div class="text-lg font-semibold text-status-success-text leading-tight">{acceptedCount}</div>
          </div>
          <div class="surface-stat px-3 py-2">
            <span class="text-kicker !text-text-disabled">Missed</span>
            <div class="text-lg font-semibold text-text-muted leading-tight">{missedCount}</div>
          </div>
        </div>
      {/if}

      <div class="surface-card no-lift p-3 space-y-2.5 relative z-20">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <ProviderSelector
              value={selectedScraperId}
              onChange={(v) => (selectedScraperId = v)}
              disabled={running}
              class="w-[240px]"
              allOption={{
                value: "",
                label: `Seek all (${totalProviderCount} sources)`,
              }}
              groups={[
                ...(pluginsForTab.length > 0
                  ? [
                      {
                        label: "Obscura Plugins",
                        options: pluginsForTab.map((p) => ({
                          value: `plugin:${p.id}`,
                          label: p.name,
                        })),
                      },
                    ]
                  : []),
                ...(nsfwAwareStashBoxEndpoints.length > 0
                  ? [
                      {
                        label: "Stash-Box",
                        options: nsfwAwareStashBoxEndpoints.map((ep) => ({
                          value: `stashbox:${ep.id}`,
                          label: ep.name,
                        })),
                      },
                    ]
                  : []),
                ...(scrapersForTab.length > 0
                  ? [
                      {
                        label: "Community Scrapers",
                        options: scrapersForTab.map((s) => ({
                          value: `scraper:${s.id}`,
                          label: s.name,
                        })),
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          <label class="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <Checkbox
              checked={autoAccept}
              disabled={running}
              onchange={(e: Event) =>
                (autoAccept = (e.currentTarget as HTMLInputElement).checked)}
            />
            Auto-accept
          </label>

          <label class="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <Checkbox
              checked={showAll}
              disabled={running}
              onchange={(e: Event) =>
                (showAll = (e.currentTarget as HTMLInputElement).checked)}
            />
            Show all
          </label>

          {#if tab === "videos"}
            <div class="flex items-center gap-2 text-xs text-text-muted">
              <span>
                Loaded {allVideos.length.toLocaleString()} / {videoTotalAvailable.toLocaleString()} videos
              </span>
              {#if allVideos.length < videoTotalAvailable}
                <button
                  type="button"
                  onclick={() => void loadMoreVideos()}
                  disabled={running || loadingMoreVideos}
                  class="inline-flex items-center gap-1 border border-border-subtle px-2 py-1 text-[0.65rem] hover:border-border-accent hover:text-text-primary disabled:opacity-50"
                >
                  {#if loadingMoreVideos}<Loader2 class="h-3 w-3 animate-spin" />{/if}
                  Load more
                </button>
              {/if}
            </div>
          {/if}

          {#if tab === "performers"}
            <div class="flex items-center gap-2 text-xs text-text-muted">
              <span>
                Loaded {allPerformers.length.toLocaleString()} / {performerTotalAvailable.toLocaleString()} performers
              </span>
              {#if allPerformers.length < performerTotalAvailable}
                <button
                  type="button"
                  onclick={() => void loadMorePerformers()}
                  disabled={running || loadingMorePerformers}
                  class="inline-flex items-center gap-1 border border-border-subtle px-2 py-1 text-[0.65rem] hover:border-border-accent hover:text-text-primary disabled:opacity-50"
                >
                  {#if loadingMorePerformers}<Loader2 class="h-3 w-3 animate-spin" />{/if}
                  Load more
                </button>
              {/if}
            </div>
          {/if}

          <div class="flex-1"></div>

          {#if !running}
            <div class="flex items-center gap-2">
              {#if foundCount > 0}
                <button
                  type="button"
                  onclick={() => void handleAcceptAll()}
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-status-success-text border border-status-success/30 hover:bg-status-success/10 transition-all duration-fast"
                >
                  <Check class="h-3 w-3" />
                  Accept All ({foundCount})
                </button>
              {/if}
              <button
                type="button"
                onclick={handleRun}
                disabled={totalCount === 0 || totalProviderCount === 0}
                class={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium transition-all duration-normal",
                  "bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900",
                  "text-accent-200 border border-border-accent shadow-[var(--shadow-glow-accent)]",
                  "hover:shadow-[var(--shadow-glow-accent-strong)] hover:border-border-accent-strong",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                {#if selectedScraperId}
                  <Play class="h-3 w-3" />
                {:else}
                  <SkipForward class="h-3 w-3" />
                {/if}
                {selectedScraperId
                  ? `Identify All (${totalCount - acceptedCount})`
                  : `Seek All (${totalCount - acceptedCount})`}
              </button>
            </div>
          {:else}
            <button
              type="button"
              onclick={() => {
                abortRef.current = true;
              }}
              class="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-status-error-text border border-status-error/30 hover:bg-status-error/10 transition-all duration-fast"
            >
              <Square class="h-3 w-3" />
              Stop
            </button>
          {/if}
        </div>

        {#if !selectedScraperId}
          <div class="flex items-center gap-1.5 text-[0.65rem] text-text-disabled">
            <SkipForward class="h-3 w-3 text-text-accent" />
            Cycles through all scrapers per item with 5s timeout each — select a
            specific scraper above to use only one
          </div>
        {/if}
      </div>

      {#if totalProviderCount === 0}
        <div class="surface-card no-lift p-12 text-center">
          <ScanSearch class="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p class="text-text-muted text-sm">
            No metadata providers configured for {tabEntityLabel(tab)}.
          </p>
          <p class="text-text-disabled text-xs mt-1">
            Add a Stash-Box endpoint or install scrapers in Settings.
          </p>
        </div>
      {/if}

      {#if totalCount === 0 && totalProviderCount > 0}
        <div class="surface-card no-lift p-12 text-center">
          <Check class="h-8 w-8 text-status-success-text mx-auto mb-2" />
          <p class="text-text-muted text-sm">
            {#if tab === "videos"}
              All {entityTerms.videos.toLowerCase()} are organized!
            {:else if tab === "performers"}
              All {entityTerms.performers.toLowerCase()} have complete metadata.
            {:else if tab === "studios"}
              All {entityTerms.studios.toLowerCase()} have complete metadata.
            {:else}
              All {entityTerms.tags.toLowerCase()} loaded.
            {/if}
          </p>
        </div>
      {/if}

      {#if totalCount > 0 && totalProviderCount > 0}
        <div class="space-y-1">
          <div class="flex items-center justify-end gap-2 px-1 mb-1">
            <button
              type="button"
              onclick={expandedIds.size > 0 ? collapseAll : expandAll}
              class="text-[0.65rem] text-text-muted hover:text-text-primary transition-colors"
            >
              {expandedIds.size > 0 ? "Collapse all" : "Expand all"}
            </button>
          </div>

          {#if tab === "videos"}
            <VideosTab
              {videoRows}
              setVideoRows={(updater) => (videoRows = updater(videoRows))}
              {expandedIds}
              {toggleExpanded}
              onSeekSingle={(idx) => {
                const isPlugin = selectedScraperId.startsWith("plugin:");
                const isScraper = selectedScraperId.startsWith("scraper:");
                const isStashBox = selectedScraperId.startsWith("stashbox:");
                const realId = selectedScraperId.replace(
                  /^(stashbox|scraper|plugin):/,
                  "",
                );
                const sl = isScraper
                  ? videoScrapers.filter((s) => s.id === realId)
                  : selectedScraperId === ""
                    ? videoScrapers
                    : [];
                const sb = isStashBox
                  ? stashBoxEndpoints.filter((e) => e.id === realId)
                  : selectedScraperId === ""
                    ? stashBoxEndpoints
                    : [];
                const pl = isPlugin
                  ? pluginsForTab.filter((p) => p.id === realId)
                  : selectedScraperId === ""
                    ? pluginsForTab
                    : [];
                void seekVideoSingle(
                  idx,
                  videoRows,
                  (updater) => (videoRows = updater(videoRows)),
                  sl,
                  sb,
                  pl,
                );
              }}
            />
          {:else if tab === "video-series"}
            <VideoSeriesTab
              rows={seriesRows}
              setRows={(updater) => (seriesRows = updater(seriesRows))}
              {expandedIds}
              {toggleExpanded}
              onSeekSingle={(idx) => {
                const isPlugin = selectedScraperId.startsWith("plugin:");
                const realId = selectedScraperId.replace(/^plugin:/, "");
                const pl = isPlugin
                  ? pluginsForTab.filter((p) => p.id === realId)
                  : pluginsForTab;
                void seekSeriesSingle(
                  idx,
                  seriesRows,
                  (updater) => (seriesRows = updater(seriesRows)),
                  pl,
                );
              }}
            />
          {:else if tab === "galleries"}
            <GalleriesTab
              rows={galleryRows}
              setRows={(updater) => (galleryRows = updater(galleryRows))}
              {expandedIds}
              {toggleExpanded}
              onSeekSingle={(idx) =>
                void seekGallerySingle(
                  idx,
                  galleryRows,
                  (updater) => (galleryRows = updater(galleryRows)),
                  pluginListForSeek(),
                )}
            />
          {:else if tab === "images"}
            <ImagesTab
              rows={imageRows}
              setRows={(updater) => (imageRows = updater(imageRows))}
              {expandedIds}
              {toggleExpanded}
              onSeekSingle={(idx) =>
                void seekImageSingle(
                  idx,
                  imageRows,
                  (updater) => (imageRows = updater(imageRows)),
                  pluginListForSeek(),
                )}
            />
          {:else if tab === "audio-libraries"}
            <AudioLibrariesTab
              rows={audioLibraryRows}
              setRows={(updater) => (audioLibraryRows = updater(audioLibraryRows))}
              {expandedIds}
              {toggleExpanded}
              onSeekSingle={(idx) =>
                void seekAudioLibrarySingle(
                  idx,
                  audioLibraryRows,
                  (updater) => (audioLibraryRows = updater(audioLibraryRows)),
                  pluginListForSeek(),
                )}
            />
          {:else if tab === "audio-tracks"}
            <AudioTracksTab
              rows={audioTrackRows}
              setRows={(updater) => (audioTrackRows = updater(audioTrackRows))}
              {expandedIds}
              {toggleExpanded}
              onSeekSingle={(idx) =>
                void seekAudioTrackSingle(
                  idx,
                  audioTrackRows,
                  (updater) => (audioTrackRows = updater(audioTrackRows)),
                  pluginListForSeek(),
                )}
            />
          {:else if tab === "performers"}
            <PerformersTab
              {perfRows}
              setPerfRows={(updater) => (perfRows = updater(perfRows))}
              {expandedIds}
              {toggleExpanded}
            />
          {:else if tab === "studios"}
            <StudiosTab
              {studioRows}
              setStudioRows={(updater) => (studioRows = updater(studioRows))}
              {expandedIds}
              {toggleExpanded}
            />
          {:else if tab === "tags"}
            <TagsTab
              {tagRows}
              setTagRows={(updater) => (tagRows = updater(tagRows))}
              {expandedIds}
              {toggleExpanded}
            />
          {/if}
        </div>
      {/if}
    {/if}
  </div>
{/if}
