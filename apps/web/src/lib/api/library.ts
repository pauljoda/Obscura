import { fetchApi } from "./core";
import type {
  JobsDashboard,
  LibraryBrowse,
  LibraryRoot,
  LibrarySettings,
  StorageStats,
} from "./types";

export async function fetchLibraryConfig(): Promise<{
  settings: LibrarySettings;
  roots: LibraryRoot[];
  storage: StorageStats;
}> {
  return fetchApi("/settings/library");
}

export async function updateLibrarySettings(
  payload: Partial<LibrarySettings>,
): Promise<LibrarySettings> {
  return fetchApi("/settings/library", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function browseLibraryPath(targetPath?: string): Promise<LibraryBrowse> {
  const qs = targetPath ? `?path=${encodeURIComponent(targetPath)}` : "";
  return fetchApi(`/libraries/browse${qs}`);
}

export async function createLibraryRoot(payload: {
  path: string;
  label?: string;
  enabled?: boolean;
  recursive?: boolean;
  scanVideos?: boolean;
  scanImages?: boolean;
}): Promise<LibraryRoot> {
  return fetchApi("/libraries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLibraryRoot(
  id: string,
  payload: Partial<
    Pick<LibraryRoot, "path" | "label" | "enabled" | "recursive" | "scanVideos" | "scanImages">
  >,
): Promise<LibraryRoot> {
  return fetchApi(`/libraries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteLibraryRoot(id: string): Promise<{ ok: true }> {
  return fetchApi(`/libraries/${id}`, {
    method: "DELETE",
  });
}

export async function fetchJobsDashboard(): Promise<JobsDashboard> {
  return fetchApi("/jobs");
}

export async function runQueue(queueName: string): Promise<{
  ok: boolean;
  queueName: string;
  enqueued: number;
  jobIds: string[];
}> {
  return fetchApi(`/jobs/queues/${queueName}/run`, {
    method: "POST",
  });
}

export async function cancelQueue(queueName: string): Promise<{
  ok: boolean;
  queueName: string;
  waitingRemoved: number;
  activeRemoved: number;
}> {
  return fetchApi(`/jobs/queues/${queueName}/cancel`, { method: "POST" });
}

export async function rebuildScenePreview(sceneId: string): Promise<{
  ok: boolean;
  jobId: string;
}> {
  return fetchApi(`/jobs/rebuild-preview/${sceneId}`, { method: "POST" });
}

export async function rebuildPreviews(): Promise<{
  ok: boolean;
  enqueued: number;
  jobIds: string[];
}> {
  return fetchApi("/jobs/rebuild-previews", { method: "POST" });
}

export async function acknowledgeJobFailures(queueName?: string): Promise<{
  ok: boolean;
  queueName: string | null;
  redisRemoved: number;
  redisRemovedByQueue: Record<string, number>;
  runsUpdated: number;
}> {
  return fetchApi("/jobs/acknowledge-failed", {
    method: "POST",
    body: JSON.stringify(queueName ? { queueName } : {}),
  });
}
