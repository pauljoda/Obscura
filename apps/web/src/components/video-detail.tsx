"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { VideoEdit } from "./video-edit";
import { VideoTranscriptPanel } from "./video-transcript-panel";
import { VideoPlayer, type VideoPlayerHandle } from "./video-player";
import { cn } from "@obscura/ui/lib/utils";
import {
  Star,
  Clock,
  Calendar,
  Eye,
  Loader2,
  Droplets,
  Heart,
  CheckCircle2,
  RefreshCw,
  Eraser,
  MoreVertical,
  FolderPlus,
} from "lucide-react";
import Link from "next/link";
import {
  fetchLibraryConfig,
  fetchVideoDetail,
  fetchTags,
  updateScene,
  updateVideo,
  rebuildScenePreview,
  resetSceneMetadata,
  resetVideoMetadata,
  trackPlay,
  trackOrgasm,
  toApiUrl,
  type LibrarySettings,
  type VideoDetail as VideoDetailType,
  type TagItem,
} from "../lib/api";
import type { SubtitleAppearance, SubtitleDisplayStyle } from "@obscura/contracts";
import { NsfwBlur, NsfwChip } from "./nsfw/nsfw-gate";
import { useNsfw } from "./nsfw/nsfw-context";
import { useTerms } from "../lib/terminology";
import { AddToCollectionModal } from "./collections/add-to-collection-modal";
import { usePlaylistContext } from "./collections/playlist-context";
import { VideoMetadataPanel } from "./videos/video-metadata-panel";
import { VideoMarkerEditor } from "./videos/video-marker-editor";
import { VideoFileInfo } from "./videos/video-file-info";
import { BackLink } from "./shared/back-link";

const tabs = ["Details", "Metadata", "Markers", "Transcript", "Files"] as const;
type Tab = (typeof tabs)[number];

export function VideoDetail({
  id,
  initialScene = null,
  initialTags = [],
  source = "videos",
}: {
  id: string;
  initialScene?: VideoDetailType | null;
  initialTags?: TagItem[];
  /**
   * Selects which backend to read/write for this entity. The DTO shapes
   * are identical between `/scenes/:id` and `/videos/:id`, so the rest of
   * the component is unchanged. Defaults to `"scenes"` for backward compat.
   */
  source?: "scenes" | "videos";
}) {
  const isVideoSource = source === "videos";
  const loadDetail = useCallback(
    () => (isVideoSource ? fetchVideoDetail(id) : fetchVideoDetail(id)),
    [id, isVideoSource],
  );
  const saveDetail = useCallback(
    (data: Parameters<typeof updateScene>[1]) =>
      isVideoSource ? updateVideo(id, data) : updateScene(id, data),
    [id, isVideoSource],
  );
  const resetMetadata = useCallback(
    () => (isVideoSource ? resetVideoMetadata(id) : resetSceneMetadata(id)),
    [id, isVideoSource],
  );
  const playlist = usePlaylistContext();
  const [activeTab, setActiveTab] = useState<Tab>("Details");
  const [scene, setScene] = useState<VideoDetailType | null>(initialScene);
  const [loading, setLoading] = useState(initialScene == null);
  const [error, setError] = useState<string | null>(null);
  const [ratingHover, setRatingHover] = useState(0);
  const [savingRating, setSavingRating] = useState(false);
  const currentTimeRef = useRef(0);
  const [allTags, setAllTags] = useState<TagItem[]>(initialTags);
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);
  /** True once the user has made an explicit choice (including "Off"), or
   *  a saved preference was hydrated. Prevents the player's library-level
   *  auto-enable from clobbering an intentional "Off" selection. */
  const [subtitleChoiceLocked, setSubtitleChoiceLocked] = useState(false);
  const [librarySettings, setLibrarySettings] = useState<LibrarySettings | null>(
    null,
  );
  /** User's persisted preference. The actual docked state also requires
   *  the current scene to have at least one subtitle track AND a desktop-
   *  sized viewport — below the `lg` breakpoint the transcript always
   *  falls back into the tab, since a split layout would crowd the
   *  video into uselessness on a phone. */
  const [userWantsDock, setUserWantsDock] = useState(false);
  const [dockVideoPercent, setDockVideoPercent] = useState(80);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  // Track the `lg` breakpoint (1024px) with matchMedia. Default to false
  // during SSR / first render so mobile layout wins on the initial paint;
  // the effect upgrades immediately on the client.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = (event?: MediaQueryListEvent) => {
      setIsDesktopViewport(event ? event.matches : mq.matches);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const dockContainerRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  /** Height of the video player's wrapper (video + controls + film strip).
   *  When docked, the transcript sidecar is pinned to exactly this height
   *  so the page layout never grows to accommodate a tall cue list. */
  const [videoWrapperHeight, setVideoWrapperHeight] = useState<number | null>(
    null,
  );

  // Track the video wrapper's height with a ResizeObserver and mirror it
  // onto the docked transcript sidecar + resize handle. useLayoutEffect
  // (+ an immediate getBoundingClientRect) runs before the first paint so
  // the sidecar never flashes at its intrinsic (tall) height before the
  // observer kicks in.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const el = videoWrapperRef.current;
    if (!el) return;
    // Synchronous initial measurement so state is correct on first paint.
    const initialHeight = Math.round(el.getBoundingClientRect().height);
    setVideoWrapperHeight((prev) => (prev === initialHeight ? prev : initialHeight));
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = Math.round(entry.contentRect.height);
      setVideoWrapperHeight((prev) => (prev === next ? prev : next));
    });
    observer.observe(el);
    return () => observer.disconnect();
    // Re-measure synchronously whenever the dock preference or viewport
    // crosses the lg breakpoint — the video wrapper's flex-basis changes
    // cause the aspect-video height to change before the ResizeObserver
    // would fire asynchronously. Changes to `hasSubtitles` are handled
    // by the observer and are rare enough that a single async frame is
    // acceptable.
  }, [userWantsDock, isDesktopViewport, activeSubtitleId]);

  // Load dock preference + width on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("obscura:transcript-docked") === "1") {
      setUserWantsDock(true);
    }
    const savedWidth = Number(
      window.localStorage.getItem("obscura:transcript-dock-width"),
    );
    if (Number.isFinite(savedWidth) && savedWidth >= 40 && savedWidth <= 92) {
      setDockVideoPercent(savedWidth);
    }
  }, []);

  const toggleTranscriptDock = useCallback(() => {
    setUserWantsDock((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "obscura:transcript-docked",
          next ? "1" : "0",
        );
      }
      return next;
    });
  }, []);

  function handleResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    isResizingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isResizingRef.current) return;
    const container = dockContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((event.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(40, Math.min(92, pct));
    setDockVideoPercent(clamped);
  }

  function handleResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // pointer capture may have already been released
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "obscura:transcript-dock-width",
        String(Math.round(dockVideoPercent)),
      );
    }
  }

  // Fetch library-level subtitle defaults once on mount.
  useEffect(() => {
    let cancelled = false;
    fetchLibraryConfig()
      .then((config) => {
        if (!cancelled) setLibrarySettings(config.settings);
      })
      .catch(() => {
        // Non-fatal — the player falls back to built-in defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subtitleDefaults = librarySettings
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
    : undefined;

  const defaultPlaybackMode: "direct" | "hls" =
    librarySettings?.defaultPlaybackMode === "hls" ? "hls" : "direct";

  // Persist selected subtitle track per-scene in localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(`obscura:subtitle-lang:${id}`);
    if (saved) {
      setActiveSubtitleId(saved === "__off__" ? null : saved);
      setSubtitleChoiceLocked(true);
    } else {
      setActiveSubtitleId(null);
      setSubtitleChoiceLocked(false);
    }
  }, [id]);

  const handleActiveSubtitleChange = useCallback(
    (next: string | null) => {
      setActiveSubtitleId(next);
      setSubtitleChoiceLocked(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `obscura:subtitle-lang:${id}`,
          next ?? "__off__",
        );
      }
    },
    [id],
  );

  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seekTo(time);
  }, []);
  const { mode: nsfwMode } = useNsfw();
  const explicitCounterLabels = nsfwMode === "show";
  const terms = useTerms();

  const refreshScene = useCallback(() => {
    loadDetail()
      .then(setScene)
      .catch((err) => setError(err.message));
  }, [loadDetail]);

  useEffect(() => {
    if (initialScene?.id === id) {
      return;
    }

    setLoading(true);
    Promise.all([loadDetail(), fetchTags({ nsfw: nsfwMode })])
      .then(([sceneData, tagsData]) => {
        setScene(sceneData);
        setAllTags(tagsData.tags);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, initialScene, nsfwMode, loadDetail]);

  const handlePlayStarted = useCallback(() => {
    // Play tracking only exists on the legacy /scenes endpoint today; the
    // new /videos stack has no equivalent yet, so no-op there.
    if (isVideoSource) return;
    trackPlay(id).catch(() => {});
  }, [id, isVideoSource]);

  const [displayTime, setDisplayTime] = useState(0);
  const handleTimeUpdate = useCallback((time: number) => {
    currentTimeRef.current = time;
    setDisplayTime((prev) => (Math.abs(time - prev) >= 0.4 ? time : prev));
  }, []);

  async function handleRatingClick(starIdx: number) {
    if (!scene || savingRating) return;
    const currentStars = scene.rating ? Math.round(scene.rating / 20) : 0;
    const newRating = starIdx === currentStars ? null : starIdx * 20;
    const previousRating = scene.rating;
    setScene((prev) => (prev ? { ...prev, rating: newRating } : prev));
    setSavingRating(true);
    try {
      await saveDetail({ rating: newRating });
    } catch {
      setScene((prev) => (prev ? { ...prev, rating: previousRating } : prev));
    } finally {
      setSavingRating(false);
    }
  }

  async function handleOrgasm() {
    if (!scene) return;
    // The /videos stack has no orgasm tracking endpoint yet; no-op there.
    if (isVideoSource) return;
    try {
      const res = await trackOrgasm(id);
      setScene((prev) =>
        prev ? { ...prev, orgasmCount: res.orgasmCount } : prev,
      );
    } catch {
      // silent
    }
  }

  async function handleToggleOrganized() {
    if (!scene) return;
    const newVal = !scene.organized;
    try {
      await saveDetail({ organized: newVal });
      setScene((prev) => (prev ? { ...prev, organized: newVal } : prev));
    } catch {
      // silent
    }
  }

  const [rebuildPreviewState, setRebuildPreviewState] = useState<
    "idle" | "queued" | "done"
  >("idle");

  const rebuildPreviewWarnedRef = useRef(false);
  async function handleRebuildPreview() {
    if (rebuildPreviewState !== "idle") return;
    // No /videos equivalent for preview rebuild yet — no-op with a one-time
    // warning so the button click is observable in dev without spamming.
    if (isVideoSource) {
      if (!rebuildPreviewWarnedRef.current) {
        rebuildPreviewWarnedRef.current = true;
        console.warn(
          "[VideoDetail] rebuildScenePreview has no /videos equivalent yet; ignoring.",
        );
      }
      return;
    }
    setRebuildPreviewState("queued");
    try {
      await rebuildScenePreview(id, nsfwMode);
    } catch {
      setRebuildPreviewState("idle");
      return;
    }
    setRebuildPreviewState("done");
    setTimeout(() => setRebuildPreviewState("idle"), 4000);
  }

  const [resetMetadataState, setResetMetadataState] = useState<
    "idle" | "running" | "done"
  >("idle");

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

    setResetMetadataState("running");
    try {
      await resetMetadata();
    } catch (err) {
      setResetMetadataState("idle");
      setError(err instanceof Error ? err.message : "Failed to reset metadata");
      return;
    }
    try {
      const fresh = await loadDetail();
      setScene(fresh);
    } catch {
      // non-fatal — reset succeeded, refresh failed
    }
    setResetMetadataState("done");
    setTimeout(() => setResetMetadataState("idle"), 4000);
  }

  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 text-text-accent animate-spin" />
      </div>
    );
  }

  if (error || !scene) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-16">
        <p className="text-text-muted text-sm">
          {error ?? `${terms.scene} not found`}
        </p>
        <BackLink fallback={isVideoSource ? "/videos" : "/scenes"} label={`Back to ${terms.scenes}`} variant="text" className="text-text-accent text-sm mt-2 hover:text-text-accent-bright" />
      </div>
    );
  }

  const ratingStars = scene.rating ? Math.round(scene.rating / 20) : 0;
  const activeStars = ratingHover > 0 ? ratingHover : ratingStars;

  const hasSubtitles = (scene.subtitleTracks?.length ?? 0) > 0;
  // The docked transcript is only meaningful while subtitles are actually
  // enabled for playback — if the user turns captions off, collapse the
  // sidecar and let the video take the full width again.
  const subtitlesEnabled = activeSubtitleId != null;
  const isTranscriptDocked =
    userWantsDock && hasSubtitles && subtitlesEnabled && isDesktopViewport;

  return (
    <div className="space-y-5">
      {/* Back link */}
      <BackLink fallback={isVideoSource ? "/videos" : "/scenes"} label={terms.scenes} className="py-1.5 font-medium hover:border-border-accent w-fit" />

      {/* Video Player — optionally side-by-side with a docked transcript
          on desktop widths (>= lg). On smaller viewports the player stays
          full-width and the dock sidecar collapses automatically. */}
      <NsfwBlur isNsfw={scene.isNsfw ?? false}>
        <div
          ref={dockContainerRef}
          className={cn(
            // items-start is critical: items-stretch would let the
            // transcript's intrinsic height inflate the video wrapper,
            // the ResizeObserver would read the inflated value, and the
            // transcript would lock at the wrong height. With items-start
            // the video keeps its natural height and the handle +
            // transcript side are explicitly pinned to match it.
            isTranscriptDocked && "lg:flex lg:items-start lg:gap-0",
          )}
        >
          <div
            ref={videoWrapperRef}
            className={cn(
              isTranscriptDocked && "lg:min-w-0",
            )}
            style={
              isTranscriptDocked
                ? { flex: `0 0 ${dockVideoPercent}%` }
                : undefined
            }
          >
            <VideoPlayer
              ref={playerRef}
              src={toApiUrl(scene.streamUrl)}
              directSrc={toApiUrl(scene.directStreamUrl)}
              poster={toApiUrl(scene.thumbnailPath)}
              markers={scene.markers.map((m) => ({
                id: m.id,
                time: m.seconds,
                title: m.title,
              }))}
              duration={scene.duration ?? undefined}
              onPlayStarted={handlePlayStarted}
              onTimeUpdate={handleTimeUpdate}
              trickplaySprite={toApiUrl(scene.spritePath, scene.updatedAt)}
              trickplayVtt={toApiUrl(scene.trickplayVttPath, scene.updatedAt)}
              subtitleTracks={scene.subtitleTracks ?? []}
              activeSubtitleTrackId={activeSubtitleId}
              onActiveSubtitleTrackIdChange={handleActiveSubtitleChange}
              subtitleChoiceLocked={subtitleChoiceLocked}
              subtitleDefaults={subtitleDefaults}
              defaultPlaybackMode={defaultPlaybackMode}
              autoPlay={playlist.isActive && playlist.isPlaylistItem("scene", scene.id)}
              onEnded={() => playlist.reportContentEnded("scene", scene.id)}
            />
          </div>
          {isTranscriptDocked && (
            <>
              <div
                role="separator"
                aria-label="Resize transcript panel"
                aria-orientation="vertical"
                onPointerDown={handleResizeStart}
                onPointerMove={handleResizeMove}
                onPointerUp={handleResizeEnd}
                onPointerCancel={handleResizeEnd}
                className="hidden lg:flex w-2 shrink-0 cursor-col-resize items-center justify-center bg-surface-3 hover:bg-accent-950 active:bg-accent-950 transition-colors group"
                style={{
                  touchAction: "none",
                  height: videoWrapperHeight ?? undefined,
                }}
              >
                <span className="h-8 w-[2px] bg-border-default group-hover:bg-border-accent group-active:bg-border-accent transition-colors" />
              </div>
              <div
                className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-w-0 lg:overflow-hidden"
                style={
                  videoWrapperHeight != null
                    ? { height: videoWrapperHeight }
                    : undefined
                }
              >
                <VideoTranscriptPanel
                  sceneId={scene.id}
                  tracks={scene.subtitleTracks ?? []}
                  activeTrackId={activeSubtitleId}
                  onActiveTrackIdChange={handleActiveSubtitleChange}
                  currentTime={displayTime}
                  onSeek={handleSeek}
                  onTracksChanged={refreshScene}
                  variant="list-only"
                  isDocked
                  onDockToggle={toggleTranscriptDock}
                />
              </div>
            </>
          )}
        </div>
      </NsfwBlur>

      {/* Scene header */}
      <div className="surface-card-sharp p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold">
              {scene.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[0.78rem] text-text-muted">
              {scene.studio && (
                <Link
                  href={`/studios/${scene.studio.id}`}
                  className="text-text-accent font-medium hover:text-text-accent-bright transition-colors"
                >
                  {scene.studio.name}
                </Link>
              )}
              {scene.date && (
                <span className="flex items-center gap-1 text-ephemeral">
                  <Calendar className="h-3.5 w-3.5" />
                  {scene.date}
                </span>
              )}
              <span className="flex items-center gap-1 text-ephemeral">
                <Clock className="h-3.5 w-3.5" />
                {scene.durationFormatted}
              </span>
              <span className="flex items-center gap-1 text-ephemeral">
                <Eye className="h-3.5 w-3.5" />
                {scene.playCount} plays
              </span>
              {scene.resolution && (
                <span className="pill-accent px-1.5 py-0.5 text-[0.65rem] font-semibold">
                  {scene.resolution}
                </span>
              )}
              {scene.isNsfw && <NsfwChip />}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Rating stars */}
            <div
              className="flex items-center gap-0.5"
              onMouseLeave={() => setRatingHover(0)}
            >
              {Array.from({ length: 5 }).map((_, i) => {
                const starIdx = i + 1;
                return (
                  <button
                    key={i}
                    type="button"
                    className="p-0 bg-transparent border-none cursor-pointer"
                    onMouseEnter={() => setRatingHover(starIdx)}
                    onClick={() => void handleRatingClick(starIdx)}
                    disabled={savingRating}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4 transition-colors duration-fast",
                        starIdx <= activeStars
                          ? "fill-accent-500 text-glow-accent"
                          : "text-text-disabled hover:text-accent-800",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {/* Orgasm / like counter */}
            <button
              type="button"
              onClick={() => void handleOrgasm()}
              className="flex items-center gap-1.5 h-8 px-2.5 text-text-muted hover:text-accent-400 hover:bg-surface-2 transition-colors duration-fast"
              title={
                explicitCounterLabels
                  ? "Orgasm counter \u2014 click to increment"
                  : "Like counter \u2014 click to increment"
              }
            >
              {explicitCounterLabels ? (
                <Droplets className="h-4 w-4" />
              ) : (
                <Heart className="h-4 w-4" />
              )}
              {scene.orgasmCount > 0 && (
                <span className="text-mono-sm">{scene.orgasmCount}</span>
              )}
            </button>

            {/* Organized toggle */}
            <button
              type="button"
              onClick={() => void handleToggleOrganized()}
              className={cn(
                "flex items-center gap-1.5 h-8 px-2.5 transition-colors duration-fast",
                scene.organized
                  ? "text-success-text hover:bg-surface-2"
                  : "text-text-disabled hover:text-text-muted hover:bg-surface-2",
              )}
              title={
                scene.organized ? "Marked as organized" : "Mark as organized"
              }
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>

            {/* More Actions flyout */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreActionsOpen((o) => !o)}
                className="flex items-center justify-center h-8 w-8 text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors duration-fast"
                title="More actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {moreActionsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMoreActionsOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 surface-elevated py-1">
                    {/* Add to Collection */}
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[0.72rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
                      onClick={() => {
                        setMoreActionsOpen(false);
                        setCollectionModalOpen(true);
                      }}
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      Add to Collection
                    </button>

                    <div className="h-px bg-border-subtle my-1" />

                    {/* Rebuild preview */}
                    <button
                      type="button"
                      disabled={rebuildPreviewState !== "idle"}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-[0.72rem] transition-colors",
                        rebuildPreviewState === "done"
                          ? "text-success-text"
                          : rebuildPreviewState === "queued"
                            ? "text-text-accent"
                            : "text-text-muted hover:text-text-primary hover:bg-surface-3",
                      )}
                      onClick={() => {
                        setMoreActionsOpen(false);
                        void handleRebuildPreview();
                      }}
                    >
                      {rebuildPreviewState === "done" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <RefreshCw
                          className={cn(
                            "h-3.5 w-3.5",
                            rebuildPreviewState === "queued" && "animate-spin",
                          )}
                        />
                      )}
                      Rebuild Preview
                    </button>

                    {/* Reset metadata */}
                    <button
                      type="button"
                      disabled={resetMetadataState !== "idle"}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-[0.72rem] transition-colors",
                        resetMetadataState === "done"
                          ? "text-success-text"
                          : resetMetadataState === "running"
                            ? "text-text-accent"
                            : "text-text-muted hover:text-danger-text hover:bg-surface-3",
                      )}
                      onClick={() => {
                        setMoreActionsOpen(false);
                        void handleResetMetadata();
                      }}
                    >
                      {resetMetadataState === "done" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Eraser
                          className={cn(
                            "h-3.5 w-3.5",
                            resetMetadataState === "running" && "animate-pulse",
                          )}
                        />
                      )}
                      Reset Metadata
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {scene.details && (
        <p className="text-text-secondary text-[0.85rem] leading-relaxed w-full max-w-full min-w-0 break-words">
          {scene.details}
        </p>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hidden surface-well px-1 py-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 text-[0.78rem] font-medium transition-colors duration-fast whitespace-nowrap ",
              activeTab === tab
                ? "text-text-accent bg-accent-950 border border-border-accent"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2 border border-transparent",
            )}
          >
            {tab}
            {tab === "Markers" && scene.markers.length > 0 && (
              <span className="ml-1.5 text-[0.6rem] text-text-disabled">
                {scene.markers.length}
              </span>
            )}
            {tab === "Transcript" &&
              (scene.subtitleTracks?.length ?? 0) > 0 && (
                <span className="ml-1.5 text-[0.6rem] text-text-disabled">
                  {scene.subtitleTracks!.length}
                </span>
              )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Details" && <VideoMetadataPanel scene={scene} />}

      {activeTab === "Metadata" && (
        <VideoEdit
          id={scene.id}
          inline
          onSaved={refreshScene}
          currentPlaybackTime={displayTime}
          source={source}
        />
      )}

      {activeTab === "Markers" && (
        <VideoMarkerEditor
          scene={scene}
          currentTimeRef={currentTimeRef}
          displayTime={displayTime}
          onRefresh={refreshScene}
        />
      )}

      {activeTab === "Transcript" && (
        isTranscriptDocked ? (
          <div className="space-y-3">
            <div className="surface-well px-3 py-2 text-[0.78rem] text-text-muted flex items-center justify-between gap-2">
              <span>Transcript is docked next to the video.</span>
              <button
                type="button"
                onClick={toggleTranscriptDock}
                className="text-text-accent hover:text-text-accent-bright transition-colors"
              >
                Move it back here
              </button>
            </div>
            <VideoTranscriptPanel
              sceneId={scene.id}
              tracks={scene.subtitleTracks ?? []}
              activeTrackId={activeSubtitleId}
              onActiveTrackIdChange={handleActiveSubtitleChange}
              currentTime={displayTime}
              onSeek={handleSeek}
              onTracksChanged={refreshScene}
              variant="tracks-only"
              isDocked
              onDockToggle={toggleTranscriptDock}
            />
          </div>
        ) : (
          <VideoTranscriptPanel
            sceneId={scene.id}
            tracks={scene.subtitleTracks ?? []}
            activeTrackId={activeSubtitleId}
            onActiveTrackIdChange={handleActiveSubtitleChange}
            currentTime={displayTime}
            onSeek={handleSeek}
            onTracksChanged={refreshScene}
            onDockToggle={hasSubtitles ? toggleTranscriptDock : undefined}
            isDocked={false}
          />
        )
      )}

      {activeTab === "Files" && <VideoFileInfo scene={scene} />}

      <AddToCollectionModal
        open={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        entityType="scene"
        entityId={id}
        entityTitle={scene.title}
      />
    </div>
  );
}
