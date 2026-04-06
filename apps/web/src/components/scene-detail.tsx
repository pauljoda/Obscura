"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useRef, type ComponentType } from "react";
import { SceneEdit } from "./scene-edit";
import { Button } from "@obscura/ui/primitives/button";
import { cn } from "@obscura/ui/lib/utils";
import {
  Star,
  Clock,
  Monitor,
  HardDrive,
  Calendar,
  FileVideo,
  Link2,
  Eye,
  Play,
  ArrowLeft,
  Zap,
  User,
  Tag as TagIcon,
  Loader2,
  Droplets,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  X,
  MapPin,
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
  createMarker,
  updateMarker,
  deleteMarker,
  toApiUrl,
  type SceneDetail as SceneDetailType,
  type TagItem,
} from "../lib/api";
import { StashIdChips } from "./stash-id-chips";

const tabs = ["Details", "Metadata", "Markers", "Files"] as const;
type Tab = (typeof tabs)[number];

const VideoPlayer = dynamic(
  () => import("./video-player").then((module) => module.VideoPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="surface-well flex items-center justify-center py-16 text-sm text-text-muted">
        Loading player...
      </div>
    ),
  },
);

function formatBitRate(bps: number | null): string {
  if (!bps) return "—";
  if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)} Mbps`;
  return `${(bps / 1000).toFixed(0)} Kbps`;
}

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

  // Marker editor state
  const [allTags, setAllTags] = useState<TagItem[]>(initialTags);
  const [editingMarker, setEditingMarker] = useState<string | null>(null); // marker id or "new"
  const [markerTitle, setMarkerTitle] = useState("");
  const [markerSeconds, setMarkerSeconds] = useState(0);
  const [markerEndSeconds, setMarkerEndSeconds] = useState<number | null>(null);
  const [markerTagName, setMarkerTagName] = useState("");
  const [savingMarker, setSavingMarker] = useState(false);

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
    Promise.all([fetchSceneDetail(id), fetchTags()])
      .then(([sceneData, tagsData]) => {
        setScene(sceneData);
        setAllTags(tagsData.tags);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, initialScene]);

  const handlePlayStarted = useCallback(() => {
    trackPlay(id).catch(() => {});
  }, [id]);

  const [displayTime, setDisplayTime] = useState(0);
  const handleTimeUpdate = useCallback((time: number) => {
    currentTimeRef.current = time;
    // Update display time every ~500ms (throttle by checking delta)
    setDisplayTime((prev) => Math.abs(time - prev) >= 0.4 ? time : prev);
  }, []);

  function startNewMarker() {
    setEditingMarker("new");
    setMarkerTitle("");
    setMarkerSeconds(Math.floor(currentTimeRef.current));
    setMarkerEndSeconds(null);
    setMarkerTagName("");
  }

  function startEditMarker(m: SceneDetailType["markers"][0]) {
    setEditingMarker(m.id);
    setMarkerTitle(m.title);
    setMarkerSeconds(m.seconds);
    setMarkerEndSeconds(m.endSeconds);
    setMarkerTagName(m.primaryTag?.name ?? "");
  }

  function cancelMarkerEdit() {
    setEditingMarker(null);
  }

  async function handleSaveMarker() {
    if (!markerTitle.trim()) return;
    setSavingMarker(true);
    try {
      if (editingMarker === "new") {
        await createMarker(id, {
          title: markerTitle.trim(),
          seconds: markerSeconds,
          endSeconds: markerEndSeconds,
          primaryTagName: markerTagName.trim() || null,
        });
      } else if (editingMarker) {
        await updateMarker(editingMarker, {
          title: markerTitle.trim(),
          seconds: markerSeconds,
          endSeconds: markerEndSeconds,
          primaryTagName: markerTagName.trim() || null,
        });
      }
      setEditingMarker(null);
      refreshScene();
    } catch {
      // silent
    } finally {
      setSavingMarker(false);
    }
  }

  async function handleDeleteMarker(markerId: string) {
    try {
      await deleteMarker(markerId);
      refreshScene();
    } catch {
      // silent
    }
  }

  async function handleRatingClick(starIdx: number) {
    if (!scene || savingRating) return;
    const currentStars = scene.rating ? Math.round(scene.rating / 20) : 0;
    const newRating = starIdx === currentStars ? null : starIdx * 20;
    const previousRating = scene.rating;
    // Optimistic update — show change immediately
    setScene((prev) => prev ? { ...prev, rating: newRating } : prev);
    setSavingRating(true);
    try {
      await updateScene(id, { rating: newRating });
    } catch {
      // Revert on failure
      setScene((prev) => prev ? { ...prev, rating: previousRating } : prev);
    } finally {
      setSavingRating(false);
    }
  }

  async function handleOrgasm() {
    if (!scene) return;
    try {
      const res = await trackOrgasm(id);
      setScene((prev) =>
        prev ? { ...prev, orgasmCount: res.orgasmCount } : prev
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
      setScene((prev) => prev ? { ...prev, organized: newVal } : prev);
    } catch {
      // silent
    }
  }

  const [rebuildPreviewState, setRebuildPreviewState] = useState<"idle" | "queued" | "done">("idle");

  async function handleRebuildPreview() {
    if (rebuildPreviewState !== "idle") return;
    setRebuildPreviewState("queued");
    try {
      await rebuildScenePreview(id);
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
        <p className="text-text-muted text-sm">{error ?? "Scene not found"}</p>
        <Link
          href="/scenes"
          className="text-text-accent text-sm mt-2 hover:text-text-accent-bright"
        >
          Back to Scenes
        </Link>
      </div>
    );
  }

  const ratingStars = scene.rating ? Math.round(scene.rating / 20) : 0;
  const activeStars = ratingHover > 0 ? ratingHover : ratingStars;

  return (
    <div className="space-y-5">
      {/* Back link — shows scene title */}
      <Link
        href="/scenes"
        className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1.5 text-text-muted text-[0.72rem] font-medium hover:text-text-accent hover:border-border-accent transition-colors duration-fast w-fit"
      >
        <ArrowLeft className="h-3 w-3" />
        Scenes
      </Link>

      {/* Video Player */}
      <VideoPlayer
        src={toApiUrl(scene.streamUrl)}
        directSrc={toApiUrl(scene.directStreamUrl)}
        poster={toApiUrl(scene.thumbnailPath)}
        markers={scene.markers.map((m) => ({
          id: m.id,
          time: m.seconds,
          title: m.title,
          tag: m.primaryTag?.name,
        }))}
        duration={scene.duration ?? undefined}
        onPlayStarted={handlePlayStarted}
        onTimeUpdate={handleTimeUpdate}
        trickplaySprite={toApiUrl(scene.spritePath)}
        trickplayVtt={toApiUrl(scene.trickplayVttPath)}
      />

      {/* Scene header */}
      <div className="surface-card-sharp p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold">{scene.title}</h1>
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
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Rating stars — clickable */}
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
                          : "text-text-disabled hover:text-accent-800"
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {/* Orgasm counter */}
            <button
              type="button"
              onClick={() => void handleOrgasm()}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-sm text-text-muted hover:text-accent-400 hover:bg-surface-2 transition-colors duration-fast"
              title="Orgasm counter — click to increment"
            >
              <Droplets className="h-4 w-4" />
              {scene.orgasmCount > 0 && (
                <span className="text-mono-sm">{scene.orgasmCount}</span>
              )}
            </button>

            {/* Organized toggle */}
            <button
              type="button"
              onClick={() => void handleToggleOrganized()}
              className={cn(
                "flex items-center gap-1.5 h-8 px-2.5 rounded-sm transition-colors duration-fast",
                scene.organized
                  ? "text-success-text hover:bg-surface-2"
                  : "text-text-disabled hover:text-text-muted hover:bg-surface-2"
              )}
              title={scene.organized ? "Marked as organized" : "Mark as organized"}
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>

            {/* Rebuild preview */}
            <button
              type="button"
              onClick={() => void handleRebuildPreview()}
              disabled={rebuildPreviewState !== "idle"}
              className={cn(
                "flex items-center gap-1.5 h-8 px-2.5 rounded-sm transition-colors duration-fast",
                rebuildPreviewState === "done"
                  ? "text-success-text"
                  : rebuildPreviewState === "queued"
                    ? "text-text-accent"
                    : "text-text-disabled hover:text-text-muted hover:bg-surface-2",
                rebuildPreviewState !== "idle" && "cursor-default"
              )}
              title={
                rebuildPreviewState === "done"
                  ? "Rebuild queued"
                  : rebuildPreviewState === "queued"
                    ? "Queuing..."
                    : "Rebuild thumbnails and trickplay"
              }
            >
              {rebuildPreviewState === "done" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <RefreshCw className={cn("h-4 w-4", rebuildPreviewState === "queued" && "animate-spin")} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      {scene.details && (
        <p className="text-text-secondary text-[0.85rem] leading-relaxed max-w-3xl">
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
              "px-4 py-1.5 text-[0.78rem] font-medium transition-colors duration-fast whitespace-nowrap rounded-sm",
              activeTab === tab
                ? "text-text-accent bg-accent-950 border border-border-accent"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2 border border-transparent"
            )}
          >
            {tab}
            {tab === "Markers" && scene.markers.length > 0 && (
              <span className="ml-1.5 text-[0.6rem] text-text-disabled">
                {scene.markers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Details" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Performers */}
            <section>
              <h4 className="text-kicker mb-3 flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                Performers
              </h4>
              {scene.performers.length === 0 ? (
                <p className="text-text-disabled text-sm">
                  No performers tagged
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {scene.performers.map((p) => {
                    const imgUrl = toApiUrl(p.imagePath);
                    const initials = p.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
                    return (
                      <Link
                        key={p.id}
                        href={`/performers/${p.id}`}
                        className="surface-card-sharp flex items-center gap-3 p-2.5 pr-4 hover:border-border-accent transition-colors"
                      >
                        <div className="flex-shrink-0 h-12 w-9 rounded overflow-hidden bg-surface-3 border border-border-subtle">
                          {imgUrl ? (
                            <img src={imgUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[0.6rem] font-mono font-medium text-text-muted">
                              {initials}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {p.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {p.gender && (
                              <span className="text-xs text-text-disabled capitalize">
                                {p.gender}
                              </span>
                            )}
                            {p.favorite && (
                              <Star className="h-3 w-3 fill-accent-500 text-accent-500" />
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Tags */}
            <section>
              <h4 className="text-kicker mb-3 flex items-center gap-2">
                <TagIcon className="h-3.5 w-3.5" />
                Tags
              </h4>
              {scene.tags.length === 0 ? (
                <p className="text-text-disabled text-sm">No tags</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {scene.tags.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/tags/${tag.id}`}
                      className="tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                    >
                      {tag.name}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* File info sidebar */}
          <div className="surface-panel p-4 space-y-3 h-fit">
            <h4 className="text-kicker">File Information</h4>
            <div className="space-y-2.5">
              <InfoRow
                icon={Monitor}
                label="Resolution"
                value={
                  scene.width && scene.height
                    ? `${scene.width}x${scene.height}`
                    : "—"
                }
              />
              <InfoRow
                icon={FileVideo}
                label="Codec"
                value={
                  [scene.codec, scene.container?.toUpperCase()]
                    .filter(Boolean)
                    .join(" / ") || "—"
                }
              />
              <InfoRow
                icon={HardDrive}
                label="Size"
                value={scene.fileSizeFormatted ?? "—"}
              />
              <InfoRow
                icon={Link2}
                label="Bitrate"
                value={formatBitRate(scene.bitRate)}
              />
              <InfoRow
                icon={Zap}
                label="Framerate"
                value={
                  scene.frameRate ? `${scene.frameRate} fps` : "—"
                }
              />
              <InfoRow
                icon={Play}
                label="Play Count"
                value={String(scene.playCount)}
              />
            </div>

            {/* StashBox IDs */}
            <div className="pt-2 border-t border-border-subtle">
              <h4 className="text-kicker mb-2">StashBox IDs</h4>
              <StashIdChips entityType="scene" entityId={scene.id} compact />
            </div>
          </div>
        </div>
      )}

      {activeTab === "Metadata" && (
        <SceneEdit
          id={scene.id}
          inline
          onSaved={refreshScene}
          currentPlaybackTime={displayTime}
        />
      )}

      {activeTab === "Markers" && (
        <div className="space-y-3">
          {/* Add marker button */}
          {editingMarker !== "new" && (
            <Button variant="secondary" size="sm" onClick={startNewMarker}>
              <Plus className="h-3.5 w-3.5" />
              Add Marker at {formatSecondsInput(Math.floor(displayTime))}
            </Button>
          )}

          {/* New marker form */}
          {editingMarker === "new" && (
            <MarkerForm
              title={markerTitle}
              seconds={markerSeconds}
              endSeconds={markerEndSeconds}
              tagName={markerTagName}
              allTags={allTags}
              saving={savingMarker}
              onTitleChange={setMarkerTitle}
              onSecondsChange={setMarkerSeconds}
              onEndSecondsChange={setMarkerEndSeconds}
              onTagNameChange={setMarkerTagName}
              onSetCurrentTime={() => setMarkerSeconds(Math.floor(currentTimeRef.current))}
              onSetCurrentEndTime={() => setMarkerEndSeconds(Math.floor(currentTimeRef.current))}
              onSave={() => void handleSaveMarker()}
              onCancel={cancelMarkerEdit}
            />
          )}

          {/* Marker list */}
          {scene.markers.length === 0 && editingMarker !== "new" && (
            <div className="surface-well p-8 text-center">
              <p className="text-text-muted text-sm">No markers yet</p>
            </div>
          )}
          {scene.markers.map((marker) => {
            if (editingMarker === marker.id) {
              return (
                <MarkerForm
                  key={marker.id}
                  title={markerTitle}
                  seconds={markerSeconds}
                  endSeconds={markerEndSeconds}
                  tagName={markerTagName}
                  allTags={allTags}
                  saving={savingMarker}
                  onTitleChange={setMarkerTitle}
                  onSecondsChange={setMarkerSeconds}
                  onEndSecondsChange={setMarkerEndSeconds}
                  onTagNameChange={setMarkerTagName}
                  onSetCurrentTime={() => setMarkerSeconds(Math.floor(currentTimeRef.current))}
                  onSetCurrentEndTime={() => setMarkerEndSeconds(Math.floor(currentTimeRef.current))}
                  onSave={() => void handleSaveMarker()}
                  onCancel={cancelMarkerEdit}
                />
              );
            }

            const startMin = Math.floor(marker.seconds / 60);
            const startSec = Math.floor(marker.seconds % 60);
            const timeStr = `${startMin}:${String(startSec).padStart(2, "0")}`;
            let endStr = "";
            if (marker.endSeconds) {
              const endMin = Math.floor(marker.endSeconds / 60);
              const endSec = Math.floor(marker.endSeconds % 60);
              endStr = ` → ${endMin}:${String(endSec).padStart(2, "0")}`;
            }

            return (
              <div
                key={marker.id}
                className="surface-card-sharp flex items-center gap-4 p-3 group"
              >
                <span className="text-mono-tabular text-accent-400 w-24 flex-shrink-0">
                  {timeStr}
                  {endStr && (
                    <span className="text-text-disabled">{endStr}</span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {marker.title}
                  </p>
                </div>
                {marker.primaryTag && (
                  <span className="tag-chip tag-chip-accent flex-shrink-0">
                    {marker.primaryTag.name}
                  </span>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditMarker(marker)}
                    className="p-1 text-text-muted hover:text-text-accent transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteMarker(marker.id)}
                    className="p-1 text-text-muted hover:text-error-text transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "Files" && (
        <div className="surface-well p-4">
          <div className="space-y-2 text-mono-sm">
            <FileInfoRow label="Path" value={scene.filePath ?? "—"} />
            <div className="separator" />
            <FileInfoRow label="Adaptive Stream" value={scene.streamUrl ?? "—"} />
            <div className="separator" />
            <FileInfoRow label="Direct Stream" value={scene.directStreamUrl ?? "—"} />
            <div className="separator" />
            <FileInfoRow
              label="Size"
              value={scene.fileSizeFormatted ?? "—"}
            />
            <div className="separator" />
            <FileInfoRow
              label="Codec"
              value={
                [scene.codec, scene.container?.toUpperCase()]
                  .filter(Boolean)
                  .join(" / ") || "—"
              }
            />
            <div className="separator" />
            <FileInfoRow
              label="Resolution"
              value={
                scene.width && scene.height
                  ? `${scene.width}x${scene.height}`
                  : "—"
              }
            />
            <div className="separator" />
            <FileInfoRow
              label="Duration"
              value={scene.durationFormatted ?? "—"}
            />
            <div className="separator" />
            <FileInfoRow
              label="Bitrate"
              value={formatBitRate(scene.bitRate)}
            />
            <div className="separator" />
            <FileInfoRow
              label="Frame Rate"
              value={scene.frameRate ? `${scene.frameRate} fps` : "—"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-text-muted text-xs">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-mono-sm">{value}</span>
    </div>
  );
}

function FileInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-muted flex-shrink-0">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}

function formatSecondsInput(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseTimeInput(value: string): number {
  const parts = value.split(":").map(Number);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  return Number(value) || 0;
}

function MarkerForm({
  title,
  seconds,
  endSeconds,
  tagName,
  allTags,
  saving,
  onTitleChange,
  onSecondsChange,
  onEndSecondsChange,
  onTagNameChange,
  onSetCurrentTime,
  onSetCurrentEndTime,
  onSave,
  onCancel,
}: {
  title: string;
  seconds: number;
  endSeconds: number | null;
  tagName: string;
  allTags: TagItem[];
  saving: boolean;
  onTitleChange: (v: string) => void;
  onSecondsChange: (v: number) => void;
  onEndSecondsChange: (v: number | null) => void;
  onTagNameChange: (v: string) => void;
  onSetCurrentTime: () => void;
  onSetCurrentEndTime: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [tagFocused, setTagFocused] = useState(false);
  const filteredTags = tagFocused
    ? (tagName.trim()
        ? allTags.filter((t) =>
            t.name.toLowerCase().includes(tagName.toLowerCase())
          )
        : allTags
      ).slice(0, 10)
    : [];

  return (
    <div className="surface-card-sharp p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs text-text-muted">Title</label>
          <input
            className="control-input w-full"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Marker title"
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-text-muted">Start Time</label>
          <div className="flex items-center gap-2">
            <input
              className="control-input flex-1"
              value={formatSecondsInput(seconds)}
              onChange={(e) => onSecondsChange(parseTimeInput(e.target.value))}
              placeholder="0:00"
            />
            <button
              type="button"
              onClick={onSetCurrentTime}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-text-muted hover:text-text-accent surface-well hover:border-border-accent transition-colors rounded-sm"
              title="Set to current playback time"
            >
              <MapPin className="h-3 w-3" />
              Now
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-text-muted">End Time (optional)</label>
          <div className="flex items-center gap-2">
            <input
              className="control-input flex-1"
              value={endSeconds != null ? formatSecondsInput(endSeconds) : ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                onEndSecondsChange(v ? parseTimeInput(v) : null);
              }}
              placeholder="—"
            />
            <button
              type="button"
              onClick={onSetCurrentEndTime}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-text-muted hover:text-text-accent surface-well hover:border-border-accent transition-colors rounded-sm"
              title="Set to current playback time"
            >
              <MapPin className="h-3 w-3" />
              Now
            </button>
            {endSeconds != null && (
              <button
                type="button"
                onClick={() => onEndSecondsChange(null)}
                className="flex items-center justify-center p-1.5 text-text-muted hover:text-error-text transition-colors rounded-sm"
                title="Clear end time"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs text-text-muted">Primary Tag (optional)</label>
          <div className="relative">
            <input
              className="control-input w-full"
              value={tagName}
              onChange={(e) => onTagNameChange(e.target.value)}
              onFocus={() => setTagFocused(true)}
              onBlur={() => setTimeout(() => setTagFocused(false), 150)}
              placeholder="Tag name"
            />
            {filteredTags.length > 0 && (
              <div className="autocomplete-dropdown">
                {filteredTags.map((t) => (
                  <div
                    key={t.id}
                    className="autocomplete-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onTagNameChange(t.name);
                      setTagFocused(false);
                    }}
                  >
                    {t.name}
                    <span className="autocomplete-item-count">{t.sceneCount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={saving || !title.trim()}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save Marker
        </Button>
      </div>
    </div>
  );
}
