import type { DataMigrationClient } from "../types";

/**
 * Minimal row shapes returned by the migration reads. These are
 * defined locally instead of derived from the frozen legacy-schema
 * because the migration consumes a handful of columns, not the
 * whole row.
 */

export interface LegacyScene {
  id: string;
  title: string | null;
  details: string | null;
  url: string | null;
  urls: string[] | null;
  date: string | null;
  rating: number | null;
  organized: boolean | null;
  isNsfw: boolean | null;
  episodeNumber: number | null;
  filePath: string | null;
  fileSize: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  bitRate: number | null;
  codec: string | null;
  container: string | null;
  thumbnailPath: string | null;
  cardThumbnailPath: string | null;
  previewPath: string | null;
  spritePath: string | null;
  trickplayVttPath: string | null;
  checksumMd5: string | null;
  oshash: string | null;
  phash: string | null;
  playCount: number | null;
  orgasmCount: number | null;
  playDuration: number | null;
  resumeTime: number | null;
  lastPlayedAt: Date | null;
  studioId: string | null;
  sceneFolderId: string | null;
  createdAt: Date | null;
}

export interface LegacySceneFolder {
  id: string;
  libraryRootId: string | null;
  title: string | null;
  customName: string | null;
  folderPath: string | null;
  relativePath: string | null;
  parentId: string | null;
  depth: number | null;
  isNsfw: boolean | null;
  coverImagePath: string | null;
  backdropImagePath: string | null;
  details: string | null;
  externalSeriesId: string | null;
  studioId: string | null;
  rating: number | null;
  date: string | null;
}

export async function readAllLegacyScenes(
  client: DataMigrationClient,
): Promise<LegacyScene[]> {
  return client<LegacyScene[]>`
    SELECT
      id,
      title,
      details,
      url,
      urls,
      date,
      rating,
      organized,
      is_nsfw        AS "isNsfw",
      episode_number AS "episodeNumber",
      file_path      AS "filePath",
      file_size      AS "fileSize",
      duration,
      width,
      height,
      frame_rate     AS "frameRate",
      bit_rate       AS "bitRate",
      codec,
      container,
      thumbnail_path        AS "thumbnailPath",
      card_thumbnail_path   AS "cardThumbnailPath",
      preview_path          AS "previewPath",
      sprite_path           AS "spritePath",
      trickplay_vtt_path    AS "trickplayVttPath",
      checksum_md5          AS "checksumMd5",
      oshash,
      phash,
      play_count            AS "playCount",
      orgasm_count          AS "orgasmCount",
      play_duration         AS "playDuration",
      resume_time           AS "resumeTime",
      last_played_at        AS "lastPlayedAt",
      studio_id             AS "studioId",
      scene_folder_id       AS "sceneFolderId",
      created_at            AS "createdAt"
    FROM scenes
  `;
}

export async function readAllLegacySceneFolders(
  client: DataMigrationClient,
): Promise<LegacySceneFolder[]> {
  return client<LegacySceneFolder[]>`
    SELECT
      id,
      library_root_id       AS "libraryRootId",
      title,
      custom_name           AS "customName",
      folder_path           AS "folderPath",
      relative_path         AS "relativePath",
      parent_id             AS "parentId",
      depth,
      is_nsfw               AS "isNsfw",
      cover_image_path      AS "coverImagePath",
      backdrop_image_path   AS "backdropImagePath",
      details,
      external_series_id    AS "externalSeriesId",
      studio_id             AS "studioId",
      rating,
      date
    FROM scene_folders
  `;
}

export async function readScenePerformerLinks(
  client: DataMigrationClient,
): Promise<Array<{ sceneId: string; performerId: string }>> {
  return client<Array<{ sceneId: string; performerId: string }>>`
    SELECT scene_id AS "sceneId", performer_id AS "performerId" FROM scene_performers
  `;
}

export async function readSceneTagLinks(
  client: DataMigrationClient,
): Promise<Array<{ sceneId: string; tagId: string }>> {
  return client<Array<{ sceneId: string; tagId: string }>>`
    SELECT scene_id AS "sceneId", tag_id AS "tagId" FROM scene_tags
  `;
}

export async function readSceneFolderPerformerLinks(
  client: DataMigrationClient,
): Promise<Array<{ sceneFolderId: string; performerId: string }>> {
  return client<Array<{ sceneFolderId: string; performerId: string }>>`
    SELECT scene_folder_id AS "sceneFolderId", performer_id AS "performerId" FROM scene_folder_performers
  `;
}

export async function readSceneFolderTagLinks(
  client: DataMigrationClient,
): Promise<Array<{ sceneFolderId: string; tagId: string }>> {
  return client<Array<{ sceneFolderId: string; tagId: string }>>`
    SELECT scene_folder_id AS "sceneFolderId", tag_id AS "tagId" FROM scene_folder_tags
  `;
}

export async function readLibraryRoots(
  client: DataMigrationClient,
): Promise<
  Array<{ id: string; path: string; scanVideos: boolean; scanMovies: boolean; scanSeries: boolean }>
> {
  return client<
    Array<{ id: string; path: string; scanVideos: boolean; scanMovies: boolean; scanSeries: boolean }>
  >`
    SELECT
      id,
      path,
      scan_videos AS "scanVideos",
      scan_movies AS "scanMovies",
      scan_series AS "scanSeries"
    FROM library_roots
    WHERE enabled = true
  `;
}
