"use client";

import { type VideoDetail as VideoDetailType } from "../../lib/api";

export interface VideoFileInfoProps {
  video: VideoDetailType;
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

export function VideoFileInfo({ video }: VideoFileInfoProps) {
  return (
    <div className="surface-well p-4">
      <div className="space-y-2 text-mono-sm">
        <FileInfoRow label="Path" value={video.filePath ?? "\u2014"} />
        <div className="separator" />
        <FileInfoRow
          label="Adaptive Stream"
          value={video.streamUrl ?? "\u2014"}
        />
        <div className="separator" />
        <FileInfoRow
          label="Direct Stream"
          value={video.directStreamUrl ?? "\u2014"}
        />
        <div className="separator" />
        <FileInfoRow label="Size" value={video.fileSizeFormatted ?? "\u2014"} />
        <div className="separator" />
        <FileInfoRow
          label="Codec"
          value={
            [video.codec, video.container?.toUpperCase()]
              .filter(Boolean)
              .join(" / ") || "\u2014"
          }
        />
        <div className="separator" />
        <FileInfoRow
          label="Resolution"
          value={
            video.width && video.height
              ? `${video.width}x${video.height}`
              : "\u2014"
          }
        />
        <div className="separator" />
        <FileInfoRow
          label="Duration"
          value={video.durationFormatted ?? "\u2014"}
        />
        <div className="separator" />
        <FileInfoRow label="Bitrate" value={formatBitRate(video.bitRate)} />
        <div className="separator" />
        <FileInfoRow
          label="Frame Rate"
          value={video.frameRate ? `${video.frameRate} fps` : "\u2014"}
        />
      </div>
    </div>
  );
}
