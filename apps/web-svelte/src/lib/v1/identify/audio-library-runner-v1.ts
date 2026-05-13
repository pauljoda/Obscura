import { acceptPluginResult, type PluginExecuteResult } from "$lib/v1/api/scrapers-v1";
import type {
  AudioLibraryRow,
  NormalizedAudioLibraryIdentifyResult,
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


// ─── Audio libraries (albums) ─────────────────────────────────────

function buildAudioLibraryInput(row: AudioLibraryRow): Record<string, unknown> {
  const artist =
    row.library.performers.map((p) => p.name).join(", ") || undefined;
  return {
    name: row.library.title,
    title: row.library.title,
    ...(artist ? { artist } : {}),
  };
}

function audioLibraryResult(
  rawResult: Record<string, unknown>,
  normalized: NonNullable<PluginExecuteResult["normalized"]>,
): NormalizedAudioLibraryIdentifyResult {
  return {
    name: normalized.title ?? (rawResult.name as string | null) ?? null,
    artist: (rawResult.artist as string | null) ?? null,
    details: normalized.details,
    date: normalized.date,
    imageUrl: normalized.imageUrl,
    urls: Array.isArray(rawResult.urls)
      ? (rawResult.urls as string[])
      : normalized.url
        ? [normalized.url]
        : [],
  };
}

export async function runAudioLibraryIdentify(
  props: CommonRunProps<AudioLibraryRow>,
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
        entityId: current.library.id,
        attempts: [
          {
            action: "audioLibraryByName",
            input: buildAudioLibraryInput(current),
            capabilityKey: "audioLibraryByName",
          },
        ],
        buildResult: audioLibraryResult,
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

export async function seekAudioLibrarySingle(
  idx: number,
  rows: AudioLibraryRow[],
  setRows: RowUpdater<AudioLibraryRow[]>,
  plugins: PluginInfo[],
): Promise<void> {
  const row = rows[idx];
  if (!row || row.status === "accepted" || row.status === "scraping") return;

  setRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "scraping" } : r)),
  );

  const { scrapeResultId, result, matchedProvider } = await seekRow({
    plugins,
    entityId: row.library.id,
    attempts: [
      {
        action: "audioLibraryByName",
        input: buildAudioLibraryInput(row),
        capabilityKey: "audioLibraryByName",
      },
    ],
    buildResult: audioLibraryResult,
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

export async function acceptAllAudioLibraries(
  rows: AudioLibraryRow[],
  setRows: RowUpdater<AudioLibraryRow[]>,
): Promise<void> {
  const found = rows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => row.status === "found" && row.result);

  for (const { idx, row } of found) {
    try {
      // accepted rows carry the scrape_result id in matchedProvider-sibling state;
      // the single-entity accept endpoint is keyed on that id.
      const scrapeResultId = row.scrapeResultId;
      if (!scrapeResultId) continue;
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

// ─── Audio tracks ─────────────────────────────────────────────────
