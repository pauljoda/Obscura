import { createStashId } from "$lib/v1/api/scrapers-v1";
import type { StashIdEntry } from "$lib/v1/api/types-v1";

export async function autoSaveStashId(
  entityType: "video" | "performer" | "studio" | "tag",
  entityId: string,
  stashBoxEndpointId: string,
  remoteStashId: string | undefined | null,
): Promise<StashIdEntry | null> {
  if (!remoteStashId) return null;
  try {
    return await createStashId({
      entityType,
      entityId,
      stashBoxEndpointId,
      stashId: remoteStashId,
    });
  } catch {
    return null;
  }
}
