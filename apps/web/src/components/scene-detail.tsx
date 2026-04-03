"use client";

import { useState, useEffect } from "react";
import { VideoPlayer } from "./video-player";
import { Badge, Button } from "@obscura/ui";
import { cn } from "@obscura/ui";
import {
  Star,
  Clock,
  Monitor,
  HardDrive,
  Calendar,
  Bookmark,
  FileVideo,
  Link2,
  Eye,
  Play,
  ArrowLeft,
  Zap,
  User,
  Tag as TagIcon,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { fetchSceneDetail, type SceneDetail as SceneDetailType } from "../lib/api";

const tabs = ["Details", "Markers", "Files", "Related"] as const;
type Tab = (typeof tabs)[number];

function formatBitRate(bps: number | null): string {
  if (!bps) return "—";
  if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)} Mbps`;
  return `${(bps / 1000).toFixed(0)} Kbps`;
}

export function SceneDetail({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("Details");
  const [scene, setScene] = useState<SceneDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchSceneDetail(id)
      .then(setScene)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

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

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/scenes"
        className="inline-flex items-center gap-1.5 text-text-muted text-[0.78rem] hover:text-text-accent transition-colors duration-fast"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Scenes
      </Link>

      {/* Video Player */}
      <VideoPlayer
        src={
          scene.streamUrl
            ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${scene.streamUrl}`
            : undefined
        }
        markers={scene.markers.map((m) => ({
          id: m.id,
          time: m.seconds,
          title: m.title,
          tag: m.primaryTag?.name,
        }))}
        duration={scene.duration ?? undefined}
      />

      {/* Scene header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl">{scene.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-text-muted">
            {scene.studio && (
              <span className="text-text-accent font-medium">
                {scene.studio.name}
              </span>
            )}
            {scene.date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {scene.date}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {scene.durationFormatted}
            </span>
            <span className="flex items-center gap-1">
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
          {/* Rating stars */}
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-4 w-4",
                  i < ratingStars
                    ? "fill-accent-500 text-accent-500"
                    : "text-text-disabled"
                )}
              />
            ))}
            {scene.rating && (
              <span className="text-mono-sm text-text-muted ml-1">
                {scene.rating}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon">
            <Bookmark className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Description */}
      {scene.details && (
        <p className="text-text-secondary text-[0.85rem] leading-relaxed max-w-3xl">
          {scene.details}
        </p>
      )}

      <div className="separator" />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border-subtle overflow-x-auto scrollbar-hidden">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors duration-fast relative whitespace-nowrap",
              activeTab === tab
                ? "text-text-accent"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            {tab}
            {tab === "Markers" && scene.markers.length > 0 && (
              <span className="ml-1.5 text-[0.6rem] text-text-disabled">
                {scene.markers.length}
              </span>
            )}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-accent-500" />
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
                  {scene.performers.map((p) => (
                    <Link
                      key={p.id}
                      href={`/performers/${p.id}`}
                      className="surface-card-sharp flex items-center gap-3 p-3 hover:border-border-accent transition-colors"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-surface-3 text-sm font-medium text-text-muted">
                        {p.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
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
                  ))}
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

            {/* Organized status */}
            <div className="pt-2 border-t border-border-subtle">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Organized</span>
                <span
                  className={cn(
                    "text-mono-sm",
                    scene.organized
                      ? "text-success-text"
                      : "text-text-disabled"
                  )}
                >
                  {scene.organized ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Markers" && (
        <div className="space-y-2">
          {scene.markers.length === 0 ? (
            <div className="surface-well p-8 text-center">
              <Bookmark className="h-8 w-8 text-text-disabled mx-auto mb-2" />
              <p className="text-text-muted text-sm">No markers yet</p>
            </div>
          ) : (
            scene.markers.map((marker) => {
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
                  className="surface-card-sharp flex items-center gap-4 p-3 cursor-pointer hover:border-border-accent transition-colors"
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
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "Files" && (
        <div className="surface-well p-4">
          <div className="space-y-2 text-mono-sm">
            <FileInfoRow label="Path" value={scene.filePath ?? "—"} />
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

      {activeTab === "Related" && (
        <div className="surface-well p-8 text-center">
          <p className="text-text-muted text-sm">
            Related scenes will appear once fingerprinting is complete.
          </p>
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
  icon: React.ComponentType<{ className?: string }>;
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
