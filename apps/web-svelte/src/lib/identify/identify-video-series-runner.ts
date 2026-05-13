import { executePlugin, acceptPluginResult } from "$lib/v1/api/scrapers-v1";
import {
  fetchVideoSeriesLibraryDetail,
  type VideoSeriesLibraryDetail,
} from "$lib/v1/api/videos-v1";
import type { MutableFlag, RowUpdater } from "./runner-utils";
import { SEEK_TIMEOUT_MS, withTimeout } from "./scrape-types";
import type {
  VideoSeriesRow,
  NormalizedSeriesIdentifyResult,
} from "./identify-types";

interface PluginInfo {
  id: string;
  name: string;
}

/**
 * Build the `localSeasons` cascade input that TMDB (and any other
 * cascade plugin) consumes to match user-held episodes against the
 * remote season / episode tree.
 */
export function buildLocalSeasonsInput(detail: VideoSeriesLibraryDetail):
  | {
      localSeasons: Array<{
        seasonNumber: number;
        episodes: Array<{
          episodeNumber: number;
          localFilePath: string;
          title: string | null;
        }>;
      }>;
    }
  | undefined {
  const seasons = detail.seasons
    .map((s) => ({
      seasonNumber: s.seasonNumber,
      episodes: s.episodes
        .filter((e) => e.episodeNumber != null)
        .map((e) => ({
          episodeNumber: e.episodeNumber!,
          localFilePath: e.filePath,
          title: e.title,
        })),
    }))
    .filter((s) => s.episodes.length > 0);
  return seasons.length ? { localSeasons: seasons } : undefined;
}

async function seekSeriesViaPlugin(
  row: VideoSeriesRow,
  pluginList: PluginInfo[],
): Promise<{
  scrapeResultId?: string;
  seriesResult?: NormalizedSeriesIdentifyResult;
  matchedProvider?: string;
}> {
  for (const plugin of pluginList) {
    try {
      let pluginInput: Record<string, unknown> = {
        name: row.series.displayTitle || row.series.title,
        title: row.series.displayTitle || row.series.title,
      };
      try {
        const seriesLib = await fetchVideoSeriesLibraryDetail(row.series.id);
        const extra = buildLocalSeasonsInput(seriesLib);
        if (extra) pluginInput = { ...pluginInput, ...extra };
      } catch {
        // Series-only metadata still lets the plugin try.
      }

      const res = await withTimeout(
        executePlugin(plugin.id, "folderByName", pluginInput, {
          saveResult: true,
          entityId: row.series.id,
        }),
        SEEK_TIMEOUT_MS * 6,
      );
      if (res.ok && res.result && res.normalized) {
        const savedRow = res.result as Record<string, unknown>;
        const rawResult = savedRow.rawResult as Record<string, unknown> | undefined;
        const seriesResult: NormalizedSeriesIdentifyResult = {
          name: res.normalized.title,
          details: res.normalized.details,
          date: res.normalized.date,
          imageUrl: res.normalized.imageUrl,
          backdropUrl: (rawResult?.backdropUrl as string) ?? null,
          studioName: res.normalized.studioName,
          tagNames: res.normalized.tagNames ?? [],
          urls:
            (rawResult?.urls as string[]) ??
            (res.normalized.url ? [res.normalized.url] : []),
          seriesExternalId: rawResult?.seriesExternalId as string | undefined,
          seasonCount: rawResult?.seasonCount as number | undefined,
          totalEpisodes: rawResult?.totalEpisodes as number | undefined,
        };
        return {
          scrapeResultId: savedRow.id as string,
          seriesResult,
          matchedProvider: plugin.name,
        };
      }
    } catch {
      // next plugin
    }
  }
  return {};
}

export interface RunVideoSeriesIdentifyProps {
  rows: VideoSeriesRow[];
  setRows: RowUpdater<VideoSeriesRow[]>;
  plugins: PluginInfo[];
  selectedProviderId: string;
  autoAccept: boolean;
  abortRef: MutableFlag;
  setRunning: (running: boolean) => void;
}

export async function runVideoSeriesIdentify({
  rows,
  setRows,
  plugins,
  selectedProviderId,
  autoAccept,
  abortRef,
  setRunning,
}: RunVideoSeriesIdentifyProps): Promise<void> {
  setRunning(true);
  abortRef.current = false;

  const isPlugin = selectedProviderId.startsWith("plugin:");
  const realId = selectedProviderId.replace(/^plugin:/, "");
  const pluginList = isPlugin
    ? plugins.filter((p) => p.id === realId)
    : selectedProviderId === ""
      ? plugins
      : [];

  setRows((prev) =>
    prev.map((r) =>
      r.status === "accepted"
        ? r
        : {
            ...r,
            status: "pending",
            result: undefined,
            error: undefined,
            matchedProvider: undefined,
          },
    ),
  );

  for (let i = 0; i < rows.length; i++) {
    if (abortRef.current) break;
    if (rows[i].status === "accepted") continue;

    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r)),
    );

    try {
      const { scrapeResultId, seriesResult, matchedProvider } =
        await seekSeriesViaPlugin(rows[i], pluginList);
      if (scrapeResultId && seriesResult) {
        if (autoAccept) {
          try {
            await acceptPluginResult(scrapeResultId);
            setRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? {
                      ...r,
                      status: "accepted",
                      result: seriesResult,
                      scrapeResultId,
                      matchedProvider,
                    }
                  : r,
              ),
            );
          } catch {
            setRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? {
                      ...r,
                      status: "found",
                      result: seriesResult,
                      scrapeResultId,
                      matchedProvider,
                    }
                  : r,
              ),
            );
          }
        } else {
          setRows((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? {
                    ...r,
                    status: "found",
                    result: seriesResult,
                    scrapeResultId,
                    matchedProvider,
                  }
                : r,
            ),
          );
        }
      } else {
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r)),
        );
      }
    } catch (err) {
      setRows((prev) =>
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

export async function seekSeriesSingle(
  idx: number,
  rows: VideoSeriesRow[],
  setRows: RowUpdater<VideoSeriesRow[]>,
  pluginList: PluginInfo[],
) {
  const row = rows[idx];
  if (!row || row.status === "accepted" || row.status === "scraping") return;

  setRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "scraping" } : r)),
  );

  try {
    const { scrapeResultId, seriesResult, matchedProvider } =
      await seekSeriesViaPlugin(row, pluginList);
    if (seriesResult) {
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                status: "found",
                result: seriesResult,
                scrapeResultId,
                matchedProvider,
              }
            : r,
        ),
      );
    } else {
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "no-result" } : r)),
      );
    }
  } catch (err) {
    setRows((prev) =>
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

export async function acceptAllVideoSeries(
  rows: VideoSeriesRow[],
  setRows: RowUpdater<VideoSeriesRow[]>,
): Promise<void> {
  const found = rows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => row.status === "found" && row.scrapeResultId);

  for (const { row, idx } of found) {
    try {
      await acceptPluginResult(row.scrapeResultId!, Array.from(row.selectedFields));
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Accept failed";
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, status: "error", error: message } : r,
        ),
      );
    }
  }
}
