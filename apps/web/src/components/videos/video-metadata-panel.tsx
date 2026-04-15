"use client";

import {
  Monitor,
  HardDrive,
  FileVideo,
  Link2,
  Zap,
  Play,
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

export function VideoMetadataPanel({ scene }: VideoMetadataPanelProps) {
  return (
    <MetadataPanel
      sidebar={
        <>
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
