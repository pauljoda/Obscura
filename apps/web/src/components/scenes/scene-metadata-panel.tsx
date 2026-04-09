"use client";

import { type ComponentType } from "react";
import Link from "next/link";
import {
  User,
  Tag as TagIcon,
  Monitor,
  HardDrive,
  FileVideo,
  Link2,
  Zap,
  Play,
  Star,
} from "lucide-react";
import {
  toApiUrl,
  type SceneDetail as SceneDetailType,
} from "../../lib/api";
import { StashIdChips } from "../stash-id-chips";
import {
  NsfwBlur,
  NsfwGate,
  NsfwTagLabel,
  tagsVisibleInNsfwMode,
} from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import { useTerms } from "../../lib/terminology";

export interface SceneMetadataPanelProps {
  scene: SceneDetailType;
}

function formatBitRate(bps: number | null): string {
  if (!bps) return "\u2014";
  if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)} Mbps`;
  return `${(bps / 1000).toFixed(0)} Kbps`;
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

export function SceneMetadataPanel({ scene }: SceneMetadataPanelProps) {
  const { mode: nsfwMode } = useNsfw();
  const sceneTagsVisible = tagsVisibleInNsfwMode(scene.tags, nsfwMode);
  const terms = useTerms();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        {/* Performers */}
        <section>
          <h4 className="text-kicker mb-3 flex items-center gap-2">
            <User className="h-3.5 w-3.5" />
            {terms.performers}
          </h4>
          {scene.performers.length === 0 ? (
            <p className="text-text-disabled text-sm">
              No {terms.performers.toLowerCase()} tagged
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {scene.performers.map((p) => {
                const imgUrl = toApiUrl(p.imagePath);
                const initials = p.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <Link
                    key={p.id}
                    href={`/performers/${p.id}`}
                    className="surface-card-sharp flex items-center gap-3 p-2.5 pr-4 hover:border-border-accent transition-colors"
                  >
                    <NsfwBlur
                      isNsfw={scene.isNsfw || (p.isNsfw ?? false)}
                      className="flex-shrink-0 h-12 w-9 overflow-hidden bg-surface-3 border border-border-subtle"
                    >
                      <div className="h-12 w-9 overflow-hidden bg-surface-3">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[0.6rem] font-mono font-medium text-text-muted">
                            {initials}
                          </div>
                        )}
                      </div>
                    </NsfwBlur>
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
          {sceneTagsVisible.length === 0 ? (
            <p className="text-text-disabled text-sm">No tags</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {sceneTagsVisible.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tags/${tag.id}`}
                  className="tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                >
                  <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
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
                : "\u2014"
            }
          />
          <InfoRow
            icon={FileVideo}
            label="Codec"
            value={
              [scene.codec, scene.container?.toUpperCase()]
                .filter(Boolean)
                .join(" / ") || "\u2014"
            }
          />
          <InfoRow
            icon={HardDrive}
            label="Size"
            value={scene.fileSizeFormatted ?? "\u2014"}
          />
          <InfoRow
            icon={Link2}
            label="Bitrate"
            value={formatBitRate(scene.bitRate)}
          />
          <InfoRow
            icon={Zap}
            label="Framerate"
            value={scene.frameRate ? `${scene.frameRate} fps` : "\u2014"}
          />
          <InfoRow
            icon={Play}
            label="Play Count"
            value={String(scene.playCount)}
          />
        </div>

        <NsfwGate>
          <div className="pt-2 border-t border-border-subtle">
            <h4 className="text-kicker mb-2">StashBox IDs</h4>
            <StashIdChips entityType="scene" entityId={scene.id} compact />
          </div>
        </NsfwGate>
      </div>
    </div>
  );
}
