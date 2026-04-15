import type { DataMigrationContext, FinalizeResult } from "../types";

/**
 * Destructive finalize: drops every legacy `scenes` / `scene_folders`
 * table and its joins now that the new `video_*` tables have been
 * populated and every API service, worker processor, search provider,
 * and route has been ported off them.
 *
 * The orchestrator wraps this call in a transaction and flips the
 * `data_migrations` row to `complete` after it returns. If any of the
 * DROP statements throws, the transaction rolls back and the row is
 * marked `failed` with the error message, leaving the legacy tables in
 * place for operator investigation.
 *
 * This is idempotent by virtue of `DROP TABLE IF EXISTS`, so re-running
 * finalize on a half-dropped install completes cleanly.
 */
export async function finalize(
  ctx: DataMigrationContext,
): Promise<FinalizeResult> {
  const { client, logger, reportProgress } = ctx;

  reportProgress(5, "finalize: dropping legacy scene joins");

  // Drop the join tables first so the parent-table drops below don't
  // have lingering FKs to trip on. Ordering is explicit even though
  // `DROP TABLE ... CASCADE` would handle it; the explicit order is
  // easier to debug when something goes wrong.
  await client`DROP TABLE IF EXISTS scene_folder_performers CASCADE`;
  await client`DROP TABLE IF EXISTS scene_folder_tags CASCADE`;
  await client`DROP TABLE IF EXISTS scene_performers CASCADE`;
  await client`DROP TABLE IF EXISTS scene_tags CASCADE`;
  await client`DROP TABLE IF EXISTS scene_markers CASCADE`;
  await client`DROP TABLE IF EXISTS scene_subtitles CASCADE`;

  reportProgress(40, "finalize: dropping legacy scenes and scene_folders");

  // Parent tables last. fingerprint_submissions and scrape_results
  // previously referenced scenes via FK; those FK constraints were
  // dropped in drizzle migration 0012 so the DROP TABLE below runs
  // cleanly regardless of whether any submission / scrape rows still
  // point at vanished scene ids.
  await client`DROP TABLE IF EXISTS scenes CASCADE`;
  await client`DROP TABLE IF EXISTS scene_folders CASCADE`;

  // NB: drizzle migration 0014 now owns dropping
  // `library_roots.scan_videos` and the `performers/tags/studios.scene_count`
  // counter columns. Finalize used to drop them inline but that left the
  // live schema out of sync with packages/db/src/schema.ts on any install
  // that finalized before 0014 shipped — the SELECT projections would
  // try to read columns that were already gone. 0014 runs every boot
  // with `IF EXISTS` so it's safe regardless of whether a given install
  // already had finalize touch the columns.

  reportProgress(100, "finalize: done");
  logger.info("videos_to_series_model_v1 finalize complete (destructive)");

  return {
    metrics: {
      destructive: true,
      droppedTables: 8,
    },
  };
}
