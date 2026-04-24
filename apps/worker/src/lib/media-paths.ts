import { resolveExistingMediaPath } from "@obscura/media-core";

export function resolveRequiredMediaPath(filePath: string): string {
  const resolved = resolveExistingMediaPath(filePath);
  if (!resolved) {
    throw new Error(`Video file not found on disk: ${filePath}`);
  }
  return resolved;
}
