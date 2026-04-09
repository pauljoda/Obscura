"use client";

import { type SceneDetail as SceneDetailType } from "../../lib/api";

export interface SceneFileInfoProps {
  scene: SceneDetailType;
}

function formatBitRate(bps: number | null): string {
  if (!bps) return "\u2014";
  if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)} Mbps`;
  return `${(bps / 1000).toFixed(0)} Kbps`;
}

function FileInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-muted flex-shrink-0">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}

export function SceneFileInfo({ scene }: SceneFileInfoProps) {
  return (
    <div className="surface-well p-4">
      <div className="space-y-2 text-mono-sm">
        <FileInfoRow label="Path" value={scene.filePath ?? "\u2014"} />
        <div className="separator" />
        <FileInfoRow
          label="Adaptive Stream"
          value={scene.streamUrl ?? "\u2014"}
        />
        <div className="separator" />
        <FileInfoRow
          label="Direct Stream"
          value={scene.directStreamUrl ?? "\u2014"}
        />
        <div className="separator" />
        <FileInfoRow label="Size" value={scene.fileSizeFormatted ?? "\u2014"} />
        <div className="separator" />
        <FileInfoRow
          label="Codec"
          value={
            [scene.codec, scene.container?.toUpperCase()]
              .filter(Boolean)
              .join(" / ") || "\u2014"
          }
        />
        <div className="separator" />
        <FileInfoRow
          label="Resolution"
          value={
            scene.width && scene.height
              ? `${scene.width}x${scene.height}`
              : "\u2014"
          }
        />
        <div className="separator" />
        <FileInfoRow
          label="Duration"
          value={scene.durationFormatted ?? "\u2014"}
        />
        <div className="separator" />
        <FileInfoRow label="Bitrate" value={formatBitRate(scene.bitRate)} />
        <div className="separator" />
        <FileInfoRow
          label="Frame Rate"
          value={scene.frameRate ? `${scene.frameRate} fps` : "\u2014"}
        />
      </div>
    </div>
  );
}
