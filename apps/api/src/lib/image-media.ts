import { isVideoImageFormat } from "@obscura/contracts";

export { isVideoImageFormat };

export function getImagePreviewPath(imageId: string, format: string | null): string | null {
  return isVideoImageFormat(format) ? `/assets/images/${imageId}/preview` : null;
}
