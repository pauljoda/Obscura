export const VIDEO_IMAGE_FORMATS = new Set([
  "h264",
  "hevc",
  "h265",
  "vp8",
  "vp9",
  "av1",
  "mpeg4",
  "mpeg2video",
  "wmv3",
  "flv1",
  "theora",
  "vp6f",
  "matroska",
  "webm",
  "mp4",
  "m4v",
  "mkv",
  "mov",
  "avi",
  "wmv",
  "flv",
]);

export const VIDEO_PREVIEW_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

interface VideoImageCandidate {
  isVideo?: boolean | null;
  format?: string | null;
  title?: string | null;
  previewPath?: string | null;
  fileSize?: number | null;
}

export function isVideoImageFormat(format: string | null | undefined): boolean {
  return format ? VIDEO_IMAGE_FORMATS.has(format.toLowerCase()) : false;
}

export function isVideoImage<T extends VideoImageCandidate>(image: T): boolean {
  if (image.isVideo) {
    return true;
  }

  if (isVideoImageFormat(image.format)) {
    return true;
  }

  const ext = image.title?.split(".").pop()?.toLowerCase();
  return ext ? VIDEO_IMAGE_FORMATS.has(ext) : false;
}

export function canUseInlineVideoPreview<T extends VideoImageCandidate>(image: T): boolean {
  if (!isVideoImage(image) || !image.previewPath) {
    return false;
  }

  return image.fileSize == null || image.fileSize <= VIDEO_PREVIEW_MAX_FILE_SIZE_BYTES;
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds) {
    return null;
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatFileSize(bytes: number | null | undefined): string | null {
  if (!bytes) {
    return null;
  }

  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }

  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(0)} MB`;
  }

  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export function getResolutionLabel(height: number | null | undefined): string | null {
  if (!height) {
    return null;
  }

  if (height >= 2160) {
    return "4K";
  }

  if (height >= 1080) {
    return "1080p";
  }

  if (height >= 720) {
    return "720p";
  }

  if (height >= 480) {
    return "480p";
  }

  return `${height}p`;
}
