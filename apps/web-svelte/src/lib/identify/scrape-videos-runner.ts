import {
  scrapeVideo,
  identifyViaStashBox,
  acceptScrapeResult,
  rejectScrapeResult,
  executePlugin,
} from "$lib/api/scrapers";
import type { MutableFlag, RowUpdater } from "./identify-runners";
import { SEEK_TIMEOUT_MS, withTimeout } from "./scrape-types";
import type {
  VideoRow,
  ScraperPackage,
  StashBoxEndpoint,
  ScrapeResult,
  NormalizedScrapeResult,
} from "./scrape-types";

export interface PluginInfo {
  id: string;
  name: string;
}

/* ─── Seek helpers ─────────────────────────────────────────────── */

async function seekVideoViaStashBox(
  row: VideoRow,
  endpoints: StashBoxEndpoint[],
): Promise<{
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  matchedScraper?: string;
  matchType?: string;
}> {
  for (const ep of endpoints) {
    try {
      const res = await withTimeout(
        identifyViaStashBox(ep.id, row.video.id),
        SEEK_TIMEOUT_MS,
      );
      if (res.result && res.normalized) {
        return {
          result: res.result,
          normalized: res.normalized,
          matchedScraper: `${ep.name}${
            res.matchType === "fingerprint" ? " (fingerprint)" : ""
          }`,
          matchType: res.matchType,
        };
      }
    } catch {
      // try next
    }
  }
  return {};
}

async function seekVideoViaPlugin(
  row: VideoRow,
  pluginList: PluginInfo[],
): Promise<{
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  matchedScraper?: string;
}> {
  for (const plugin of pluginList) {
    try {
      const res = await withTimeout(
        executePlugin(
          plugin.id,
          "videoByName",
          { name: row.video.title, title: row.video.title },
          { saveResult: true, entityId: row.video.id },
        ),
        SEEK_TIMEOUT_MS,
      );
      if (res.result && res.normalized) {
        return {
          result: res.result as ScrapeResult,
          normalized: res.normalized,
          matchedScraper: plugin.name,
        };
      }
    } catch {
      // try next
    }
  }
  return {};
}

async function seekVideo(
  row: VideoRow,
  scraperList: ScraperPackage[],
  sbEndpoints: StashBoxEndpoint[],
  pluginList: PluginInfo[] = [],
): Promise<{
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  matchedScraper?: string;
  matchType?: string;
}> {
  if (sbEndpoints.length > 0) {
    const sbResult = await seekVideoViaStashBox(row, sbEndpoints);
    if (sbResult.result) return sbResult;
  }
  if (pluginList.length > 0) {
    const pluginResult = await seekVideoViaPlugin(row, pluginList);
    if (pluginResult.result) return pluginResult;
  }
  for (const scraper of scraperList) {
    try {
      const res = await withTimeout(
        scrapeVideo(scraper.id, row.video.id, "auto"),
        SEEK_TIMEOUT_MS,
      );
      if (res.result && res.normalized) {
        return {
          result: res.result,
          normalized: res.normalized,
          matchedScraper: scraper.name,
        };
      }
    } catch {
      // try next
    }
  }
  return {};
}

/* ─── Bulk runner ──────────────────────────────────────────────── */

export interface RunVideoScrapeProps {
  videoRows: VideoRow[];
  setVideoRows: RowUpdater<VideoRow[]>;
  videoScrapers: ScraperPackage[];
  stashBoxEndpoints: StashBoxEndpoint[];
  selectedScraperId: string;
  autoAccept: boolean;
  abortRef: MutableFlag;
  setRunning: (running: boolean) => void;
  plugins?: PluginInfo[];
}

export async function runVideoScrape({
  videoRows,
  setVideoRows,
  videoScrapers,
  stashBoxEndpoints,
  selectedScraperId,
  autoAccept,
  abortRef,
  setRunning,
  plugins = [],
}: RunVideoScrapeProps) {
  setRunning(true);
  abortRef.current = false;

  const isStashBox = selectedScraperId.startsWith("stashbox:");
  const isScraper = selectedScraperId.startsWith("scraper:");
  const isPlugin = selectedScraperId.startsWith("plugin:");
  const realId = selectedScraperId.replace(/^(stashbox|scraper|plugin):/, "");

  const scraperList = isScraper
    ? videoScrapers.filter((s) => s.id === realId)
    : selectedScraperId === ""
      ? videoScrapers
      : [];
  const sbEndpoints = isStashBox
    ? stashBoxEndpoints.filter((e) => e.id === realId)
    : selectedScraperId === ""
      ? stashBoxEndpoints
      : [];
  const pluginList = isPlugin
    ? plugins.filter((p) => p.id === realId)
    : selectedScraperId === ""
      ? plugins
      : [];

  setVideoRows((prev) =>
    prev.map((r) =>
      r.status === "accepted"
        ? r
        : {
            ...r,
            status: "pending",
            result: undefined,
            normalized: undefined,
            error: undefined,
          },
    ),
  );

  for (let i = 0; i < videoRows.length; i++) {
    if (abortRef.current) break;
    if (videoRows[i].status === "accepted") continue;

    setVideoRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r)),
    );

    try {
      const { result, normalized, matchedScraper } = await seekVideo(
        videoRows[i],
        scraperList,
        sbEndpoints,
        pluginList,
      );
      if (result && normalized) {
        if (autoAccept) {
          try {
            await acceptScrapeResult(result.id);
            setVideoRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? { ...r, status: "accepted", result, normalized, matchedScraper }
                  : r,
              ),
            );
          } catch {
            setVideoRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? { ...r, status: "found", result, normalized, matchedScraper }
                  : r,
              ),
            );
          }
        } else {
          setVideoRows((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? { ...r, status: "found", result, normalized, matchedScraper }
                : r,
            ),
          );
        }
      } else {
        setVideoRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r)),
        );
      }
    } catch (err) {
      setVideoRows((prev) =>
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

/* ─── Single-row seek ──────────────────────────────────────────── */

export async function seekVideoSingle(
  idx: number,
  videoRows: VideoRow[],
  setVideoRows: RowUpdater<VideoRow[]>,
  scraperList: ScraperPackage[],
  sbEndpoints: StashBoxEndpoint[],
  pluginList: PluginInfo[] = [],
) {
  const row = videoRows[idx];
  if (!row || row.status === "accepted" || row.status === "scraping") return;

  setVideoRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "scraping" } : r)),
  );

  try {
    const { result, normalized, matchedScraper } = await seekVideo(
      row,
      scraperList,
      sbEndpoints,
      pluginList,
    );
    if (result && normalized) {
      setVideoRows((prev) =>
        prev.map((r, i) =>
          i === idx
            ? { ...r, status: "found", result, normalized, matchedScraper }
            : r,
        ),
      );
    } else {
      setVideoRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "no-result" } : r)),
      );
    }
  } catch (err) {
    setVideoRows((prev) =>
      prev.map((r, i) =>
        i === idx
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

/* ─── Accept / Reject ───────────────────────────────────────────── */

export async function acceptVideoRow(
  videoRows: VideoRow[],
  idx: number,
  setVideoRows: RowUpdater<VideoRow[]>,
) {
  const row = videoRows[idx];
  if (!row.result) return;
  try {
    await acceptScrapeResult(row.result.id, Array.from(row.selectedFields), {
      excludePerformers: Array.from(row.excludedPerformers),
      excludeTags: Array.from(row.excludedTags),
    });
    setVideoRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Accept failed";
    setVideoRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "error", error: message } : r)),
    );
  }
}

export async function rejectVideoRow(
  videoRows: VideoRow[],
  idx: number,
  setVideoRows: RowUpdater<VideoRow[]>,
) {
  const row = videoRows[idx];
  if (!row.result) return;
  try {
    await rejectScrapeResult(row.result.id);
    setVideoRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, status: "rejected", result: undefined, normalized: undefined }
          : r,
      ),
    );
  } catch {
    // ignore
  }
}

export async function acceptAllVideos(
  videoRows: VideoRow[],
  setVideoRows: RowUpdater<VideoRow[]>,
) {
  const found = videoRows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => row.status === "found" && row.result);
  for (const { row, idx } of found) {
    try {
      await acceptScrapeResult(row.result!.id, Array.from(row.selectedFields), {
        excludePerformers: Array.from(row.excludedPerformers),
        excludeTags: Array.from(row.excludedTags),
      });
      setVideoRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Accept failed";
      setVideoRows((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, status: "error", error: message } : r,
        ),
      );
    }
  }
}
