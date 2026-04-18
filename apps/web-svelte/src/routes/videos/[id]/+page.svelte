<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { onMount } from "svelte";
  import {
    Star,
    Clock,
    Calendar,
    Eye,
    Droplets,
    Heart,
    CheckCircle2,
    RefreshCw,
    Eraser,
    MoreVertical,
    FolderPlus,
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { VideoDetailDto } from "@obscura/contracts";
  import { toApiUrl } from "$lib/api/core";
  import {
    updateVideo,
    recordVideoPlay,
    recordVideoOrgasm,
    resetVideoMetadata,
    fetchVideoDetail,
  } from "$lib/api/videos";
  import { rebuildVideoPreview } from "$lib/api/library";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import { entityTerms } from "$lib/terminology";
  import BackLink from "$lib/components/BackLink.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import NsfwChip from "$lib/components/NsfwChip.svelte";
  import VideoPlayer, {
    type VideoPlayerHandle,
  } from "$lib/components/VideoPlayer.svelte";
  import VideoMetadataPanel from "$lib/components/VideoMetadataPanel.svelte";
  import VideoMarkerEditor from "$lib/components/VideoMarkerEditor.svelte";
  import VideoFileInfo from "$lib/components/VideoFileInfo.svelte";

  const tabs = ["Details", "Markers", "Files"] as const;
  type Tab = (typeof tabs)[number];

  let { data } = $props();
  let video = $state<VideoDetailDto>(data.video);

  $effect(() => {
    video = data.video;
  });

  const nsfw = useNsfw();
  const terms = entityTerms;

  let activeTab = $state<Tab>("Details");
  let ratingHover = $state(0);
  let savingRating = $state(false);
  let currentTime = $state(0);
  let displayTime = $state(0);
  let activeSubtitleId = $state<string | null>(null);
  let subtitleChoiceLocked = $state(false);
  let moreActionsOpen = $state(false);

  let playerHandle: VideoPlayerHandle | undefined = $state();

  let rebuildPreviewState = $state<"idle" | "queued" | "done">("idle");
  let resetMetadataState = $state<"idle" | "running" | "done">("idle");

  const ratingStars = $derived(video.rating ? Math.round(video.rating / 20) : 0);
  const activeStars = $derived(ratingHover > 0 ? ratingHover : ratingStars);

  async function refreshVideo() {
    try {
      video = await fetchVideoDetail(video.id);
      await invalidate(`videos:${video.id}`);
    } catch {
      // ignore
    }
  }

  function handleTimeUpdate(t: number) {
    currentTime = t;
    displayTime = t;
  }

  function getCurrentTime(): number {
    return currentTime;
  }

  function handleActiveSubtitleChange(id: string | null) {
    activeSubtitleId = id;
    subtitleChoiceLocked = true;
  }

  let playTracked = false;
  async function handlePlayStarted() {
    if (playTracked) return;
    playTracked = true;
    try {
      await recordVideoPlay(video.id);
    } catch {
      // best-effort
    }
  }

  async function handleRatingClick(starIdx: number) {
    if (savingRating) return;
    savingRating = true;
    const newRating = starIdx === ratingStars ? null : starIdx * 20;
    const prevRating = video.rating;
    try {
      video.rating = newRating;
      await updateVideo(video.id, { rating: newRating });
    } catch {
      video.rating = prevRating;
    } finally {
      savingRating = false;
    }
  }

  async function handleOrgasm() {
    const prev = video.orgasmCount;
    video.orgasmCount = prev + 1;
    try {
      const res = await recordVideoOrgasm(video.id);
      video.orgasmCount = res.orgasmCount;
    } catch {
      video.orgasmCount = prev;
    }
  }

  async function handleToggleOrganized() {
    const next = !video.organized;
    const prev = video.organized;
    try {
      video.organized = next;
      await updateVideo(video.id, { organized: next });
    } catch {
      video.organized = prev;
    }
  }

  async function handleRebuildPreview() {
    if (rebuildPreviewState !== "idle") return;
    rebuildPreviewState = "queued";
    try {
      await rebuildVideoPreview(video.id);
    } catch {
      rebuildPreviewState = "idle";
      return;
    }
    rebuildPreviewState = "done";
    setTimeout(() => (rebuildPreviewState = "idle"), 4000);
  }

  async function handleResetMetadata() {
    if (resetMetadataState !== "idle") return;
    const confirmed = window.confirm(
      "Reset metadata?\n\n" +
        "This clears the title, details, date, rating, URL, studio, performers, and tags, " +
        "deletes the .nfo sidecar, and re-runs the probe and fingerprint jobs. " +
        "Markers, playback stats, and the file on disk are preserved.\n\n" +
        "This cannot be undone.",
    );
    if (!confirmed) return;

    resetMetadataState = "running";
    try {
      await resetVideoMetadata(video.id);
    } catch {
      resetMetadataState = "idle";
      return;
    }
    await refreshVideo();
    resetMetadataState = "done";
    setTimeout(() => (resetMetadataState = "idle"), 4000);
  }

  onMount(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!moreActionsOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && !target.closest("[data-more-actions]")) moreActionsOpen = false;
    };
    window.addEventListener("click", onDocClick, true);
    return () => window.removeEventListener("click", onDocClick, true);
  });

  const explicitCounterLabels = $derived(nsfw.mode === "show");
</script>

<svelte:head>
  <title>{video.title} — {terms.video} — Obscura</title>
</svelte:head>

<div class="space-y-5">
  <BackLink
    fallback="/videos"
    label={terms.videos}
    class="py-1.5 font-medium hover:border-border-accent w-fit"
  />

  <NsfwBlur isNsfw={video.isNsfw ?? false}>
    <VideoPlayer
      bind:handle={playerHandle}
      src={toApiUrl(video.streamUrl)}
      directSrc={toApiUrl(video.directStreamUrl)}
      poster={toApiUrl(video.thumbnailPath)}
      markers={video.markers.map((m) => ({ id: m.id, time: m.seconds, title: m.title }))}
      duration={video.duration ?? undefined}
      onPlayStarted={handlePlayStarted}
      onTimeUpdate={handleTimeUpdate}
      trickplaySprite={toApiUrl(video.spritePath, video.updatedAt)}
      trickplayVtt={toApiUrl(video.trickplayVttPath, video.updatedAt)}
      subtitleTracks={video.subtitleTracks ?? []}
      activeSubtitleTrackId={activeSubtitleId}
      onActiveSubtitleTrackIdChange={handleActiveSubtitleChange}
      {subtitleChoiceLocked}
    />
  </NsfwBlur>

  <!-- Video header -->
  <div class="surface-card-sharp p-4">
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-lg sm:text-xl font-semibold">{video.title}</h1>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[0.78rem] text-text-muted">
          {#if video.studio}
            <a
              href={`/studios/${video.studio.id}`}
              class="text-text-accent font-medium hover:text-text-accent-bright transition-colors"
            >
              {video.studio.name}
            </a>
          {/if}
          {#if video.date}
            <span class="flex items-center gap-1 text-ephemeral">
              <Calendar class="h-3.5 w-3.5" />
              {video.date}
            </span>
          {/if}
          {#if video.durationFormatted}
            <span class="flex items-center gap-1 text-ephemeral">
              <Clock class="h-3.5 w-3.5" />
              {video.durationFormatted}
            </span>
          {/if}
          <span class="flex items-center gap-1 text-ephemeral">
            <Eye class="h-3.5 w-3.5" />
            {video.playCount} plays
          </span>
          {#if video.resolution}
            <span class="pill-accent px-1.5 py-0.5 text-[0.65rem] font-semibold">
              {video.resolution}
            </span>
          {/if}
          {#if video.isNsfw}<NsfwChip />{/if}
        </div>
      </div>

      <div class="flex items-center gap-3 flex-shrink-0">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="flex items-center gap-0.5" onmouseleave={() => (ratingHover = 0)}>
          {#each Array.from({ length: 5 }) as _, i}
            {@const starIdx = i + 1}
            <button
              type="button"
              class="p-0 bg-transparent border-none cursor-pointer"
              onmouseenter={() => (ratingHover = starIdx)}
              onclick={() => void handleRatingClick(starIdx)}
              disabled={savingRating}
              aria-label={`${starIdx} star${starIdx === 1 ? "" : "s"}`}
            >
              <Star
                class={cn(
                  "h-4 w-4 transition-colors duration-fast",
                  starIdx <= activeStars
                    ? "fill-accent-500 text-glow-accent"
                    : "text-text-disabled hover:text-accent-800",
                )}
              />
            </button>
          {/each}
        </div>

        <button
          type="button"
          onclick={() => void handleOrgasm()}
          class="flex items-center gap-1.5 h-8 px-2.5 text-text-muted hover:text-accent-400 hover:bg-surface-2 transition-colors duration-fast"
          title={explicitCounterLabels
            ? "Orgasm counter — click to increment"
            : "Like counter — click to increment"}
        >
          {#if explicitCounterLabels}
            <Droplets class="h-4 w-4" />
          {:else}
            <Heart class="h-4 w-4" />
          {/if}
          {#if video.orgasmCount > 0}
            <span class="text-mono-sm">{video.orgasmCount}</span>
          {/if}
        </button>

        <button
          type="button"
          onclick={() => void handleToggleOrganized()}
          class={cn(
            "flex items-center gap-1.5 h-8 px-2.5 transition-colors duration-fast",
            video.organized
              ? "text-success-text hover:bg-surface-2"
              : "text-text-disabled hover:text-text-muted hover:bg-surface-2",
          )}
          title={video.organized ? "Marked as organized" : "Mark as organized"}
          aria-label={video.organized ? "Marked as organized" : "Mark as organized"}
        >
          <CheckCircle2 class="h-4 w-4" />
        </button>

        <div class="relative" data-more-actions>
          <button
            type="button"
            onclick={() => (moreActionsOpen = !moreActionsOpen)}
            class="flex items-center justify-center h-8 w-8 text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors duration-fast"
            title="More actions"
            aria-label="More actions"
          >
            <MoreVertical class="h-4 w-4" />
          </button>

          {#if moreActionsOpen}
            <div class="absolute right-0 top-full mt-1 z-50 w-56 surface-elevated py-1">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-3 py-1.5 text-[0.72rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
                onclick={() => {
                  moreActionsOpen = false;
                  alert("Add to Collection coming soon (APP-75)");
                }}
              >
                <FolderPlus class="h-3.5 w-3.5" />
                Add to Collection
              </button>

              <div class="h-px bg-border-subtle my-1"></div>

              <button
                type="button"
                disabled={rebuildPreviewState !== "idle"}
                class={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-[0.72rem] transition-colors",
                  rebuildPreviewState === "done"
                    ? "text-success-text"
                    : rebuildPreviewState === "queued"
                      ? "text-text-accent"
                      : "text-text-muted hover:text-text-primary hover:bg-surface-3",
                )}
                onclick={() => {
                  moreActionsOpen = false;
                  void handleRebuildPreview();
                }}
              >
                {#if rebuildPreviewState === "done"}
                  <CheckCircle2 class="h-3.5 w-3.5" />
                {:else}
                  <RefreshCw
                    class={cn(
                      "h-3.5 w-3.5",
                      rebuildPreviewState === "queued" && "animate-spin",
                    )}
                  />
                {/if}
                Rebuild Preview
              </button>

              <button
                type="button"
                disabled={resetMetadataState !== "idle"}
                class={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-[0.72rem] transition-colors",
                  resetMetadataState === "done"
                    ? "text-success-text"
                    : resetMetadataState === "running"
                      ? "text-text-accent"
                      : "text-text-muted hover:text-danger-text hover:bg-surface-3",
                )}
                onclick={() => {
                  moreActionsOpen = false;
                  void handleResetMetadata();
                }}
              >
                {#if resetMetadataState === "done"}
                  <CheckCircle2 class="h-3.5 w-3.5" />
                {:else}
                  <Eraser
                    class={cn(
                      "h-3.5 w-3.5",
                      resetMetadataState === "running" && "animate-pulse",
                    )}
                  />
                {/if}
                Reset Metadata
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  {#if video.details}
    <p
      class="text-text-secondary text-[0.85rem] leading-relaxed w-full max-w-full min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]"
    >
      {video.details}
    </p>
  {/if}

  <div class="flex items-center gap-0.5 overflow-x-auto scrollbar-hidden surface-well px-1 py-1">
    {#each tabs as tab (tab)}
      <button
        type="button"
        onclick={() => (activeTab = tab)}
        class={cn(
          "px-4 py-1.5 text-[0.78rem] font-medium transition-colors duration-fast whitespace-nowrap",
          activeTab === tab
            ? "text-text-accent bg-accent-950 border border-border-accent"
            : "text-text-muted hover:text-text-primary hover:bg-surface-2 border border-transparent",
        )}
      >
        {tab}
        {#if tab === "Markers" && video.markers.length > 0}
          <span class="ml-1.5 text-[0.6rem] text-text-disabled">{video.markers.length}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if activeTab === "Details"}
    <VideoMetadataPanel {video} />
  {:else if activeTab === "Markers"}
    <VideoMarkerEditor {video} {getCurrentTime} {displayTime} onRefresh={refreshVideo} />
  {:else if activeTab === "Files"}
    <VideoFileInfo {video} />
  {/if}
</div>
