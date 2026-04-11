"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SceneEdit } from "./scene-edit";
import { SceneTranscriptPanel } from "./scene-transcript-panel";
import { VideoPlayer, type VideoPlayerHandle } from "./video-player";
import { cn } from "@obscura/ui/lib/utils";
import {
  Star,
  Clock,
  Calendar,
  Eye,
  ArrowLeft,
  Loader2,
  Droplets,
  Heart,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import {
  fetchSceneDetail,
  fetchTags,
  updateScene,
  rebuildScenePreview,
  trackPlay,
  trackOrgasm,
  toApiUrl,
  type SceneDetail as SceneDetailType,
  type TagItem,
} from "../lib/api";
import { NsfwBlur, NsfwChip } from "./nsfw/nsfw-gate";
import { useNsfw } from "./nsfw/nsfw-context";
import { useTerms } from "../lib/terminology";
import { SceneMetadataPanel } from "./scenes/scene-metadata-panel";
import { SceneMarkerEditor } from "./scenes/scene-marker-editor";
import { SceneFileInfo } from "./scenes/scene-file-info";

const tabs = ["Details", "Metadata", "Markers", "Transcript", "Files"] as const;
type Tab = (typeof tabs)[number];

export function SceneDetail({
  id,
  initialScene = null,
  initialTags = [],
}: {
  id: string;
  initialScene?: SceneDetailType | null;
  initialTags?: TagItem[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Details");
  const [scene, setScene] = useState<SceneDetailType | null>(initialScene);
  const [loading, setLoading] = useState(initialScene == null);
  const [error, setError] = useState<string | null>(null);
  const [ratingHover, setRatingHover] = useState(0);
  const [savingRating, setSavingRating] = useState(false);
  const currentTimeRef = useRef(0);
  const [allTags, setAllTags] = useState<TagItem[]>(initialTags);
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);

  // Persist selected subtitle track per-scene in localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(`obscura:subtitle-lang:${id}`);
    if (saved) setActiveSubtitleId(saved === "__off__" ? null : saved);
  }, [id]);

  const handleActiveSubtitleChange = useCallback(
    (next: string | null) => {
      setActiveSubtitleId(next);
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
    fetchSceneDetail(id)
      .then(setScene)
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (initialScene?.id === id) {
      return;
    }

    setLoading(true);
    Promise.all([fetchSceneDetail(id), fetchTags({ nsfw: nsfwMode })])
      .then(([sceneData, tagsData]) => {
        setScene(sceneData);
        setAllTags(tagsData.tags);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, initialScene, nsfwMode]);

  const handlePlayStarted = useCallback(() => {
    trackPlay(id).catch(() => {});
  }, [id]);

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
      await updateScene(id, { rating: newRating });
    } catch {
      setScene((prev) => (prev ? { ...prev, rating: previousRating } : prev));
    } finally {
      setSavingRating(false);
    }
  }

  async function handleOrgasm() {
    if (!scene) return;
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
      await updateScene(id, { organized: newVal });
      setScene((prev) => (prev ? { ...prev, organized: newVal } : prev));
    } catch {
      // silent
    }
  }

  const [rebuildPreviewState, setRebuildPreviewState] = useState<
    "idle" | "queued" | "done"
  >("idle");

  async function handleRebuildPreview() {
    if (rebuildPreviewState !== "idle") return;
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
        <Link
          href="/scenes"
          className="text-text-accent text-sm mt-2 hover:text-text-accent-bright"
        >
          Back to {terms.scenes}
        </Link>
      </div>
    );
  }

  const ratingStars = scene.rating ? Math.round(scene.rating / 20) : 0;
  const activeStars = ratingHover > 0 ? ratingHover : ratingStars;

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/scenes"
        className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1.5 text-text-muted text-[0.72rem] font-medium hover:text-text-accent hover:border-border-accent transition-colors duration-fast w-fit"
      >
        <ArrowLeft className="h-3 w-3" />
        {terms.scenes}
      </Link>

      {/* Video Player */}
      <NsfwBlur isNsfw={scene.isNsfw ?? false}>
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
          subtitleAssetBase={
            process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
          }
        />
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

            {/* Rebuild preview */}
            <button
              type="button"
              onClick={() => void handleRebuildPreview()}
              disabled={rebuildPreviewState !== "idle"}
              className={cn(
                "flex items-center gap-1.5 h-8 px-2.5 transition-colors duration-fast",
                rebuildPreviewState === "done"
                  ? "text-success-text"
                  : rebuildPreviewState === "queued"
                    ? "text-text-accent"
                    : "text-text-disabled hover:text-text-muted hover:bg-surface-2",
                rebuildPreviewState !== "idle" && "cursor-default",
              )}
              title={
                rebuildPreviewState === "done"
                  ? "Rebuild queued"
                  : rebuildPreviewState === "queued"
                    ? "Queuing..."
                    : "Re-probe file metadata and rebuild thumbnails and trickplay"
              }
            >
              {rebuildPreviewState === "done" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    rebuildPreviewState === "queued" && "animate-spin",
                  )}
                />
              )}
            </button>
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
      {activeTab === "Details" && <SceneMetadataPanel scene={scene} />}

      {activeTab === "Metadata" && (
        <SceneEdit
          id={scene.id}
          inline
          onSaved={refreshScene}
          currentPlaybackTime={displayTime}
        />
      )}

      {activeTab === "Markers" && (
        <SceneMarkerEditor
          scene={scene}
          currentTimeRef={currentTimeRef}
          displayTime={displayTime}
          onRefresh={refreshScene}
        />
      )}

      {activeTab === "Transcript" && (
        <SceneTranscriptPanel
          sceneId={scene.id}
          tracks={scene.subtitleTracks ?? []}
          activeTrackId={activeSubtitleId}
          onActiveTrackIdChange={handleActiveSubtitleChange}
          currentTime={displayTime}
          onSeek={handleSeek}
          onTracksChanged={refreshScene}
        />
      )}

      {activeTab === "Files" && <SceneFileInfo scene={scene} />}
    </div>
  );
}
