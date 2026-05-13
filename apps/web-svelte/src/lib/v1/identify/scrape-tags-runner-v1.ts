import { lookupTagViaStashBox } from "$lib/v1/api/scrapers-v1";
import { updateTag } from "$lib/v1/api/entities-v1";
import { autoSaveStashId } from "./stash-id-v1";
import type { MutableFlag, RowUpdater } from "./runner-utils-v1";
import { SEEK_TIMEOUT_MS, withTimeout } from "./scrape-types-v1";
import type {
  TagRow,
  StashBoxEndpoint,
  NormalizedTagScrapeResult,
} from "./scrape-types-v1";

async function seekTag(
  row: TagRow,
  sbEndpoints: StashBoxEndpoint[],
): Promise<{
  result?: NormalizedTagScrapeResult;
  remoteId?: string;
  endpointId?: string;
  matchedScraper?: string;
}> {
  const original = row.tag.name.trim();
  const variants = new Set([original]);
  if (original.includes("-")) variants.add(original.replace(/-/g, " "));
  if (original.includes("_")) variants.add(original.replace(/_/g, " "));
  if (original.includes(" ")) {
    variants.add(original.replace(/ /g, "-"));
    variants.add(original.replace(/ /g, "_"));
  }

  for (const ep of sbEndpoints) {
    for (const query of variants) {
      try {
        const res = await withTimeout(
          lookupTagViaStashBox(ep.id, query),
          SEEK_TIMEOUT_MS,
        );
        if (res.tags && res.tags.length > 0) {
          const queryLower = query.toLowerCase();
          const match = res.tags.find(
            (t) =>
              t.name.toLowerCase().trim() === queryLower ||
              t.aliases?.some((a) => a.toLowerCase().trim() === queryLower),
          );
          if (match) {
            return {
              result: {
                name: match.name,
                description: match.description ?? null,
                aliases: match.aliases?.join(", ") ?? null,
              },
              remoteId: match.id,
              endpointId: ep.id,
              matchedScraper: ep.name,
            };
          }
        }
      } catch {
        // next
      }
    }
  }
  return {};
}

export interface RunTagScrapeProps {
  tagRows: TagRow[];
  setTagRows: RowUpdater<TagRow[]>;
  stashBoxEndpoints: StashBoxEndpoint[];
  selectedScraperId: string;
  autoAccept: boolean;
  abortRef: MutableFlag;
  setRunning: (running: boolean) => void;
}

export async function runTagScrape({
  tagRows,
  setTagRows,
  stashBoxEndpoints,
  selectedScraperId,
  autoAccept,
  abortRef,
  setRunning,
}: RunTagScrapeProps) {
  setRunning(true);
  abortRef.current = false;

  const isStashBox = selectedScraperId.startsWith("stashbox:");
  const realId = selectedScraperId.replace(/^stashbox:/, "");
  const sbEndpoints = isStashBox
    ? stashBoxEndpoints.filter((e) => e.id === realId)
    : selectedScraperId === ""
      ? stashBoxEndpoints
      : [];

  setTagRows((prev) =>
    prev.map((r) =>
      r.status === "accepted"
        ? r
        : { ...r, status: "pending", result: undefined, error: undefined },
    ),
  );

  for (let i = 0; i < tagRows.length; i++) {
    if (abortRef.current) break;
    if (tagRows[i].status === "accepted") continue;

    setTagRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r)),
    );

    try {
      const { result, remoteId, endpointId, matchedScraper } = await seekTag(
        tagRows[i],
        sbEndpoints,
      );
      if (result) {
        const fields = new Set(
          Object.entries(result)
            .filter(([, v]) => v != null && v !== "")
            .map(([k]) => k),
        );
        if (autoAccept) {
          try {
            const data: Record<string, unknown> = {};
            if (result.description) data.description = result.description;
            if (result.aliases) data.aliases = result.aliases;
            await updateTag(tagRows[i].tag.id, data);
            if (endpointId && remoteId)
              await autoSaveStashId("tag", tagRows[i].tag.id, endpointId, remoteId);
            setTagRows((prev) =>
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
            setTagRows((prev) =>
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
          setTagRows((prev) =>
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
        setTagRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r)),
        );
      }
    } catch (err) {
      setTagRows((prev) =>
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

export async function acceptTagRow(
  tagRows: TagRow[],
  idx: number,
  setTagRows: RowUpdater<TagRow[]>,
) {
  const row = tagRows[idx];
  if (!row.result) return;
  try {
    const data: Record<string, unknown> = {};
    if (row.selectedFields.has("description") && row.result.description)
      data.description = row.result.description;
    if (row.selectedFields.has("aliases") && row.result.aliases)
      data.aliases = row.result.aliases;
    await updateTag(row.tag.id, data);
    if (row.endpointId && row.remoteId)
      await autoSaveStashId("tag", row.tag.id, row.endpointId, row.remoteId);
    setTagRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Accept failed";
    setTagRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "error", error: message } : r)),
    );
  }
}

export function rejectTagRow(idx: number, setTagRows: RowUpdater<TagRow[]>) {
  setTagRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "rejected" } : r)),
  );
}

export async function acceptAllTags(
  tagRows: TagRow[],
  setTagRows: RowUpdater<TagRow[]>,
) {
  const found = tagRows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => row.status === "found" && row.result);
  for (const { idx } of found) await acceptTagRow(tagRows, idx, setTagRows);
}
