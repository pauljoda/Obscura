<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Building2, Users } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { EntityCredit } from "$lib/api/generated/model";
  import type {
    SubtitleAppearance,
    SubtitleDisplayStyle,
  } from "$lib/player/subtitle-types";
  import {
    fetchV2Video,
    fetchV2LibraryConfig,
    fetchJellyfinPlaybackInfo,
    markJellyfinUserPlayedItem,
    postJellyfinSessionProgress,
    updateV2EntityRating,
    updateV2EntityFlags,
    type JellyfinPlaybackInfoResponse,
    type V2VideoDetail,
    type V2LibrarySettings,
  } from "$lib/api/v2";
  import {
    getCapability,
    withFlagCapability,
    withRatingCapability,
  } from "$lib/api/capabilities";
  import EntityThumbnail from "$lib/components/thumbnails/EntityThumbnail.svelte";
  import { entityCardToDetailCard, type EntityDetailCardFull } from "$lib/entities/entity-detail";
  import {
    entityReferenceToThumbnailCard,
    type EntityThumbnailCard,
  } from "$lib/entities/entity-thumbnail";
  import { resolveEntityHref } from "$lib/entities/entity-routes";
  import { extractVideoPlayerProps, getPlaybackState } from "$lib/entities/video-capabilities";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import { useAppChrome } from "$lib/stores/app-chrome.svelte";
  import { usePlaylist } from "$lib/stores/playlist.svelte";
  import NsfwBlur from "$lib/components/nsfw/NsfwBlur.svelte";
  import EntityDetail, {
    type EntityDetailTab,
  } from "$lib/components/entities/EntityDetail.svelte";
  import VideoPlayer, {
    type VideoPlayerHandle,
  } from "$lib/components/VideoPlayer.svelte";
  import VideoTranscriptPanel from "$lib/components/VideoTranscriptPanel.svelte";

  type LoadState = "loading" | "ready" | "error";

  const nsfw = useNsfw();
  const appChrome = useAppChrome();
  const playlist = usePlaylist();

  let loadState: LoadState = $state("loading");
  let video = $state<V2VideoDetail | null>(null);
  let playbackInfo = $state<JellyfinPlaybackInfoResponse | null>(null);
  let errorMessage: string | null = $state(null);
  let ratingBusy = $state(false);
  let librarySettings = $state<V2LibrarySettings | null>(null);

  let playerHandle: VideoPlayerHandle | undefined = $state();
  let currentTime = $state(0);
  let displayTime = $state(0);
  let activeSubtitleId = $state<string | null>(null);
  let selectedAudioStreamIndex = $state<number | null>(null);
  let subtitleChoiceLocked = $state(false);
  let playTracked = false;
  let resumeApplied = false;
  let playbackUpdateTimer: ReturnType<typeof setInterval> | null = null;
  let lastReportedTime = 0;
  let hydratedSubtitlePrefsKey = "";

  // ── Transcript dock plumbing ───────────────────────────────────────
  let userWantsDock = $state(false);
  let dockVideoPercent = $state(80);
  let isDesktopViewport = $state(false);
  let videoWrapperEl: HTMLDivElement | null = $state(null);
  let videoWrapperHeight = $state<number | null>(null);
  let isResizing = false;

  const card = $derived.by((): EntityDetailCardFull | null => {
    if (!video) return null;
    return entityCardToDetailCard(video);
  });
  const videoId = $derived(video?.id ?? "");

  const playerProps = $derived.by(() => {
    if (!video) return null;
    return extractVideoPlayerProps(video.id, video.capabilities, playbackInfo, selectedAudioStreamIndex);
  });

  const studio = $derived.by(() => {
    if (!video) return null;
    const cap = getCapability(video.capabilities, "studio");
    return cap?.value ?? null;
  });

  const credits = $derived.by((): EntityCredit[] => {
    if (!video) return [];
    const cap = getCapability(video.capabilities, "credits");
    if (cap?.items?.length) return cap.items;
    return (cap?.people ?? []).map((person) => ({
      character: null,
      person,
      role: "person",
    }));
  });

  const studioCards = $derived.by((): EntityThumbnailCard[] => {
    if (!studio) return [];
    return [
      entityReferenceToThumbnailCard(studio, {
        aspectRatio: "wide",
      }),
    ];
  });

  const creditCards = $derived.by((): EntityThumbnailCard[] => (
    credits.map((credit) => (
      entityReferenceToThumbnailCard(credit.person, {
        subtitle: creditSubtitle(credit),
      })
    ))
  ));

  const hasCastAndCrew = $derived(studioCards.length > 0 || creditCards.length > 0);
  const detailTabs = $derived.by((): EntityDetailTab[] => {
    if (!card) return [];
    return [
      { id: "details", label: "Details" },
      { id: "metadata", label: "Metadata" },
      { id: "markers", label: "Markers", count: card.markers.length },
      { id: "transcript", label: "Transcript", count: playerProps?.subtitleTracks.length ?? 0 },
      { id: "files", label: "Files", count: card.files.length },
    ];
  });

  function creditSubtitle(credit: EntityCredit): string | undefined {
    const character = credit.character?.trim();
    if (character) return `Character ${character}`;
    const role = labelForCreditRole(credit.role);
    return role === "Person" ? undefined : role;
  }

  function labelForCreditRole(role: string | null | undefined): string {
    const normalized = (role ?? "").trim();
    if (!normalized) return "Person";
    return normalized
      .replaceAll("-", " ")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (value) => value.toUpperCase());
  }

  function thumbnailKey(card: EntityThumbnailCard): string {
    return `${card.entity.kind}:${card.entity.id}:${card.subtitle ?? ""}`;
  }

  function formatTimestamp(seconds: number): string {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const wholeSeconds = Math.floor(safeSeconds % 60);
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(wholeSeconds).padStart(2, "0")}`;
  }

  const dates = $derived.by(() => {
    if (!video) return [];
    const cap = getCapability(video.capabilities, "dates");
    return cap?.items ?? [];
  });

  const flagsNsfw = $derived.by(() => {
    if (!video) return false;
    const cap = getCapability(video.capabilities, "flags");
    return cap?.isNsfw === true;
  });

  const playbackState = $derived.by(() => {
    if (!video) return null;
    return getPlaybackState(video.capabilities);
  });

  const hasSubtitles = $derived((playerProps?.subtitleTracks.length ?? 0) > 0);
  const subtitlesEnabled = $derived(activeSubtitleId != null);
  const isTranscriptDockActive = $derived(userWantsDock && hasSubtitles && subtitlesEnabled);
  const isTranscriptDocked = $derived(
    userWantsDock && hasSubtitles && subtitlesEnabled && isDesktopViewport,
  );
  const isTranscriptInlineDocked = $derived(
    isTranscriptDockActive && !isDesktopViewport,
  );

  const subtitleDefaults = $derived(
    librarySettings
      ? {
          autoEnable: librarySettings.subtitlesAutoEnable ?? false,
          preferredLanguages: librarySettings.subtitlesPreferredLanguages ?? "en,eng",
          appearance: {
            style: (librarySettings.subtitleStyle ?? "stylized") as SubtitleDisplayStyle,
            fontScale: librarySettings.subtitleFontScale ?? 1,
            positionPercent: librarySettings.subtitlePositionPercent ?? 88,
            opacity: librarySettings.subtitleOpacity ?? 1,
          } satisfies SubtitleAppearance,
        }
      : undefined,
  );
  const defaultPlaybackMode = $derived<"direct" | "hls">(
    librarySettings?.defaultPlaybackMode === "hls" ? "hls" : "direct",
  );
  const showCastControls = $derived(librarySettings?.showCastControls ?? true);

  // ── Lifecycle ──────────────────────────────────────────────────────

  onMount(() => {
    void loadVideo();
    let cancelled = false;

    if (window.localStorage.getItem("obscura:transcript-docked") === "1") {
      userWantsDock = true;
    }
    const savedWidth = Number(
      window.localStorage.getItem("obscura:transcript-dock-width"),
    );
    if (Number.isFinite(savedWidth) && savedWidth >= 40 && savedWidth <= 92) {
      dockVideoPercent = savedWidth;
    }

    const mq = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => (isDesktopViewport = mq.matches);
    updateViewport();
    mq.addEventListener("change", updateViewport);

    void fetchV2LibraryConfig()
      .then((config) => {
        if (!cancelled) librarySettings = config.settings;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      mq.removeEventListener("change", updateViewport);
      if (playbackUpdateTimer) clearInterval(playbackUpdateTimer);
    };
  });

  // Reset play tracking when video ID changes.
  $effect(() => {
    playTracked = false;
    resumeApplied = false;
    selectedAudioStreamIndex = null;
    lastReportedTime = 0;
    hydratedSubtitlePrefsKey = "";
    if (playbackUpdateTimer) {
      clearInterval(playbackUpdateTimer);
      playbackUpdateTimer = null;
    }
    video?.id;
  });

  $effect(() => {
    if (!video) return;
    return appChrome.setBreadcrumbs([
      { label: "Videos", href: "/videos" },
      { label: video.title },
    ]);
  });

  // Hydrate subtitle preference from localStorage.
  $effect(() => {
    if (typeof window === "undefined" || !video || !playerProps) return;
    const videoId = video.id;
    const trackIds = playerProps.subtitleTracks.map((t) => t.id).join(",");
    const hydrationKey = `${videoId}:${trackIds}`;
    if (!videoId || hydratedSubtitlePrefsKey === hydrationKey) return;
    hydratedSubtitlePrefsKey = hydrationKey;
    const saved = window.localStorage.getItem(`obscura:subtitle-lang:${videoId}`);
    if (saved) {
      const restoredSubtitleId = saved === "__off__" ? null : saved;
      const hasSavedTrack =
        restoredSubtitleId == null ||
        playerProps.subtitleTracks.some((t) => t.id === restoredSubtitleId);
      if (hasSavedTrack) {
        activeSubtitleId = restoredSubtitleId;
        subtitleChoiceLocked = true;
        return;
      }
    }
    activeSubtitleId = null;
    subtitleChoiceLocked = false;
  });

  // Mirror video wrapper height for docked transcript.
  $effect(() => {
    if (typeof window === "undefined") return;
    const el = videoWrapperEl;
    if (!el) return;
    videoWrapperHeight = Math.round(el.getBoundingClientRect().height);
    void isTranscriptDocked;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = Math.round(entry.contentRect.height);
      if (videoWrapperHeight !== next) videoWrapperHeight = next;
    });
    observer.observe(el);
    return () => observer.disconnect();
  });

  // ── Data loading ───────────────────────────────────────────────────

  async function loadVideo() {
    loadState = "loading";
    errorMessage = null;
    try {
      video = await fetchV2Video(page.params.id ?? "");
      playbackInfo = await loadPlaybackInfo(video.id);
      loadState = "ready";
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      loadState = "error";
    }
  }

  async function refreshVideo() {
    try {
      video = await fetchV2Video(video?.id ?? page.params.id ?? "");
      playbackInfo = video
        ? await loadPlaybackInfo(video.id, playbackInfo?.PlaySessionId, selectedAudioStreamIndex)
        : null;
    } catch {
      // best-effort
    }
  }

  async function loadPlaybackInfo(
    videoId: string,
    playSessionId?: string | null,
    audioStreamIndex?: number | null,
  ) {
    try {
      return await fetchJellyfinPlaybackInfo(videoId, {
        EnableDirectPlay: true,
        EnableDirectStream: true,
        EnableTranscoding: true,
        PlaySessionId: playSessionId ?? undefined,
        AudioStreamIndex: audioStreamIndex ?? undefined,
      });
    } catch {
      return null;
    }
  }

  // ── Player event handlers ──────────────────────────────────────────

  function handleTimeUpdate(t: number) {
    currentTime = t;
    displayTime = t;

    if (!resumeApplied && video && playbackState && playbackState.resumeSeconds > 5) {
      resumeApplied = true;
      playerHandle?.seekTo(playbackState.resumeSeconds);
    }
  }

  async function handlePlayStarted() {
    if (playTracked || !video || !playerProps) return;
    playTracked = true;

    try {
      await postJellyfinSessionProgress("Playing", {
        ItemId: video.id,
        MediaSourceId: playerProps.mediaSourceId,
        PlaySessionId: playerProps.playSessionId,
        PositionTicks: Math.round(currentTime * 10_000_000),
      });
    } catch {
      // best-effort
    }

    if (!playbackUpdateTimer) {
      const videoId = video.id;
      playbackUpdateTimer = setInterval(() => {
        if (currentTime > 0 && Math.abs(currentTime - lastReportedTime) > 3) {
          lastReportedTime = currentTime;
          void postJellyfinSessionProgress("Playing/Progress", {
            ItemId: videoId,
            MediaSourceId: playerProps.mediaSourceId,
            PlaySessionId: playerProps.playSessionId,
            PositionTicks: Math.round(currentTime * 10_000_000),
          }).catch(() => {});
        }
      }, 10_000);
    }
  }

  async function handleVideoEnded() {
    if (!video || !playerProps) return;
    if (playbackUpdateTimer) {
      clearInterval(playbackUpdateTimer);
      playbackUpdateTimer = null;
    }
    try {
      await postJellyfinSessionProgress("Playing/Stopped", {
        ItemId: video.id,
        MediaSourceId: playerProps.mediaSourceId,
        PlaySessionId: playerProps.playSessionId,
        PositionTicks: 0,
      });
      await markJellyfinUserPlayedItem(video.id, true);
    } catch {
      // best-effort
    }
    playlist.reportContentEnded("video", video.id);
  }

  function handleActiveSubtitleChange(id: string | null) {
    activeSubtitleId = id;
    subtitleChoiceLocked = true;
    if (typeof window !== "undefined" && video) {
      window.localStorage.setItem(`obscura:subtitle-lang:${video.id}`, id ?? "__off__");
    }
  }

  async function handleAudioTrackChange(streamIndex: number) {
    if (!video) return;
    selectedAudioStreamIndex = streamIndex;
    playbackInfo = await loadPlaybackInfo(video.id, playbackInfo?.PlaySessionId, streamIndex);
  }

  function handleSeek(time: number) {
    playerHandle?.seekTo(time);
  }

  // ── Transcript dock ────────────────────────────────────────────────

  function toggleTranscriptDock() {
    userWantsDock = !userWantsDock;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "obscura:transcript-docked",
        userWantsDock ? "1" : "0",
      );
    }
  }

  function handleResizeStart(event: PointerEvent) {
    event.preventDefault();
    isResizing = true;
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
  }

  function handleResizeMove(event: PointerEvent) {
    if (!isResizing) return;
    const container = videoWrapperEl?.parentElement as HTMLElement | null;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((event.clientX - rect.left) / rect.width) * 100;
    dockVideoPercent = Math.max(40, Math.min(92, pct));
  }

  function handleResizeEnd(event: PointerEvent) {
    if (!isResizing) return;
    isResizing = false;
    try {
      (event.currentTarget as Element | null)?.releasePointerCapture?.(event.pointerId);
    } catch {
      // already released
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "obscura:transcript-dock-width",
        String(Math.round(dockVideoPercent)),
      );
    }
  }

  // ── Entity mutations ───────────────────────────────────────────────

  async function handleRatingChange(value: number | null) {
    if (!video || ratingBusy) return;
    const previous = video;
    ratingBusy = true;
    video = { ...video, capabilities: withRatingCapability(video.capabilities, value) };
    try {
      await updateV2EntityRating(video.id, value);
    } catch {
      video = previous;
    } finally {
      ratingBusy = false;
    }
  }

  async function handleFavoriteToggle() {
    if (!video) return;
    const previous = video;
    const flagsCap = getCapability(video.capabilities, "flags");
    const next = !(flagsCap?.isFavorite ?? false);
    video = { ...video, capabilities: withFlagCapability(video.capabilities, "isFavorite", next) };
    try {
      await updateV2EntityFlags(video.id, { isFavorite: next });
    } catch {
      video = previous;
    }
  }

  async function handleOrganizedToggle() {
    if (!video) return;
    const previous = video;
    const flagsCap = getCapability(video.capabilities, "flags");
    const next = !(flagsCap?.isOrganized ?? false);
    video = { ...video, capabilities: withFlagCapability(video.capabilities, "isOrganized", next) };
    try {
      await updateV2EntityFlags(video.id, { isOrganized: next });
    } catch {
      video = previous;
    }
  }
</script>

<svelte:head>
  <title>{video?.title ?? "Video"} · Obscura</title>
</svelte:head>

<div class="detail-page">
  {#if loadState === "loading"}
    <div class="loading-shell" aria-busy="true"></div>
  {:else if loadState === "error"}
    <div class="error-notice">
      <p>{errorMessage ?? "Failed to load video."}</p>
      <button type="button" onclick={() => void loadVideo()}>Retry</button>
    </div>
  {:else if card && video && playerProps}
    <NsfwBlur isNsfw={flagsNsfw}>
      <div class={cn(isTranscriptDocked && "lg:flex lg:items-start lg:gap-0")}>
        <div
          bind:this={videoWrapperEl}
          class={cn("player-surface", isTranscriptDocked && "lg:min-w-0")}
          style={isTranscriptDocked ? `flex: 0 0 ${dockVideoPercent}%` : undefined}
        >
          <VideoPlayer
            bind:handle={playerHandle}
            src={playerProps.src}
            directSrc={playerProps.directSrc}
            codec={playerProps.codec}
            sourceWidth={playerProps.sourceWidth}
            sourceHeight={playerProps.sourceHeight}
            poster={playerProps.poster}
            markers={playerProps.markers}
            duration={playerProps.duration || undefined}
            onPlayStarted={handlePlayStarted}
            onTimeUpdate={handleTimeUpdate}
            trickplayPlaylist={playerProps.trickplayPlaylist}
            subtitleTracks={playerProps.subtitleTracks}
            audioTrackOptions={playerProps.audioTracks}
            onAudioTrackChange={handleAudioTrackChange}
            activeSubtitleTrackId={activeSubtitleId}
            onActiveSubtitleTrackIdChange={handleActiveSubtitleChange}
            {subtitleChoiceLocked}
            {subtitleDefaults}
            isTranscriptSidecarOpen={userWantsDock && hasSubtitles}
            onTranscriptSidecarToggle={toggleTranscriptDock}
            {defaultPlaybackMode}
            {showCastControls}
            autoPlay={playlist.isActive && playlist.isPlaylistItem("video", video.id)}
            onEnded={handleVideoEnded}
          />
          {#if isTranscriptInlineDocked}
            <div class="mt-2 lg:hidden">
              <VideoTranscriptPanel
                videoId={video.id}
                tracks={playerProps.subtitleTracks}
                activeTrackId={activeSubtitleId}
                onActiveTrackIdChange={handleActiveSubtitleChange}
                currentTime={displayTime}
                onSeek={handleSeek}
                onTracksChanged={refreshVideo}
                variant="compact"
                isDocked
                onDockToggle={toggleTranscriptDock}
              />
            </div>
          {/if}
        </div>
        {#if isTranscriptDocked}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            role="separator"
            aria-label="Resize transcript panel"
            aria-orientation="vertical"
            onpointerdown={handleResizeStart}
            onpointermove={handleResizeMove}
            onpointerup={handleResizeEnd}
            onpointercancel={handleResizeEnd}
            class="hidden lg:flex w-2 shrink-0 cursor-col-resize items-center justify-center bg-surface-3 hover:bg-accent-950 active:bg-accent-950 transition-colors group"
            style={`touch-action: none; ${videoWrapperHeight != null ? `height: ${videoWrapperHeight}px;` : ""}`}
          >
            <span
              class="h-8 w-[2px] bg-border-default group-hover:bg-border-accent group-active:bg-border-accent transition-colors"
            ></span>
          </div>
          <div
            class="hidden lg:flex lg:flex-col lg:flex-1 lg:min-w-0 lg:overflow-hidden"
            style={videoWrapperHeight != null ? `height: ${videoWrapperHeight}px` : undefined}
          >
            <VideoTranscriptPanel
              videoId={video.id}
              tracks={playerProps.subtitleTracks}
              activeTrackId={activeSubtitleId}
              onActiveTrackIdChange={handleActiveSubtitleChange}
              currentTime={displayTime}
              onSeek={handleSeek}
              onTracksChanged={refreshVideo}
              variant="list-only"
              isDocked
              onDockToggle={toggleTranscriptDock}
            />
          </div>
        {/if}
      </div>
    </NsfwBlur>

    <EntityDetail
      {card}
      onRatingChange={handleRatingChange}
      onFavoriteToggle={handleFavoriteToggle}
      onOrganizedToggle={handleOrganizedToggle}
      {ratingBusy}
      showHero={false}
      posterSize="none"
      tabs={detailTabs}
    >
      {#snippet heroMeta()}
        {#if studio}
          <a href={resolveEntityHref("studio", studio.id)} class="meta-item is-studio">{studio.title}</a>
        {/if}
        {#each dates as date, i (date.code)}
          {#if studio || i > 0}
            <span class="meta-sep"></span>
          {/if}
          <span class="meta-item">{date.value}</span>
        {/each}
      {/snippet}

      {#snippet afterBody()}
        {#if hasCastAndCrew}
          <div class="credits-section">
            <h2 class="section-label">
              <Users class="h-4 w-4" />
              Cast and Crew
            </h2>
            <div class="credit-rows">
              {#if studioCards.length > 0}
                <section class="credit-row" aria-label="Studios">
                  <h3 class="credit-row-label">
                    <Building2 class="h-3.5 w-3.5" />
                    Studios
                  </h3>
                  <div class="credit-scroller">
                    {#each studioCards as thumbnailCard (thumbnailKey(thumbnailCard))}
                      <div class="credit-thumbnail is-studio">
                        <EntityThumbnail card={thumbnailCard} titleAlign="center" titleSize="compact" />
                      </div>
                    {/each}
                  </div>
                </section>
              {/if}

              {#if creditCards.length > 0}
                <section class="credit-row" aria-label="Cast">
                  <h3 class="credit-row-label">
                    <Users class="h-3.5 w-3.5" />
                    Cast
                  </h3>
                  <div class="credit-scroller">
                    {#each creditCards as thumbnailCard (thumbnailKey(thumbnailCard))}
                      <div class="credit-thumbnail">
                        {#if thumbnailCard.subtitle}
                          <EntityThumbnail card={thumbnailCard} titleAlign="center" titleSize="compact">
                            {#snippet subtitleContent(card)}
                              <span class="credit-role-label">{card.subtitle}</span>
                            {/snippet}
                          </EntityThumbnail>
                        {:else}
                          <EntityThumbnail card={thumbnailCard} titleAlign="center" titleSize="compact" />
                        {/if}
                      </div>
                    {/each}
                  </div>
                </section>
              {/if}
            </div>
          </div>
        {/if}
      {/snippet}

      {#snippet tabContent(tab)}
        {#if tab.id === "metadata"}
          <div class="metadata-tab-grid">
            {#if card.technical.length > 0}
              <section class="tab-panel-section">
                <h2 class="section-label">Technical</h2>
                <div class="tab-data-list">
                  {#each card.technical as row (row.label)}
                    <div class="tab-data-row">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  {/each}
                </div>
              </section>
            {/if}

            {#if card.dates.length > 0}
              <section class="tab-panel-section">
                <h2 class="section-label">Dates</h2>
                <div class="tab-data-list">
                  {#each card.dates as row (row.code)}
                    <div class="tab-data-row">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  {/each}
                </div>
              </section>
            {/if}

            {#if card.counters.length > 0 || playbackState}
              <section class="tab-panel-section">
                <h2 class="section-label">Playback</h2>
                <div class="tab-data-list">
                  {#if playbackState}
                    <div class="tab-data-row">
                      <span>Play Count</span>
                      <strong>{playbackState.playCount}</strong>
                    </div>
                    {#if playbackState.resumeSeconds > 0}
                      <div class="tab-data-row">
                        <span>Resume</span>
                        <strong>{formatTimestamp(playbackState.resumeSeconds)}</strong>
                      </div>
                    {/if}
                  {/if}
                  {#each card.counters as row (row.code)}
                    <div class="tab-data-row">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  {/each}
                </div>
              </section>
            {/if}

            {#if card.sources.length > 0 || card.fingerprints.length > 0}
              <section class="tab-panel-section">
                <h2 class="section-label">Source</h2>
                <div class="tab-data-list">
                  {#each card.sources as source (source.code)}
                    <div class="tab-data-row">
                      <span>{source.code}</span>
                      <strong>{source.value}</strong>
                    </div>
                  {/each}
                  {#each card.fingerprints as fingerprint (`${fingerprint.algorithm}:${fingerprint.value}`)}
                    <div class="tab-data-row">
                      <span>{fingerprint.algorithm}</span>
                      <strong>{fingerprint.value}</strong>
                    </div>
                  {/each}
                </div>
              </section>
            {/if}
          </div>
        {:else if tab.id === "markers"}
          {#if card.markers.length > 0}
            <div class="marker-tab-list">
              {#each card.markers as marker (marker.id)}
                <button type="button" class="marker-tab-row" onclick={() => handleSeek(marker.seconds)}>
                  <span class="marker-time">
                    {marker.timestamp}
                    {#if marker.endSeconds != null}
                      <span>→ {formatTimestamp(marker.endSeconds)}</span>
                    {/if}
                  </span>
                  <strong>{marker.title}</strong>
                </button>
              {/each}
            </div>
          {:else}
            <div class="tab-empty-state">No markers yet.</div>
          {/if}
        {:else if tab.id === "transcript"}
          {#if isTranscriptDockActive}
            <div class="transcript-tab-stack">
              <div class="tab-inline-notice">
                <span>
                  {isTranscriptDocked
                    ? "Transcript is docked next to the video."
                    : "Transcript is docked under the video."}
                </span>
                <button type="button" onclick={toggleTranscriptDock}>Move it back here</button>
              </div>
              <VideoTranscriptPanel
                {videoId}
                tracks={playerProps.subtitleTracks}
                activeTrackId={activeSubtitleId}
                onActiveTrackIdChange={handleActiveSubtitleChange}
                currentTime={displayTime}
                onSeek={handleSeek}
                onTracksChanged={refreshVideo}
                variant="tracks-only"
                isDocked
                onDockToggle={toggleTranscriptDock}
              />
            </div>
          {:else}
            <VideoTranscriptPanel
              {videoId}
              tracks={playerProps.subtitleTracks}
              activeTrackId={activeSubtitleId}
              onActiveTrackIdChange={handleActiveSubtitleChange}
              currentTime={displayTime}
              onSeek={handleSeek}
              onTracksChanged={refreshVideo}
              onDockToggle={hasSubtitles ? toggleTranscriptDock : undefined}
              isDocked={false}
            />
          {/if}
        {:else if tab.id === "files"}
          {#if card.files.length > 0}
            <div class="file-tab-list">
              {#each card.files as file (file.path)}
                <div class="file-tab-row">
                  <span>{file.role}</span>
                  <strong>{file.path}</strong>
                  {#if file.mimeType}
                    <em>{file.mimeType}</em>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <div class="tab-empty-state">No files recorded for this video.</div>
          {/if}
        {/if}
      {/snippet}
    </EntityDetail>
  {/if}
</div>

<style>
  .detail-page {
    display: grid;
    gap: 1.25rem;
    padding: 0;
    max-width: none;
    margin: 0;
  }

  .loading-shell {
    min-height: 28rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .error-notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid color-mix(in srgb, #ef4444 50%, var(--color-border, #1c2235));
    background: var(--color-surface-2, #101420);
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.85rem;
  }

  .error-notice button {
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-3, #151a28);
    color: var(--color-text-muted, #8a93a6);
    padding: 0.4rem 0.8rem;
    font-size: 0.78rem;
    cursor: pointer;
  }

  .player-surface {
    background: #050508;
  }

  :global(.meta-item) {
    white-space: nowrap;
    font-size: 0.82rem;
  }

  :global(.meta-item.is-studio) {
    color: var(--color-text-accent, #c49a5a);
    text-decoration: none;
    transition: opacity 0.15s;
  }

  :global(.meta-item.is-studio:hover) {
    opacity: 0.8;
  }

  :global(.meta-sep) {
    display: inline-block;
    width: 3px;
    height: 3px;
    margin: 0 0.5rem;
    background: var(--color-text-muted, #8a93a6);
    opacity: 0.5;
  }

  .credits-section {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border, #1c2235);
    overflow: hidden;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0 0 0.75rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted, #8a93a6);
  }

  .credit-rows {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  .credit-row {
    display: grid;
    gap: 0.55rem;
    min-width: 0;
    overflow: hidden;
  }

  .credit-row-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    color: var(--color-text-secondary, #c4c9d4);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .credit-row-label :global(svg) {
    color: var(--color-text-muted, #8a93a6);
  }

  .credit-scroller {
    display: flex;
    gap: 0.75rem;
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 0.35rem;
    scroll-padding-inline: 0.25rem;
    scrollbar-width: thin;
  }

  .credit-thumbnail {
    flex: 0 0 clamp(7rem, 33vw, 8.75rem);
    min-width: 0;
  }

  .credit-thumbnail.is-studio {
    flex-basis: clamp(7.75rem, 34vw, 10rem);
  }

  .credit-role-label {
    display: inline-flex;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.08);
    background: rgb(255 255 255 / 0.032);
    color: rgb(196 201 212 / 0.72);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.58rem;
    line-height: 1;
    padding: 0.18rem 0.3rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .metadata-tab-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    gap: 1rem;
    min-width: 0;
  }

  .tab-panel-section {
    min-width: 0;
  }

  .tab-data-list,
  .marker-tab-list,
  .file-tab-list,
  .transcript-tab-stack {
    display: grid;
    gap: 0;
    min-width: 0;
  }

  .tab-data-row,
  .file-tab-row {
    display: grid;
    grid-template-columns: minmax(5.5rem, max-content) minmax(0, 1fr);
    gap: 0.8rem;
    align-items: baseline;
    min-width: 0;
    padding: 0.55rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-border, #1c2235) 56%, transparent);
    font-size: 0.82rem;
  }

  .tab-data-row span,
  .file-tab-row span {
    color: var(--color-text-muted, #8a93a6);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .tab-data-row strong,
  .file-tab-row strong {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--color-text-secondary, #c4c9d4);
    font-weight: 500;
  }

  .file-tab-row {
    grid-template-columns: minmax(5.5rem, max-content) minmax(0, 1fr) max-content;
  }

  .file-tab-row em {
    color: var(--color-text-muted, #8a93a6);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.72rem;
    font-style: normal;
  }

  .marker-tab-row {
    display: grid;
    grid-template-columns: minmax(6rem, max-content) minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    width: 100%;
    min-width: 0;
    padding: 0.75rem 0;
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-border, #1c2235) 56%, transparent);
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .marker-tab-row:hover {
    color: var(--color-text-accent, #c49a5a);
  }

  .marker-time {
    color: var(--color-text-accent, #c49a5a);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.78rem;
    tab-size: 4;
  }

  .marker-time span {
    color: var(--color-text-disabled, #4a5260);
  }

  .marker-tab-row strong {
    min-width: 0;
    overflow: hidden;
    color: var(--color-text-secondary, #c4c9d4);
    font-size: 0.88rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab-empty-state,
  .tab-inline-notice {
    padding: 1rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.82rem;
  }

  .tab-inline-notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .tab-inline-notice button {
    border: 0;
    background: transparent;
    color: var(--color-text-accent, #c49a5a);
    font-size: 0.78rem;
    cursor: pointer;
    white-space: nowrap;
  }

  @media (min-width: 640px) {
    .credits-section {
      padding: 1rem 2rem;
    }

    .credit-thumbnail {
      flex-basis: 8.25rem;
    }

    .credit-thumbnail.is-studio {
      flex-basis: 10.5rem;
    }
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 0.85; }
  }
</style>
