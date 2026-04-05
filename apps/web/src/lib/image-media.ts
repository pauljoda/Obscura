import type { ImageListItemDto } from "@obscura/contracts";

const VIDEO_FORMATS = new Set([
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

export function isVideoImage(image: ImageListItemDto): boolean {
  if (image.isVideo) {
    return true;
  }

  if (image.format && VIDEO_FORMATS.has(image.format.toLowerCase())) {
    return true;
  }

  const ext = image.title?.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_FORMATS.has(ext);
}

export function canUseInlineVideoPreview(image: ImageListItemDto): boolean {
  if (!isVideoImage(image) || !image.previewPath) {
    return false;
  }

  return image.fileSize == null || image.fileSize <= VIDEO_PREVIEW_MAX_FILE_SIZE_BYTES;
}
