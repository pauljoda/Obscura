"use client";

import {
  Monitor,
  HardDrive,
  FileVideo,
  Link2,
  Zap,
  Play,
  Tv,
} from "lucide-react";
import {
  type VideoDetail as VideoDetailType,
} from "../../lib/api";
import { StashIdChips } from "../stash-id-chips";
import { NsfwGate } from "../nsfw/nsfw-gate";
import {
  MetadataPanel,
  PerformersSection,
  TagsSection,
  InfoRow,
} from "../shared/metadata-panel";

export interface VideoMetadataPanelProps {
  scene: VideoDetailType;
}

function formatBitRate(bps: number | null): string {
  if (!bps) return "\u2014";
  if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)} Mbps`;
  return `${(bps / 1000).toFixed(0)} Kbps`;
}

/**
 * Compact "S01E03 · Abs 27" label for the episode-info row. Omits
 * parts that aren't set so the output is always readable: a Specials
 * file with episode number 4 renders as "Specials E04"; an episode
 * with only absolute numbering renders as "Abs 27".
 */
function formatEpisodeLabel(
  seasonNumber: number | null,
  episodeNumber: number | null,
  absoluteEpisodeNumber: number | null,
): string {
  const parts: string[] = [];
  if (seasonNumber != null) {
    parts.push(seasonNumber === 0 ? "Specials" : `S${String(seasonNumber).padStart(2, "0")}`);
  }
  if (episodeNumber != null) {
    parts.push(`E${String(episodeNumber).padStart(2, "0")}`);
  }
  if (absoluteEpisodeNumber != null && episodeNumber == null) {
    parts.push(`Abs ${absoluteEpisodeNumber}`);
  } else if (absoluteEpisodeNumber != null) {
    parts.push(`· Abs ${absoluteEpisodeNumber}`);
  }
  return parts.length > 0 ? parts.join(" ") : "\u2014";
}

export function VideoMetadataPanel({ scene }: VideoMetadataPanelProps) {
  const isEpisode = scene.entityKind === "video_episode";
  const hasEpisodeMeta =
    isEpisode &&
    (scene.seasonNumber != null ||
      scene.episodeNumber != null ||
      scene.absoluteEpisodeNumber != null);
  return (
    <MetadataPanel
      sidebar={
        <>
          <h4 className="text-kicker">File Information</h4>
          <div className="space-y-2.5">
            {hasEpisodeMeta && (
              <InfoRow
                icon={Tv}
                label="Episode"
                value={formatEpisodeLabel(
                  scene.seasonNumber,
                  scene.episodeNumber,
                  scene.absoluteEpisodeNumber,
                )}
              />
            )}
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
              <StashIdChips entityType="video" entityId={scene.id} compact />
            </div>
          </NsfwGate>
        </>
      }
    >
      <PerformersSection
        performers={scene.performers}
        parentIsNsfw={scene.isNsfw}
      />
      <TagsSection tags={scene.tags} />
    </MetadataPanel>
  );
}
