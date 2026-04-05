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

export function isVideoImageFormat(format: string | null): boolean {
  return format ? VIDEO_FORMATS.has(format.toLowerCase()) : false;
}

export function getImagePreviewPath(imageId: string, format: string | null): string | null {
  return isVideoImageFormat(format) ? `/assets/images/${imageId}/preview` : null;
}
