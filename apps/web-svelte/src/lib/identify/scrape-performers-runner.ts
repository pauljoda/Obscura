import {
  identifyPerformerViaStashBox,
} from "$lib/api/scrapers";
import {
  scrapePerformerApi,
  applyPerformerScrape,
} from "$lib/api/entities";
import type { MutableFlag, RowUpdater } from "./identify-runners";
import {
  SEEK_TIMEOUT_MS,
  withTimeout,
  perfFieldsFromResult,
} from "./scrape-types";
import type {
  PerformerRow,
  ScraperPackage,
  StashBoxEndpoint,
  NormalizedPerformerScrapeResult,
} from "./scrape-types";

async function seekPerformer(
  row: PerformerRow,
  scraperList: ScraperPackage[],
  sbEndpoints: StashBoxEndpoint[],
): Promise<{
  result?: NormalizedPerformerScrapeResult;
  matchedScraper?: string;
}> {
  const performerName = row.performer.name.toLowerCase().trim();

  for (const ep of sbEndpoints) {
    try {
      const res = await withTimeout(
        identifyPerformerViaStashBox(ep.id, row.performer.id),
        SEEK_TIMEOUT_MS,
      );
      if (res.results && res.results.length > 0) {
        const exact = res.results.find(
          (r) => r.name?.toLowerCase().trim() === performerName,
        );
        if (exact) return { result: exact, matchedScraper: ep.name };
      }
    } catch {
      // try next
    }
  }

  for (const scraper of scraperList) {
    try {
      const res = await withTimeout(
        scrapePerformerApi(scraper.id, row.performer.id, { action: "auto" }),
        SEEK_TIMEOUT_MS,
      );
      if (res.result) return { result: res.result, matchedScraper: scraper.name };
      if (res.results && res.results.length > 0) {
        const exact = res.results.find(
          (r) => r.name?.toLowerCase().trim() === performerName,
        );
        if (exact) return { result: exact, matchedScraper: scraper.name };
      }
    } catch {
      // try next
    }
  }
  return {};
}

export interface RunPerformerScrapeProps {
  perfRows: PerformerRow[];
  setPerfRows: RowUpdater<PerformerRow[]>;
  perfScrapers: ScraperPackage[];
  stashBoxEndpoints: StashBoxEndpoint[];
  selectedScraperId: string;
  autoAccept: boolean;
  abortRef: MutableFlag;
  setRunning: (running: boolean) => void;
}

export async function runPerformerScrape({
  perfRows,
  setPerfRows,
  perfScrapers,
  stashBoxEndpoints,
  selectedScraperId,
  autoAccept,
  abortRef,
  setRunning,
}: RunPerformerScrapeProps) {
  setRunning(true);
  abortRef.current = false;

  const isStashBox = selectedScraperId.startsWith("stashbox:");
  const isScraper = selectedScraperId.startsWith("scraper:");
  const realId = selectedScraperId.replace(/^(stashbox|scraper):/, "");

  const scraperList = isScraper
    ? perfScrapers.filter((s) => s.id === realId)
    : selectedScraperId === ""
      ? perfScrapers
      : [];
  const sbEndpoints = isStashBox
    ? stashBoxEndpoints.filter((e) => e.id === realId)
    : selectedScraperId === ""
      ? stashBoxEndpoints
      : [];

  setPerfRows((prev) =>
    prev.map((r) =>
      r.status === "accepted"
        ? r
        : { ...r, status: "pending", result: undefined, error: undefined },
    ),
  );

  for (let i = 0; i < perfRows.length; i++) {
    if (abortRef.current) break;
    if (perfRows[i].status === "accepted") continue;

    setPerfRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r)),
    );

    try {
      const { result, matchedScraper } = await seekPerformer(
        perfRows[i],
        scraperList,
        sbEndpoints,
      );
      if (result) {
        if (autoAccept) {
          const allFields = Object.entries(result)
            .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
            .map(([k]) => k);
          try {
            await applyPerformerScrape(
              perfRows[i].performer.id,
              result as unknown as Record<string, unknown>,
              allFields,
            );
            setPerfRows((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, status: "accepted", result, matchedScraper } : r,
              ),
            );
          } catch {
            setPerfRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? {
                      ...r,
                      status: "found",
                      result,
                      matchedScraper,
                      selectedFields: perfFieldsFromResult(result),
                    }
                  : r,
              ),
            );
          }
        } else {
          setPerfRows((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? {
                    ...r,
                    status: "found",
                    result,
                    matchedScraper,
                    selectedFields: perfFieldsFromResult(result),
                  }
                : r,
            ),
          );
        }
      } else {
        setPerfRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r)),
        );
      }
    } catch (err) {
      setPerfRows((prev) =>
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

export async function acceptPerformerRow(
  perfRows: PerformerRow[],
  idx: number,
  setPerfRows: RowUpdater<PerformerRow[]>,
  overrideImageUrl?: string,
) {
  const row = perfRows[idx];
  if (!row.result) return;
  const fields = { ...row.result } as Record<string, unknown>;
  if (overrideImageUrl) fields.imageUrl = overrideImageUrl;
  try {
    await applyPerformerScrape(
      row.performer.id,
      fields,
      Array.from(row.selectedFields),
    );
    setPerfRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Accept failed";
    setPerfRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "error", error: message } : r)),
    );
  }
}

export function rejectPerformerRow(
  idx: number,
  setPerfRows: RowUpdater<PerformerRow[]>,
) {
  setPerfRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "rejected" } : r)),
  );
}

export async function acceptAllPerformers(
  perfRows: PerformerRow[],
  setPerfRows: RowUpdater<PerformerRow[]>,
) {
  const found = perfRows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => row.status === "found" && row.result);
  for (const { idx } of found) {
    await acceptPerformerRow(perfRows, idx, setPerfRows);
  }
}
