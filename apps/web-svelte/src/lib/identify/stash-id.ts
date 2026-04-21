import { createStashId } from "$lib/api/scrapers";
import type { StashIdEntry } from "$lib/api/types";

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
