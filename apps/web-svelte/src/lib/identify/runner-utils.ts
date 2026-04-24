/**
 * Shared building blocks for the per-entity identify runners
 * (audio-library, audio-track, gallery, image).
 *
 * Each entity runner follows the same loop:
 *   1. For each pending row, try every eligible plugin in turn.
 *   2. If any returns a result, save a scrape_result via saveResult and
 *      surface it for user review (or auto-accept).
 *   3. Respect the abort flag so "Stop" mid-run works.
 *
 * `seekRow` centralises the per-row plugin loop; the per-entity files
 * stay focused on building inputs and result shapes.
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

export interface PluginInfo {
  id: string;
  name: string;
  /** `null` when the plugin manifest omits a capabilities block. */
  capabilities?: Record<string, boolean> | null;
}

export interface CommonRunProps<TRow> {
  rows: TRow[];
  setRows: RowUpdater<TRow[]>;
  plugins: PluginInfo[];
  selectedProviderId: string;
  autoAccept: boolean;
  abortRef: MutableFlag;
  setRunning: (running: boolean) => void;
}

// ─── Shared helpers ───────────────────────────────────────────────

export function resolvePluginList(
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
export async function callPlugin(
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
export async function seekRow<T>(args: {
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
export function resetPending<TRow extends { status: RowStatus }>(
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
