import type { DataMigrationContext, PrecheckResult } from "../types";

/**
 * The videos_to_series migration should run on installs that have a
 * populated `scenes` table and an empty `video_*` table family.
 * Fresh installs (no `scenes` rows) skip it entirely.
 * Re-runs against a partially-populated install bail loudly.
 */
export async function precheck(
  ctx: DataMigrationContext,
): Promise<PrecheckResult> {
  const { client } = ctx;

  const scenesExists = await tableExists(client, "scenes");
  const videoSeriesExists = await tableExists(client, "video_series");

  if (!scenesExists) {
    return {
      ok: false,
      reasons: [
        "`scenes` table does not exist — this is a fresh install, nothing to migrate",
      ],
    };
  }

  if (!videoSeriesExists) {
    return {
      ok: false,
      reasons: [
        "`video_series` table does not exist — Plan A schema migration has not been applied yet",
      ],
    };
  }

  const [sceneCount] = await client<Array<{ count: string }>>`
    SELECT count(*)::text AS count FROM scenes
  `;
  const [videoSeriesCount] = await client<Array<{ count: string }>>`
    SELECT count(*)::text AS count FROM video_series
  `;
  const [videoMoviesCount] = await client<Array<{ count: string }>>`
    SELECT count(*)::text AS count FROM video_movies
  `;
  const [videoEpisodesCount] = await client<Array<{ count: string }>>`
    SELECT count(*)::text AS count FROM video_episodes
  `;

  if (Number.parseInt(sceneCount.count, 10) === 0) {
    return {
      ok: false,
      reasons: ["`scenes` table is empty — nothing to migrate"],
    };
  }

  const alreadyHasNewData =
    Number.parseInt(videoSeriesCount.count, 10) > 0 ||
    Number.parseInt(videoMoviesCount.count, 10) > 0 ||
    Number.parseInt(videoEpisodesCount.count, 10) > 0;
  if (alreadyHasNewData) {
    return {
      ok: false,
      reasons: [
        "`video_*` tables already contain rows; refusing to re-run stage()",
      ],
    };
  }

  return { ok: true, reasons: [] };
}

async function tableExists(
  client: DataMigrationContext["client"],
  tableName: string,
): Promise<boolean> {
  const rows = await client<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS exists
  `;
  return rows[0]?.exists === true;
}
