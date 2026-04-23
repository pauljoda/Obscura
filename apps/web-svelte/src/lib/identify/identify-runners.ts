/**
 * Plugin-based identify runners for the audio, gallery, and image tabs.
 *
 * Each runner follows the same pattern as `runVideoSeriesIdentify` in
 * identify-video-series-tab.tsx:
 *   1. For each pending row, try every eligible plugin in turn.
 *   2. If any returns a result, save a scrape_result via saveResult and
 *      surface it for user review (or auto-accept).
 *   3. Respect the abort flag so "Stop" mid-run works.
 *
 * These runners are kept outside the tab components so the tabs stay
 * focused on rendering, matching the video / video-series split.
 */

import {
  executePlugin,
  acceptPluginResult,
  type PluginExecuteResult,
} from "$lib/api/scrapers";
import { SEEK_TIMEOUT_MS, withTimeout } from "./scrape-types";
import type {
  AudioLibraryRow,
  AudioTrackRow,
  GalleryRow,
  ImageRow,
  NormalizedAudioLibraryIdentifyResult,
  NormalizedAudioTrackIdentifyResult,
  NormalizedGalleryIdentifyResult,
  NormalizedImageIdentifyResult,
  RowStatus,
} from "./identify-types";

/**
 * Functional row updater passed in from the tab components.
 */
export type RowUpdater<T> = (updater: (prev: T) => T) => void;

/**
 * Stable abort flag that can be flipped from outside the runner.
 */
export interface MutableFlag {
  current: boolean;
}

interface PluginInfo {
  id: string;
  name: string;
  /** `null` when the plugin manifest omits a capabilities block. */
  capabilities?: Record<string, boolean> | null;
}

interface CommonRunProps<TRow> {
  rows: TRow[];
  setRows: RowUpdater<TRow[]>;
  plugins: PluginInfo[];
  selectedProviderId: string;
  autoAccept: boolean;
  abortRef: MutableFlag;
  setRunning: (running: boolean) => void;
}

// ─── Shared helpers ───────────────────────────────────────────────

function resolvePluginList(
  selectedProviderId: string,
  plugins: PluginInfo[],
): PluginInfo[] {
  if (selectedProviderId.startsWith("plugin:")) {
    const realId = selectedProviderId.replace(/^plugin:/, "");
    return plugins.filter((p) => p.id === realId);
  }
  // Empty selected provider === "Seek all"; non-plugin providers
  // (scrapers, stashbox) aren't handled by these runners yet so we
  // just try every capable plugin.
  return plugins;
}

/**
 * Call a single plugin action with a SEEK_TIMEOUT_MS * 6 cap. Returns
 * the execute result on success, or null on any failure (timeout,
 * plugin error, no match).
 */
async function callPlugin(
  pluginId: string,
  action: string,
  input: Record<string, unknown>,
  entityId: string,
): Promise<PluginExecuteResult | null> {
  try {
    const res = await withTimeout(
      executePlugin(pluginId, action, input, {
        saveResult: true,
        entityId,
      }),
      SEEK_TIMEOUT_MS * 6,
    );
    if (res.ok && res.result && res.normalized) return res;
    return null;
  } catch {
    return null;
  }
}

/**
 * Generic per-row runner. Takes a list of {action, input} attempts and
 * tries each against each plugin until one hits. Centralizes the
 * status-transition bookkeeping so the per-entity runners below stay
 * focused on building inputs.
 */
async function seekRow<T>(args: {
  plugins: PluginInfo[];
  entityId: string;
  attempts: Array<{ action: string; input: Record<string, unknown>; capabilityKey: string }>;
  buildResult: (rawResult: Record<string, unknown>, normalized: NonNullable<PluginExecuteResult["normalized"]>) => T;
}): Promise<{
  scrapeResultId?: string;
  result?: T;
  matchedProvider?: string;
}> {
  for (const plugin of args.plugins) {
    for (const attempt of args.attempts) {
      // Honor the plugin's own capability list — don't call an action
      // the plugin doesn't advertise, since the API would reject or the
      // plugin would return null anyway, and each call costs a timeout.
      if (plugin.capabilities && !plugin.capabilities[attempt.capabilityKey]) {
        continue;
      }
      const res = await callPlugin(
        plugin.id,
        attempt.action,
        attempt.input,
        args.entityId,
      );
      if (res && res.result && res.normalized) {
        const savedRow = res.result as Record<string, unknown>;
        const rawResult = (savedRow.rawResult as Record<string, unknown>) ?? {};
        return {
          scrapeResultId: savedRow.id as string,
          result: args.buildResult(rawResult, res.normalized),
          matchedProvider: plugin.name,
        };
      }
    }
  }
  return {};
}

// Reset every non-accepted row to pending so a re-run replaces stale
// results without clobbering rows the user already accepted.
function resetPending<TRow extends { status: RowStatus }>(
  rows: TRow[],
  setRows: RowUpdater<TRow[]>,
) {
  setRows((prev) =>
    prev.map((r) =>
      r.status === "accepted"
        ? r
        : ({
            ...r,
            status: "pending" as const,
            result: undefined,
            error: undefined,
            matchedProvider: undefined,
          } as unknown as TRow),
    ),
  );
  // `rows` is captured for caller convenience; keep the param in the signature
  // so all existing call sites compile unchanged.
  void rows;
}

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
