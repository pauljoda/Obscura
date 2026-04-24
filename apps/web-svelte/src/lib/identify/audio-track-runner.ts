import { acceptPluginResult, type PluginExecuteResult } from "$lib/api/scrapers";
import type {
  AudioTrackRow,
  NormalizedAudioTrackIdentifyResult,
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


function buildAudioTrackInput(row: AudioTrackRow): Record<string, unknown> {
  const performerName =
    row.track.performers[0]?.name ?? row.track.embeddedArtist ?? undefined;
  return {
    title: row.track.title,
    ...(performerName ? { artist: performerName } : {}),
    ...(row.track.embeddedAlbum ? { album: row.track.embeddedAlbum } : {}),
  };
}

function audioTrackResult(
  rawResult: Record<string, unknown>,
  normalized: NonNullable<PluginExecuteResult["normalized"]>,
): NormalizedAudioTrackIdentifyResult {
  return {
    title: normalized.title,
    artist: (rawResult.artist as string | null) ?? null,
    album: (rawResult.album as string | null) ?? null,
    trackNumber:
      typeof rawResult.trackNumber === "number"
        ? (rawResult.trackNumber as number)
        : null,
    date: normalized.date,
    details: normalized.details,
    imageUrl: normalized.imageUrl,
    urls: Array.isArray(rawResult.urls)
      ? (rawResult.urls as string[])
      : normalized.url
        ? [normalized.url]
        : [],
    tagNames: normalized.tagNames ?? [],
  };
}

export async function runAudioTrackIdentify(
  props: CommonRunProps<AudioTrackRow>,
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
        entityId: current.track.id,
        attempts: [
          // `audioByFragment` matches title + artist + album, which is
          // the most accurate identify call for a local track. We don't
          // try `audioByURL` here because the list item doesn't carry a
          // known-URL field; per-row seek from the track detail page
          // can still call that action directly.
          {
            action: "audioByFragment",
            input: buildAudioTrackInput(current),
            capabilityKey: "audioByFragment",
          },
        ],
        buildResult: audioTrackResult,
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

export async function seekAudioTrackSingle(
  idx: number,
  rows: AudioTrackRow[],
  setRows: RowUpdater<AudioTrackRow[]>,
  plugins: PluginInfo[],
): Promise<void> {
  const row = rows[idx];
  if (!row || row.status === "accepted" || row.status === "scraping") return;

  setRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "scraping" } : r)),
  );

  const { scrapeResultId, result, matchedProvider } = await seekRow({
    plugins,
    entityId: row.track.id,
    attempts: [
      {
        action: "audioByFragment",
        input: buildAudioTrackInput(row),
        capabilityKey: "audioByFragment",
      },
    ],
    buildResult: audioTrackResult,
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

export async function acceptAllAudioTracks(
  rows: AudioTrackRow[],
  setRows: RowUpdater<AudioTrackRow[]>,
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

// ─── Galleries ────────────────────────────────────────────────────
//
// No installed plugin currently advertises galleryByURL / galleryByFragment,
// so this runner short-circuits to "no-result" until one does. Wiring it
// through the same control flow as the other runners means the moment
// a gallery-capable plugin is installed, it will Just Work with no
// additional web-app changes.

