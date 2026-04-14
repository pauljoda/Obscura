import type { DataMigrationContext, FinalizeResult } from "../types";

/**
 * Destructively drop the legacy scenes/scene_folders family after
 * stage() has successfully populated the new video_* tables and the
 * UI has been adapted to read from the new shape (Plan D).
 */
export async function finalize(
  ctx: DataMigrationContext,
): Promise<FinalizeResult> {
  const { client, logger, reportProgress } = ctx;

  reportProgress(10, "dropping legacy join tables");
  await client`DROP TABLE IF EXISTS scene_folder_tags CASCADE`;
  await client`DROP TABLE IF EXISTS scene_folder_performers CASCADE`;
  await client`DROP TABLE IF EXISTS scene_tags CASCADE`;
  await client`DROP TABLE IF EXISTS scene_performers CASCADE`;
  await client`DROP TABLE IF EXISTS scene_markers CASCADE`;
  await client`DROP TABLE IF EXISTS scene_subtitles CASCADE`;

  reportProgress(40, "dropping legacy scenes and scene_folders");
  await client`DROP TABLE IF EXISTS scenes CASCADE`;
  await client`DROP TABLE IF EXISTS scene_folders CASCADE`;

  reportProgress(80, "dropping legacy scan_videos column");
  await client`ALTER TABLE library_roots DROP COLUMN IF EXISTS scan_videos`;

  reportProgress(100, "finalize complete");
  logger.info("videos_to_series_model_v1 finalize complete");

  return { metrics: {} };
}
