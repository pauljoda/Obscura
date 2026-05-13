import { acceptPluginResult, type PluginExecuteResult } from "$lib/v1/api/scrapers-v1";
import type {
  ImageRow,
  NormalizedImageIdentifyResult,
} from "./identify-types-v1";
import {
  resetPending,
  resolvePluginList,
  seekRow,
  type CommonRunProps,
  type MutableFlag,
  type PluginInfo,
  type RowUpdater,
} from "./runner-utils-v1";

function imageResult(
  rawResult: Record<string, unknown>,
  normalized: NonNullable<PluginExecuteResult["normalized"]>,
): NormalizedImageIdentifyResult {
  return {
    title: normalized.title,
    date: normalized.date,
    details: normalized.details,
    urls: Array.isArray(rawResult.urls)
      ? (rawResult.urls as string[])
      : normalized.url
        ? [normalized.url]
        : [],
    tagNames: normalized.tagNames ?? [],
  };
}

function buildImageInput(row: ImageRow): Record<string, unknown> {
  return {
    title: row.image.title,
    name: row.image.title,
  };
}

export async function runImageIdentify(
  props: CommonRunProps<ImageRow>,
): Promise<void> {
  props.setRunning(true);
  props.abortRef.current = false;

  const pluginList = resolvePluginList(props.selectedProviderId, props.plugins);
  resetPending(props.rows, props.setRows);

  for (let i = 0; i < props.rows.length; i++) {
    if (props.abortRef.current) break;
    const current = props.rows[i];
    if (current.status === "accepted") continue;

    props.setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r)),
    );

    try {
      const { scrapeResultId, result, matchedProvider } = await seekRow({
        plugins: pluginList,
        entityId: current.image.id,
        attempts: [
          {
            action: "imageByURL",
            input: buildImageInput(current),
            capabilityKey: "imageByURL",
          },
        ],
        buildResult: imageResult,
      });

      if (scrapeResultId && result) {
        if (props.autoAccept) {
          try {
            await acceptPluginResult(scrapeResultId);
            props.setRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? { ...r, status: "accepted", result, scrapeResultId, matchedProvider }
                  : r,
              ),
            );
          } catch {
            props.setRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? { ...r, status: "found", result, scrapeResultId, matchedProvider }
                  : r,
              ),
            );
          }
        } else {
          props.setRows((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? { ...r, status: "found", result, scrapeResultId, matchedProvider }
                : r,
            ),
          );
        }
      } else {
        props.setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r)),
        );
      }
    } catch (err) {
      props.setRows((prev) =>
        prev.map((r, idx) =>
          idx === i
            ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" }
            : r,
        ),
      );
    }
  }

  props.setRunning(false);
}

export async function seekImageSingle(
  idx: number,
  rows: ImageRow[],
  setRows: RowUpdater<ImageRow[]>,
  plugins: PluginInfo[],
): Promise<void> {
  const row = rows[idx];
  if (!row || row.status === "accepted" || row.status === "scraping") return;

  setRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "scraping" } : r)),
  );

  const { scrapeResultId, result, matchedProvider } = await seekRow({
    plugins,
    entityId: row.image.id,
    attempts: [
      {
        action: "imageByURL",
        input: buildImageInput(row),
        capabilityKey: "imageByURL",
      },
    ],
    buildResult: imageResult,
  });

  setRows((prev) =>
    prev.map((r, i) =>
      i === idx
        ? result
          ? { ...r, status: "found", result, scrapeResultId, matchedProvider }
          : { ...r, status: "no-result" }
        : r,
    ),
  );
}

export async function acceptAllImages(
  rows: ImageRow[],
  setRows: RowUpdater<ImageRow[]>,
): Promise<void> {
  const found = rows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => row.status === "found" && row.result);

  for (const { idx, row } of found) {
    const scrapeResultId = row.scrapeResultId;
    if (!scrapeResultId) continue;
    try {
      await acceptPluginResult(scrapeResultId, Array.from(row.selectedFields));
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Accept failed";
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "error", error: message } : r)),
      );
    }
  }
}
