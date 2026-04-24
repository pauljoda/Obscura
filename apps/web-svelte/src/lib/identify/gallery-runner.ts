import { acceptPluginResult, type PluginExecuteResult } from "$lib/api/scrapers";
import type {
  GalleryRow,
  NormalizedGalleryIdentifyResult,
} from "./identify-types";
import {
  resetPending,
  resolvePluginList,
  seekRow,
  type CommonRunProps,
  type MutableFlag,
  type PluginInfo,
  type RowUpdater,
} from "./runner-utils";

function galleryResult(
  rawResult: Record<string, unknown>,
  normalized: NonNullable<PluginExecuteResult["normalized"]>,
): NormalizedGalleryIdentifyResult {
  return {
    title: normalized.title,
    date: normalized.date,
    details: normalized.details,
    urls: Array.isArray(rawResult.urls)
      ? (rawResult.urls as string[])
      : normalized.url
        ? [normalized.url]
        : [],
    studioName: normalized.studioName,
    performerNames: normalized.performerNames ?? [],
    tagNames: normalized.tagNames ?? [],
    imageUrl: normalized.imageUrl,
  };
}

function buildGalleryInput(row: GalleryRow): Record<string, unknown> {
  return {
    name: row.gallery.title,
    title: row.gallery.title,
  };
}

export async function runGalleryIdentify(
  props: CommonRunProps<GalleryRow>,
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
        entityId: current.gallery.id,
        attempts: [
          {
            action: "galleryByFragment",
            input: buildGalleryInput(current),
            capabilityKey: "galleryByFragment",
          },
        ],
        buildResult: galleryResult,
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

export async function seekGallerySingle(
  idx: number,
  rows: GalleryRow[],
  setRows: RowUpdater<GalleryRow[]>,
  plugins: PluginInfo[],
): Promise<void> {
  const row = rows[idx];
  if (!row || row.status === "accepted" || row.status === "scraping") return;

  setRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "scraping" } : r)),
  );

  const { scrapeResultId, result, matchedProvider } = await seekRow({
    plugins,
    entityId: row.gallery.id,
    attempts: [
      {
        action: "galleryByFragment",
        input: buildGalleryInput(row),
        capabilityKey: "galleryByFragment",
      },
    ],
    buildResult: galleryResult,
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

export async function acceptAllGalleries(
  rows: GalleryRow[],
  setRows: RowUpdater<GalleryRow[]>,
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

// ─── Images ───────────────────────────────────────────────────────
//
// Same note as galleries: no installed plugin advertises imageByURL yet.
// The control flow is wired so future plugins land without web changes.

