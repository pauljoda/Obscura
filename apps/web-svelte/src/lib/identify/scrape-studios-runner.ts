import { lookupStudioViaStashBox } from "$lib/api/scrapers";
import {
  updateStudio,
  uploadStudioImageFromUrl,
  findOrCreateStudio,
} from "$lib/api/entities";
import { autoSaveStashId } from "./stash-id";
import type { MutableFlag, RowUpdater } from "./identify-runners";
import { SEEK_TIMEOUT_MS, withTimeout } from "./scrape-types";
import type {
  StudioRow,
  StashBoxEndpoint,
  NormalizedStudioScrapeResult,
} from "./scrape-types";

async function seekStudio(
  row: StudioRow,
  sbEndpoints: StashBoxEndpoint[],
): Promise<{
  result?: NormalizedStudioScrapeResult;
  remoteId?: string;
  endpointId?: string;
  matchedScraper?: string;
}> {
  for (const ep of sbEndpoints) {
    try {
      const res = await withTimeout(
        lookupStudioViaStashBox(ep.id, row.studio.name),
        SEEK_TIMEOUT_MS,
      );
      if (res.studio) {
        return {
          result: {
            name: res.studio.name,
            url: res.studio.urls?.[0]?.url ?? null,
            imageUrl: res.studio.images?.[0]?.url ?? null,
            parentName: res.studio.parent?.name ?? null,
          },
          remoteId: res.studio.id,
          endpointId: ep.id,
          matchedScraper: ep.name,
        };
      }
    } catch {
      // next
    }
  }
  return {};
}

export interface RunStudioScrapeProps {
  studioRows: StudioRow[];
  setStudioRows: RowUpdater<StudioRow[]>;
  stashBoxEndpoints: StashBoxEndpoint[];
  selectedScraperId: string;
  autoAccept: boolean;
  abortRef: MutableFlag;
  setRunning: (running: boolean) => void;
}

export async function runStudioScrape({
  studioRows,
  setStudioRows,
  stashBoxEndpoints,
  selectedScraperId,
  autoAccept,
  abortRef,
  setRunning,
}: RunStudioScrapeProps) {
  setRunning(true);
  abortRef.current = false;

  const isStashBox = selectedScraperId.startsWith("stashbox:");
  const realId = selectedScraperId.replace(/^stashbox:/, "");
  const sbEndpoints = isStashBox
    ? stashBoxEndpoints.filter((e) => e.id === realId)
    : selectedScraperId === ""
      ? stashBoxEndpoints
      : [];

  setStudioRows((prev) =>
    prev.map((r) =>
      r.status === "accepted"
        ? r
        : { ...r, status: "pending", result: undefined, error: undefined },
    ),
  );

  for (let i = 0; i < studioRows.length; i++) {
    if (abortRef.current) break;
    if (studioRows[i].status === "accepted") continue;

    setStudioRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r)),
    );

    try {
      const { result, remoteId, endpointId, matchedScraper } = await seekStudio(
        studioRows[i],
        sbEndpoints,
      );
      if (result) {
        const fields = new Set(
          Object.entries(result)
            .filter(([k, v]) => v != null && v !== "" && k !== "parentName")
            .map(([k]) => k),
        );
        if (autoAccept) {
          try {
            const data: Record<string, unknown> = {};
            if (result.url) data.url = result.url;
            await updateStudio(studioRows[i].studio.id, data);
            if (result.imageUrl) {
              try {
                await uploadStudioImageFromUrl(
                  studioRows[i].studio.id,
                  result.imageUrl,
                );
              } catch (e) {
                console.error("Studio image download failed:", e);
              }
            }
            if (endpointId && remoteId)
              await autoSaveStashId(
                "studio",
                studioRows[i].studio.id,
                endpointId,
                remoteId,
              );
            setStudioRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? {
                      ...r,
                      status: "accepted",
                      result,
                      remoteId,
                      endpointId,
                      matchedScraper,
                      selectedFields: fields,
                    }
                  : r,
              ),
            );
          } catch {
            setStudioRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? {
                      ...r,
                      status: "found",
                      result,
                      remoteId,
                      endpointId,
                      matchedScraper,
                      selectedFields: fields,
                    }
                  : r,
              ),
            );
          }
        } else {
          setStudioRows((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? {
                    ...r,
                    status: "found",
                    result,
                    remoteId,
                    endpointId,
                    matchedScraper,
                    selectedFields: fields,
                  }
                : r,
            ),
          );
        }
      } else {
        setStudioRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r)),
        );
      }
    } catch (err) {
      setStudioRows((prev) =>
        prev.map((r, idx) =>
          idx === i
            ? {
                ...r,
                status: "error",
                error: err instanceof Error ? err.message : "Failed",
              }
            : r,
        ),
      );
    }
  }
  setRunning(false);
}

export async function acceptStudioRow(
  studioRows: StudioRow[],
  idx: number,
  setStudioRows: RowUpdater<StudioRow[]>,
) {
  const row = studioRows[idx];
  if (!row.result) return;
  try {
    const data: Record<string, unknown> = {};
    if (row.selectedFields.has("url") && row.result.url) data.url = row.result.url;
    if (row.selectedFields.has("name") && row.result.name)
      data.name = row.result.name;
    if (row.selectedFields.has("parentName") && row.result.parentName) {
      try {
        const parentResult = await findOrCreateStudio({ name: row.result.parentName });
        data.parentId = parentResult.id;
      } catch (e) {
        console.error("Parent studio resolution failed:", e);
      }
    }
    await updateStudio(row.studio.id, data);
    if (row.selectedFields.has("imageUrl") && row.result.imageUrl) {
      try {
        await uploadStudioImageFromUrl(row.studio.id, row.result.imageUrl);
      } catch (e) {
        console.error("Studio image download failed:", e);
      }
    }
    if (row.endpointId && row.remoteId)
      await autoSaveStashId("studio", row.studio.id, row.endpointId, row.remoteId);
    setStudioRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Accept failed";
    setStudioRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "error", error: message } : r)),
    );
  }
}

export function rejectStudioRow(
  idx: number,
  setStudioRows: RowUpdater<StudioRow[]>,
) {
  setStudioRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "rejected" } : r)),
  );
}

export async function acceptAllStudios(
  studioRows: StudioRow[],
  setStudioRows: RowUpdater<StudioRow[]>,
) {
  const found = studioRows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => row.status === "found" && row.result);
  for (const { idx } of found) await acceptStudioRow(studioRows, idx, setStudioRows);
}
