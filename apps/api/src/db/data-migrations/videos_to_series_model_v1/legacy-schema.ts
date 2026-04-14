/**
 * Frozen Drizzle table definitions for the retired `scenes` and
 * `scene_folders` family. This file is ONLY imported by
 * videos_to_series_model_v1's stage and finalize functions.
 *
 * Do not import from `packages/db/src/schema.ts` here — that file
 * only describes the current schema, which will diverge from what
 * this migration needs to read once the finalize step lands.
 *
 * When the migration has been exercised in production and the
 * legacy tables have been dropped, this file gets deleted in a
 * follow-up commit (see Plan E).
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const legacyScenes = pgTable("scenes", {
  id: uuid("id").primaryKey(),
  title: text("title"),
  details: text("details"),
  url: text("url"),
  urls: jsonb("urls").$type<string[]>(),
  date: text("date"),
  rating: integer("rating"),
  organized: boolean("organized"),
  isNsfw: boolean("is_nsfw"),
  interactive: boolean("interactive"),
  episodeNumber: integer("episode_number"),
  filePath: text("file_path"),
  fileSize: real("file_size"),
  duration: real("duration"),
  width: integer("width"),
  height: integer("height"),
  frameRate: real("frame_rate"),
  bitRate: integer("bit_rate"),
  codec: text("codec"),
  container: text("container"),
  thumbnailPath: text("thumbnail_path"),
  cardThumbnailPath: text("card_thumbnail_path"),
  previewPath: text("preview_path"),
  spritePath: text("sprite_path"),
  trickplayVttPath: text("trickplay_vtt_path"),
  checksumMd5: text("checksum_md5"),
  oshash: text("oshash"),
  phash: text("phash"),
  playCount: integer("play_count"),
  orgasmCount: integer("orgasm_count"),
  playDuration: real("play_duration"),
  resumeTime: real("resume_time"),
  lastPlayedAt: timestamp("last_played_at"),
  studioId: uuid("studio_id"),
  sceneFolderId: uuid("scene_folder_id"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const legacySceneFolders = pgTable("scene_folders", {
  id: uuid("id").primaryKey(),
  libraryRootId: uuid("library_root_id"),
  title: text("title"),
  customName: text("custom_name"),
  folderPath: text("folder_path"),
  relativePath: text("relative_path"),
  parentId: uuid("parent_id"),
  depth: integer("depth"),
  isNsfw: boolean("is_nsfw"),
  coverImagePath: text("cover_image_path"),
  backdropImagePath: text("backdrop_image_path"),
  details: text("details"),
  urls: jsonb("urls").$type<string[]>(),
  externalSeriesId: text("external_series_id"),
  studioId: uuid("studio_id"),
  rating: integer("rating"),
  date: text("date"),
});

export const legacyScenePerformers = pgTable("scene_performers", {
  sceneId: uuid("scene_id").notNull(),
  performerId: uuid("performer_id").notNull(),
});

export const legacySceneTags = pgTable("scene_tags", {
  sceneId: uuid("scene_id").notNull(),
  tagId: uuid("tag_id").notNull(),
});

export const legacySceneFolderPerformers = pgTable(
  "scene_folder_performers",
  {
    sceneFolderId: uuid("scene_folder_id").notNull(),
    performerId: uuid("performer_id").notNull(),
  },
);

export const legacySceneFolderTags = pgTable("scene_folder_tags", {
  sceneFolderId: uuid("scene_folder_id").notNull(),
  tagId: uuid("tag_id").notNull(),
});
