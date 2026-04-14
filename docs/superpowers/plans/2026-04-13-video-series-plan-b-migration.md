# Video Series Model — Plan B: Data Migration + Shared Classifier

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `videos_to_series_model_v1` data migration — a fully-tested two-phase staged reshape that copies existing `scenes` and `scene_folders` rows into the new `video_series`/`video_seasons`/`video_episodes`/`video_movies` tables while preserving user state (ratings, watch progress, NSFW, performers, tags, scrape history). Plus a shared pure-function classification module that both the migration and Plan D's new scan pipeline will consume.

**Architecture:** Two main deliverables. (1) A self-contained data-migration module under `apps/api/src/db/data-migrations/videos_to_series_model_v1/` with precheck, stage, finalize, a frozen legacy-schema adapter, pure-function classifier, and integration tests against a real test database. (2) A shared `classifyVideoFile()` helper in a new `packages/media-core/src/classifier/` module that takes a file path + library root configuration and returns `{ kind: 'movie' | 'episode' | 'skipped' | 'rejected', series?, season?, reason? }`.

**Key sequencing decision:** The migration module is implemented and tested in Plan B but **not registered in the data-migrations registry**. Registration — which would immediately trigger lockdown on upgrade — is deferred to Plan D, where the UI banner and `finalize` button land together. This keeps Plan B a pure additive landing: nothing observable changes at runtime; existing scans continue writing to `scenes` exactly as they do today.

**Tech Stack:** TypeScript, drizzle-orm, postgres-js, PostgreSQL 16, Vitest (including an integration test mode against a real ephemeral postgres), pnpm workspaces.

**Reference spec:** `docs/superpowers/specs/2026-04-13-video-series-model-design.md`, Sections 5 (parsing — already landed in Plan A), 6.2 (the concrete data migration), and 11 phases 4–5. Plan B implements phase 5 and the shared classifier that phase 4 (Plan D) will reuse.

---

## Scope explicitly cut from Plan B

- **New scan pipeline.** `processLibraryScan` stays as-is writing to `scenes`. Plan D rewrites it.
- **Migration registration.** The migration module is written but `dataMigrationsRegistry` stays empty. Plan D registers it.
- **UI.** Nothing in `apps/web` changes.
- **Plugin contract rework.** Plan C.
- **Removal of `scenes`/`scene_folders` from schema.ts.** Stays in place; the `finalize()` SQL drops the physical tables but the Drizzle definitions remain until Plan D/E.

---

## File Structure

### New files

**Shared classifier** (`packages/media-core/src/classifier/`):
- `packages/media-core/src/classifier/index.ts` — re-exports
- `packages/media-core/src/classifier/types.ts` — result types
- `packages/media-core/src/classifier/classify-video-file.ts` — pure classifier
- `packages/media-core/src/classifier/classify-video-file.test.ts` — unit tests

**Migration module** (`apps/api/src/db/data-migrations/videos_to_series_model_v1/`):
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/index.ts` — `DataMigration` export
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/legacy-schema.ts` — frozen drizzle table definitions for retired tables
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/read.ts` — query helpers that use the legacy schema
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/precheck.ts` — precheck implementation
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/stage.ts` — stage implementation
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/finalize.ts` — finalize implementation
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/series-tree.ts` — pure function: given classified episode files, build the series/season tree
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/README.md` — short developer doc

**Integration tests:**
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/migration.integration.test.ts` — end-to-end stage + finalize test against a real ephemeral postgres DB

### Modified files

- `packages/media-core/src/index.ts` — re-export the classifier module
- `CHANGELOG.md` — Docs + Added entries under `## [Unreleased]`

### Files explicitly NOT touched

- `apps/api/src/db/data-migrations/registry.ts` — stays empty
- `apps/worker/src/processors/library-scan.ts` — untouched; Plan D rewrites
- `apps/worker/src/lib/scene-folder-sync.ts` — untouched
- `packages/db/src/schema.ts` — untouched
- Any drizzle migration file
- Any route file
- Any web UI file

---

## Task list

### Task 1: Classifier types

**Files:**
- Create: `packages/media-core/src/classifier/types.ts`
- Create: `packages/media-core/src/classifier/index.ts`

- [ ] **Step 1: Write `packages/media-core/src/classifier/types.ts`**

```ts
/**
 * Video classification result. Given a file's absolute path and its
 * library root configuration, the classifier decides which typed
 * entity the file should become: a movie, an episode, or neither.
 *
 * Classification is pure. It never touches the filesystem or the
 * database — it only looks at the path segments and the toggles.
 */
export type VideoClassification =
  | VideoClassificationMovie
  | VideoClassificationEpisode
  | VideoClassificationSkipped
  | VideoClassificationRejected;

export interface VideoClassificationMovie {
  kind: "movie";
  filePath: string;
  libraryRootPath: string;
}

export interface VideoClassificationEpisode {
  kind: "episode";
  filePath: string;
  libraryRootPath: string;
  /** Absolute path of the series folder (depth-1 under the library root). */
  seriesFolderPath: string;
  /** Series folder basename used as the default display title. */
  seriesFolderName: string;
  /**
   * Absolute path of the season folder (depth-2 under the library root),
   * or `null` for a flat series where the file lives directly under the
   * series folder (Case A in the spec).
   */
  seasonFolderPath: string | null;
  /** Season folder basename. Null if no season folder exists. */
  seasonFolderName: string | null;
  /**
   * Season number placement per the Case A / Case B rules:
   *
   * - Case A (no season folders under the series) → 0 (the flat series
   *   lives in a single synthetic season).
   * - Case B with a recognized season folder → parsed season number.
   * - Case B, loose file at the series root → 0 (Specials).
   * - Case B, unrecognized folder → 0 as a conservative default.
   */
  placementSeasonNumber: number;
}

export interface VideoClassificationSkipped {
  kind: "skipped";
  filePath: string;
  reason: string;
}

export interface VideoClassificationRejected {
  kind: "rejected";
  filePath: string;
  reason: string;
}

export interface LibraryClassificationConfig {
  libraryRootPath: string;
  scanMovies: boolean;
  scanSeries: boolean;
}
```

- [ ] **Step 2: Write `packages/media-core/src/classifier/index.ts`**

```ts
export * from "./types";
export { classifyVideoFile } from "./classify-video-file";
```

- [ ] **Step 3: Commit**

```bash
git add packages/media-core/src/classifier/types.ts packages/media-core/src/classifier/index.ts
git commit -m "feat(media-core): scaffold video classifier module"
```

---

### Task 2: `classifyVideoFile` — TDD

**Files:**
- Create: `packages/media-core/src/classifier/classify-video-file.test.ts`
- Create: `packages/media-core/src/classifier/classify-video-file.ts`

- [ ] **Step 1: Write the failing test**

Write `packages/media-core/src/classifier/classify-video-file.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { classifyVideoFile } from "./classify-video-file";

const root = {
  libraryRootPath: "/media/library",
  scanMovies: true,
  scanSeries: true,
};

describe("classifyVideoFile", () => {
  describe("depth 0 — files at library root", () => {
    it("classifies as movie when scanMovies is on", () => {
      const result = classifyVideoFile("/media/library/Blade Runner (1982).mkv", root);
      expect(result).toEqual({
        kind: "movie",
        filePath: "/media/library/Blade Runner (1982).mkv",
        libraryRootPath: "/media/library",
      });
    });

    it("skips with warning when scanMovies is off and scanSeries is on", () => {
      const result = classifyVideoFile("/media/library/Loose.mkv", { ...root, scanMovies: false });
      expect(result.kind).toBe("skipped");
      if (result.kind === "skipped") {
        expect(result.reason).toMatch(/loose file at library root/i);
      }
    });

    it("skips silently when both toggles off", () => {
      const result = classifyVideoFile("/media/library/File.mkv", {
        ...root,
        scanMovies: false,
        scanSeries: false,
      });
      expect(result.kind).toBe("skipped");
    });
  });

  describe("depth 1 — files inside a series folder (flat series)", () => {
    it("classifies as episode with seasonFolderPath=null and placementSeasonNumber=0", () => {
      const result = classifyVideoFile(
        "/media/library/The Expanse/S01E01.mkv",
        root,
      );
      expect(result.kind).toBe("episode");
      if (result.kind === "episode") {
        expect(result.seriesFolderPath).toBe("/media/library/The Expanse");
        expect(result.seriesFolderName).toBe("The Expanse");
        expect(result.seasonFolderPath).toBeNull();
        expect(result.seasonFolderName).toBeNull();
        expect(result.placementSeasonNumber).toBe(0);
      }
    });

    it("skips when scanSeries is off", () => {
      const result = classifyVideoFile(
        "/media/library/The Expanse/S01E01.mkv",
        { ...root, scanSeries: false },
      );
      expect(result.kind).toBe("skipped");
    });
  });

  describe("depth 2 — files inside a season folder", () => {
    it("classifies with the parsed season number", () => {
      const result = classifyVideoFile(
        "/media/library/Breaking Bad/Season 1/S01E01.mkv",
        root,
      );
      expect(result.kind).toBe("episode");
      if (result.kind === "episode") {
        expect(result.seriesFolderPath).toBe("/media/library/Breaking Bad");
        expect(result.seriesFolderName).toBe("Breaking Bad");
        expect(result.seasonFolderPath).toBe("/media/library/Breaking Bad/Season 1");
        expect(result.seasonFolderName).toBe("Season 1");
        expect(result.placementSeasonNumber).toBe(1);
      }
    });

    it("maps a Specials folder to season 0", () => {
      const result = classifyVideoFile(
        "/media/library/Breaking Bad/Specials/Behind the Scenes.mkv",
        root,
      );
      expect(result.kind).toBe("episode");
      if (result.kind === "episode") {
        expect(result.placementSeasonNumber).toBe(0);
      }
    });

    it("maps an unrecognized depth-2 folder to season 0 (Specials default)", () => {
      const result = classifyVideoFile(
        "/media/library/Breaking Bad/Extras Folder/Interview.mkv",
        root,
      );
      expect(result.kind).toBe("episode");
      if (result.kind === "episode") {
        expect(result.placementSeasonNumber).toBe(0);
      }
    });
  });

  describe("depth >= 3 — rejected", () => {
    it("rejects files nested too deep", () => {
      const result = classifyVideoFile(
        "/media/library/Anime/One Piece/Arc 1/Episode 1.mkv",
        root,
      );
      expect(result.kind).toBe("rejected");
      if (result.kind === "rejected") {
        expect(result.reason).toMatch(/depth/i);
      }
    });
  });

  describe("file not under root", () => {
    it("rejects files that are not under the library root path", () => {
      const result = classifyVideoFile(
        "/elsewhere/random.mkv",
        root,
      );
      expect(result.kind).toBe("rejected");
    });
  });
});
```

- [ ] **Step 2: Run and confirm FAIL**

```bash
pnpm --filter @obscura/media-core test -- classify-video-file
```

- [ ] **Step 3: Write the implementation**

Write `packages/media-core/src/classifier/classify-video-file.ts`:

```ts
import path from "node:path";
import { parseSeasonFolder } from "../parsing/parse-season-folder";
import type {
  LibraryClassificationConfig,
  VideoClassification,
} from "./types";

/**
 * Classify a video file into a typed entity destination based on its
 * depth under the library root and the library's scan toggles.
 *
 * This function is pure and synchronous. It reads no files and makes
 * no database calls. It never looks at sibling directories to
 * determine "flat series" vs "series with season folders" — that
 * distinction happens at the series-tree-building layer, which sees
 * the full set of classified files.
 */
export function classifyVideoFile(
  filePath: string,
  config: LibraryClassificationConfig,
): VideoClassification {
  const normalizedRoot = path.resolve(config.libraryRootPath);
  const normalizedFile = path.resolve(filePath);

  const relative = path.relative(normalizedRoot, normalizedFile);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return {
      kind: "rejected",
      filePath,
      reason: "file is not under the library root path",
    };
  }

  const segments = relative.split(path.sep).filter((s) => s.length > 0);
  // segments.length === 1 → depth 0 (at root)
  // segments.length === 2 → depth 1 (inside series folder)
  // segments.length === 3 → depth 2 (inside season folder)
  // segments.length >= 4 → depth 3+ (rejected)
  const depth = segments.length - 1;

  if (depth >= 3) {
    return {
      kind: "rejected",
      filePath,
      reason: `file is ${depth} folders deep; the maximum is 2 (library → series → season → file)`,
    };
  }

  if (depth === 0) {
    if (config.scanMovies) {
      return {
        kind: "movie",
        filePath: normalizedFile,
        libraryRootPath: normalizedRoot,
      };
    }
    if (config.scanSeries) {
      return {
        kind: "skipped",
        filePath,
        reason:
          "loose file at library root but only scanSeries is enabled; enable scanMovies or move the file into a series folder",
      };
    }
    return {
      kind: "skipped",
      filePath,
      reason: "both scanMovies and scanSeries are disabled",
    };
  }

  if (!config.scanSeries) {
    return {
      kind: "skipped",
      filePath,
      reason: "file is inside a folder but scanSeries is disabled",
    };
  }

  const seriesFolderName = segments[0];
  const seriesFolderPath = path.join(normalizedRoot, seriesFolderName);

  if (depth === 1) {
    return {
      kind: "episode",
      filePath: normalizedFile,
      libraryRootPath: normalizedRoot,
      seriesFolderPath,
      seriesFolderName,
      seasonFolderPath: null,
      seasonFolderName: null,
      placementSeasonNumber: 0,
    };
  }

  // depth === 2
  const seasonFolderName = segments[1];
  const seasonFolderPath = path.join(
    normalizedRoot,
    seriesFolderName,
    seasonFolderName,
  );
  const parsed = parseSeasonFolder(seasonFolderName);
  const placementSeasonNumber = parsed.seasonNumber ?? 0;

  return {
    kind: "episode",
    filePath: normalizedFile,
    libraryRootPath: normalizedRoot,
    seriesFolderPath,
    seriesFolderName,
    seasonFolderPath,
    seasonFolderName,
    placementSeasonNumber,
  };
}
```

- [ ] **Step 4: Run and confirm PASS**

```bash
pnpm --filter @obscura/media-core test -- classify-video-file
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @obscura/media-core exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add packages/media-core/src/classifier/classify-video-file.ts packages/media-core/src/classifier/classify-video-file.test.ts
git commit -m "feat(media-core): add classifyVideoFile with tests"
```

---

### Task 3: Re-export classifier from media-core index

**Files:**
- Modify: `packages/media-core/src/index.ts`

- [ ] **Step 1: Append re-export**

Append at the end of `packages/media-core/src/index.ts`:

```ts
export * from "./classifier";
```

- [ ] **Step 2: Typecheck + full media-core test suite**

```bash
pnpm --filter @obscura/media-core exec tsc --noEmit
pnpm --filter @obscura/media-core test
```

Expected: typecheck clean, all tests pass (parsing + classifier + existing).

- [ ] **Step 3: Commit**

```bash
git add packages/media-core/src/index.ts
git commit -m "feat(media-core): re-export classifier module from package root"
```

---

### Task 4: Frozen legacy-schema adapter

**Files:**
- Create: `apps/api/src/db/data-migrations/videos_to_series_model_v1/legacy-schema.ts`

This file captures the shape of the old `scenes` / `scene_folders` / joins tables *as of the commit that introduces this migration*. It lives inside the migration directory and must not import from `packages/db/src/schema.ts`. When `finalize()` ships and has been exercised in production, a follow-up commit deletes this file.

- [ ] **Step 1: Write the legacy schema file**

```ts
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
```

Only include columns the migration actually reads. Omitting unused columns keeps the adapter lean.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/data-migrations/videos_to_series_model_v1/legacy-schema.ts
git commit -m "feat(api): add frozen legacy-schema adapter for videos_to_series migration"
```

---

### Task 5: Legacy-schema read helpers

**Files:**
- Create: `apps/api/src/db/data-migrations/videos_to_series_model_v1/read.ts`

- [ ] **Step 1: Write the read helpers**

```ts
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
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/data-migrations/videos_to_series_model_v1/read.ts
git commit -m "feat(api): add legacy-schema read helpers for videos migration"
```

---

### Task 6: Series tree builder

**Files:**
- Create: `apps/api/src/db/data-migrations/videos_to_series_model_v1/series-tree.ts`

Pure function that groups classified episode files into a `series → season → episodes` tree.

- [ ] **Step 1: Write the builder**

```ts
import path from "node:path";
import type { VideoClassificationEpisode } from "@obscura/media-core";

export interface SeriesTreeNode {
  libraryRootPath: string;
  folderPath: string;
  folderName: string;
  /** Relative path from library root, using forward slashes. */
  relativePath: string;
  seasons: Map<number, SeasonTreeNode>;
}

export interface SeasonTreeNode {
  seasonNumber: number;
  /** Null for flat-series synthetic season 0. */
  folderPath: string | null;
  folderName: string | null;
  episodes: VideoClassificationEpisode[];
}

/**
 * Group classified episode files into a series tree keyed by
 * `seriesFolderPath`. Each series has seasons keyed by
 * `placementSeasonNumber`. Episodes land in the matching season.
 */
export function buildSeriesTree(
  episodes: VideoClassificationEpisode[],
): Map<string, SeriesTreeNode> {
  const tree = new Map<string, SeriesTreeNode>();

  for (const episode of episodes) {
    let series = tree.get(episode.seriesFolderPath);
    if (!series) {
      series = {
        libraryRootPath: episode.libraryRootPath,
        folderPath: episode.seriesFolderPath,
        folderName: episode.seriesFolderName,
        relativePath: path
          .relative(episode.libraryRootPath, episode.seriesFolderPath)
          .split(path.sep)
          .join("/"),
        seasons: new Map(),
      };
      tree.set(episode.seriesFolderPath, series);
    }

    let season = series.seasons.get(episode.placementSeasonNumber);
    if (!season) {
      season = {
        seasonNumber: episode.placementSeasonNumber,
        folderPath: episode.seasonFolderPath,
        folderName: episode.seasonFolderName,
        episodes: [],
      };
      series.seasons.set(episode.placementSeasonNumber, season);
    } else if (!season.folderPath && episode.seasonFolderPath) {
      // Prefer a concrete season folder if we encounter one later.
      season.folderPath = episode.seasonFolderPath;
      season.folderName = episode.seasonFolderName;
    }

    season.episodes.push(episode);
  }

  return tree;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/data-migrations/videos_to_series_model_v1/series-tree.ts
git commit -m "feat(api): add series tree builder for videos migration"
```

---

### Task 7: `precheck` implementation

**Files:**
- Create: `apps/api/src/db/data-migrations/videos_to_series_model_v1/precheck.ts`

- [ ] **Step 1: Write precheck**

```ts
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
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/data-migrations/videos_to_series_model_v1/precheck.ts
git commit -m "feat(api): add precheck for videos_to_series migration"
```

---

### Task 8: `stage` implementation

**Files:**
- Create: `apps/api/src/db/data-migrations/videos_to_series_model_v1/stage.ts`

This is the biggest task in Plan B. The stage function:

1. Reads all library roots
2. Reads all legacy scenes
3. Classifies each scene against its library root config (derived from the library root path that contains the scene's file path)
4. Reads all legacy scene folders keyed by `folderPath`
5. Groups classified episodes into a series tree
6. Inserts `video_series` rows keyed by series folderPath. Carries over metadata from the matching `scene_folders` row (customName → title, details → overview, studioId, rating, date → firstAirDate, coverImagePath → posterPath, backdropImagePath → backdropPath, isNsfw, externalSeriesId as `{"tmdb":...}` in `external_ids`). Performers and tags from `scene_folder_performers`/`scene_folder_tags` flow into `video_series_performers` / `video_series_tags`.
7. Inserts `video_seasons` rows per series/season
8. Inserts `video_episodes` rows carrying forward watch state, file metadata, isNsfw, ratings, timestamps from the legacy scene
9. Inserts `video_movies` rows for classified movies, same carry-forward
10. Rewrites `scene_performers` → `video_episode_performers` / `video_movie_performers`
11. Rewrites `scene_tags` → `video_episode_tags` / `video_movie_tags`
12. Updates `scrape_results.entity_type` from `scene` → `episode` / `movie` by matching `entity_id` against the new row mapping. Rows with `scene_folder` entity type re-point at `video_series`.

- [ ] **Step 1: Write stage.ts**

```ts
import path from "node:path";
import {
  classifyVideoFile,
  type VideoClassificationEpisode,
  type VideoClassificationMovie,
} from "@obscura/media-core";
import type {
  DataMigrationContext,
  StageResult,
} from "../types";
import {
  readAllLegacyScenes,
  readAllLegacySceneFolders,
  readScenePerformerLinks,
  readSceneTagLinks,
  readSceneFolderPerformerLinks,
  readSceneFolderTagLinks,
  readLibraryRoots,
  type LegacyScene,
  type LegacySceneFolder,
} from "./read";
import { buildSeriesTree, type SeriesTreeNode } from "./series-tree";

interface StageMetrics {
  librariesProcessed: number;
  scenesTotal: number;
  moviesCreated: number;
  seriesCreated: number;
  seasonsCreated: number;
  episodesCreated: number;
  skipped: number;
  rejectedByDepth: number;
  missingFiles: number;
  sceneFoldersMerged: number;
  performerLinksRewritten: number;
  tagLinksRewritten: number;
  scrapeResultsRewritten: number;
}

export async function stage(
  ctx: DataMigrationContext,
): Promise<StageResult> {
  const { client, logger, reportProgress } = ctx;
  const warnings: string[] = [];
  const metrics: StageMetrics = {
    librariesProcessed: 0,
    scenesTotal: 0,
    moviesCreated: 0,
    seriesCreated: 0,
    seasonsCreated: 0,
    episodesCreated: 0,
    skipped: 0,
    rejectedByDepth: 0,
    missingFiles: 0,
    sceneFoldersMerged: 0,
    performerLinksRewritten: 0,
    tagLinksRewritten: 0,
    scrapeResultsRewritten: 0,
  };

  reportProgress(0, "reading legacy data");
  const libraryRoots = await readLibraryRoots(client);
  metrics.librariesProcessed = libraryRoots.length;

  const legacyScenes = await readAllLegacyScenes(client);
  metrics.scenesTotal = legacyScenes.length;
  const legacyFolders = await readAllLegacySceneFolders(client);
  const folderByPath = new Map<string, LegacySceneFolder>();
  for (const folder of legacyFolders) {
    if (folder.folderPath) folderByPath.set(folder.folderPath, folder);
  }

  reportProgress(10, "classifying scenes");
  const classifiedMovies: Array<{ scene: LegacyScene; result: VideoClassificationMovie }> = [];
  const classifiedEpisodes: Array<{ scene: LegacyScene; result: VideoClassificationEpisode }> = [];

  for (const scene of legacyScenes) {
    if (!scene.filePath) {
      metrics.missingFiles += 1;
      warnings.push(`scene ${scene.id} has a null filePath; skipped`);
      continue;
    }
    const root = libraryRoots.find((r) => scene.filePath!.startsWith(r.path));
    if (!root) {
      metrics.skipped += 1;
      warnings.push(
        `scene ${scene.id} at ${scene.filePath} is not under any enabled library root; skipped`,
      );
      continue;
    }

    // For the migration we turn BOTH toggles on — the user may have
    // had scan_videos=true for the old flat scan, which could have
    // come from either a movie-style library or a series-style one.
    // Classification decides based purely on depth; the scan toggles
    // exist to gate the *scan*, not the one-time migration.
    const classification = classifyVideoFile(scene.filePath, {
      libraryRootPath: root.path,
      scanMovies: true,
      scanSeries: true,
    });

    if (classification.kind === "movie") {
      classifiedMovies.push({ scene, result: classification });
    } else if (classification.kind === "episode") {
      classifiedEpisodes.push({ scene, result: classification });
    } else if (classification.kind === "rejected") {
      metrics.rejectedByDepth += 1;
      warnings.push(
        `scene ${scene.id} at ${scene.filePath} rejected: ${classification.reason}`,
      );
    } else {
      metrics.skipped += 1;
    }
  }

  reportProgress(30, "building series tree");
  const seriesTree = buildSeriesTree(
    classifiedEpisodes.map((c) => c.result),
  );

  reportProgress(40, "inserting video_series");
  // Map of seriesFolderPath -> new video_series id
  const seriesIdByPath = new Map<string, string>();
  for (const [folderPath, node] of seriesTree) {
    const existingFolder = folderByPath.get(folderPath);
    const title = existingFolder?.customName ?? existingFolder?.title ?? node.folderName;
    const libraryRoot = libraryRoots.find((r) => folderPath.startsWith(r.path));
    if (!libraryRoot) {
      warnings.push(`series folder ${folderPath} not under any library root; skipped`);
      continue;
    }
    const externalIds: Record<string, string> = {};
    if (existingFolder?.externalSeriesId) {
      externalIds.tmdb = existingFolder.externalSeriesId;
    }
    const [inserted] = await client<Array<{ id: string }>>`
      INSERT INTO video_series (
        library_root_id, folder_path, relative_path, title,
        overview, studio_id, rating, first_air_date,
        is_nsfw, organized, poster_path, backdrop_path, external_ids
      )
      VALUES (
        ${libraryRoot.id},
        ${folderPath},
        ${node.relativePath},
        ${title},
        ${existingFolder?.details ?? null},
        ${existingFolder?.studioId ?? null},
        ${existingFolder?.rating ?? null},
        ${existingFolder?.date ?? null},
        ${existingFolder?.isNsfw ?? false},
        ${existingFolder ? true : false},
        ${existingFolder?.coverImagePath ?? null},
        ${existingFolder?.backdropImagePath ?? null},
        ${client.json(externalIds)}
      )
      RETURNING id
    `;
    seriesIdByPath.set(folderPath, inserted.id);
    if (existingFolder) metrics.sceneFoldersMerged += 1;
    metrics.seriesCreated += 1;
  }

  reportProgress(55, "inserting video_seasons");
  // Map of `${seriesId}:${seasonNumber}` -> new video_seasons id
  const seasonIdByKey = new Map<string, string>();
  for (const [folderPath, node] of seriesTree) {
    const seriesId = seriesIdByPath.get(folderPath);
    if (!seriesId) continue;
    for (const season of node.seasons.values()) {
      const [inserted] = await client<Array<{ id: string }>>`
        INSERT INTO video_seasons (
          series_id, season_number, folder_path, title, external_ids
        )
        VALUES (
          ${seriesId},
          ${season.seasonNumber},
          ${season.folderPath},
          ${season.folderName ?? null},
          ${client.json({})}
        )
        RETURNING id
      `;
      seasonIdByKey.set(`${seriesId}:${season.seasonNumber}`, inserted.id);
      metrics.seasonsCreated += 1;
    }
  }

  reportProgress(70, "inserting video_episodes");
  // Map of legacy scene id -> new video_episodes id (for rewriting joins)
  const episodeIdBySceneId = new Map<string, string>();
  for (const { scene, result } of classifiedEpisodes) {
    const seriesId = seriesIdByPath.get(result.seriesFolderPath);
    if (!seriesId) continue;
    const seasonId = seasonIdByKey.get(`${seriesId}:${result.placementSeasonNumber}`);
    if (!seasonId) continue;

    const [inserted] = await client<Array<{ id: string }>>`
      INSERT INTO video_episodes (
        season_id, series_id, season_number, episode_number,
        title, overview, file_path, file_size, duration,
        width, height, frame_rate, bit_rate, codec, container,
        checksum_md5, oshash, phash,
        thumbnail_path, card_thumbnail_path, preview_path, sprite_path, trickplay_vtt_path,
        play_count, orgasm_count, play_duration, resume_time, last_played_at,
        rating, is_nsfw, organized, external_ids, created_at
      )
      VALUES (
        ${seasonId},
        ${seriesId},
        ${result.placementSeasonNumber},
        ${scene.episodeNumber},
        ${scene.title},
        ${scene.details},
        ${result.filePath},
        ${scene.fileSize},
        ${scene.duration},
        ${scene.width},
        ${scene.height},
        ${scene.frameRate},
        ${scene.bitRate},
        ${scene.codec},
        ${scene.container},
        ${scene.checksumMd5},
        ${scene.oshash},
        ${scene.phash},
        ${scene.thumbnailPath},
        ${scene.cardThumbnailPath},
        ${scene.previewPath},
        ${scene.spritePath},
        ${scene.trickplayVttPath},
        ${scene.playCount ?? 0},
        ${scene.orgasmCount ?? 0},
        ${scene.playDuration ?? 0},
        ${scene.resumeTime ?? 0},
        ${scene.lastPlayedAt},
        ${scene.rating},
        ${scene.isNsfw ?? false},
        ${scene.organized ?? false},
        ${client.json({})},
        ${scene.createdAt ?? new Date()}
      )
      RETURNING id
    `;
    episodeIdBySceneId.set(scene.id, inserted.id);
    metrics.episodesCreated += 1;
  }

  reportProgress(80, "inserting video_movies");
  // Map of legacy scene id -> new video_movies id
  const movieIdBySceneId = new Map<string, string>();
  for (const { scene, result } of classifiedMovies) {
    const libraryRoot = libraryRoots.find((r) => r.path === result.libraryRootPath);
    if (!libraryRoot) continue;
    const [inserted] = await client<Array<{ id: string }>>`
      INSERT INTO video_movies (
        library_root_id, title, overview, release_date, rating,
        is_nsfw, organized, studio_id, external_ids,
        file_path, file_size, duration, width, height, frame_rate,
        bit_rate, codec, container, checksum_md5, oshash, phash,
        thumbnail_path, card_thumbnail_path, preview_path, sprite_path, trickplay_vtt_path,
        play_count, orgasm_count, play_duration, resume_time, last_played_at,
        created_at
      )
      VALUES (
        ${libraryRoot.id},
        ${scene.title ?? path.basename(result.filePath)},
        ${scene.details},
        ${scene.date},
        ${scene.rating},
        ${scene.isNsfw ?? false},
        ${scene.organized ?? false},
        ${scene.studioId},
        ${client.json({})},
        ${result.filePath},
        ${scene.fileSize},
        ${scene.duration},
        ${scene.width},
        ${scene.height},
        ${scene.frameRate},
        ${scene.bitRate},
        ${scene.codec},
        ${scene.container},
        ${scene.checksumMd5},
        ${scene.oshash},
        ${scene.phash},
        ${scene.thumbnailPath},
        ${scene.cardThumbnailPath},
        ${scene.previewPath},
        ${scene.spritePath},
        ${scene.trickplayVttPath},
        ${scene.playCount ?? 0},
        ${scene.orgasmCount ?? 0},
        ${scene.playDuration ?? 0},
        ${scene.resumeTime ?? 0},
        ${scene.lastPlayedAt},
        ${scene.createdAt ?? new Date()}
      )
      RETURNING id
    `;
    movieIdBySceneId.set(scene.id, inserted.id);
    metrics.moviesCreated += 1;
  }

  reportProgress(88, "rewriting performer and tag joins");
  const scenePerformers = await readScenePerformerLinks(client);
  for (const link of scenePerformers) {
    const episodeId = episodeIdBySceneId.get(link.sceneId);
    const movieId = movieIdBySceneId.get(link.sceneId);
    if (episodeId) {
      await client`
        INSERT INTO video_episode_performers (episode_id, performer_id)
        VALUES (${episodeId}, ${link.performerId})
        ON CONFLICT DO NOTHING
      `;
      metrics.performerLinksRewritten += 1;
    } else if (movieId) {
      await client`
        INSERT INTO video_movie_performers (movie_id, performer_id)
        VALUES (${movieId}, ${link.performerId})
        ON CONFLICT DO NOTHING
      `;
      metrics.performerLinksRewritten += 1;
    }
  }

  const sceneTags = await readSceneTagLinks(client);
  for (const link of sceneTags) {
    const episodeId = episodeIdBySceneId.get(link.sceneId);
    const movieId = movieIdBySceneId.get(link.sceneId);
    if (episodeId) {
      await client`
        INSERT INTO video_episode_tags (episode_id, tag_id)
        VALUES (${episodeId}, ${link.tagId})
        ON CONFLICT DO NOTHING
      `;
      metrics.tagLinksRewritten += 1;
    } else if (movieId) {
      await client`
        INSERT INTO video_movie_tags (movie_id, tag_id)
        VALUES (${movieId}, ${link.tagId})
        ON CONFLICT DO NOTHING
      `;
      metrics.tagLinksRewritten += 1;
    }
  }

  // Folder-level performers and tags → series-level joins.
  const folderPerformers = await readSceneFolderPerformerLinks(client);
  for (const link of folderPerformers) {
    const folder = legacyFolders.find((f) => f.id === link.sceneFolderId);
    if (!folder?.folderPath) continue;
    const seriesId = seriesIdByPath.get(folder.folderPath);
    if (!seriesId) continue;
    await client`
      INSERT INTO video_series_performers (series_id, performer_id)
      VALUES (${seriesId}, ${link.performerId})
      ON CONFLICT DO NOTHING
    `;
    metrics.performerLinksRewritten += 1;
  }

  const folderTags = await readSceneFolderTagLinks(client);
  for (const link of folderTags) {
    const folder = legacyFolders.find((f) => f.id === link.sceneFolderId);
    if (!folder?.folderPath) continue;
    const seriesId = seriesIdByPath.get(folder.folderPath);
    if (!seriesId) continue;
    await client`
      INSERT INTO video_series_tags (series_id, tag_id)
      VALUES (${seriesId}, ${link.tagId})
      ON CONFLICT DO NOTHING
    `;
    metrics.tagLinksRewritten += 1;
  }

  reportProgress(95, "rewriting scrape_results entity types");
  // Re-point scene-entity scrapes to either video_episodes or video_movies.
  for (const [sceneId, episodeId] of episodeIdBySceneId) {
    const { count } = await client`
      UPDATE scrape_results
      SET entity_type = 'episode', entity_id = ${episodeId}
      WHERE entity_type = 'scene' AND entity_id = ${sceneId}
    ` as unknown as { count: number };
    metrics.scrapeResultsRewritten += count ?? 0;
  }
  for (const [sceneId, movieId] of movieIdBySceneId) {
    const { count } = await client`
      UPDATE scrape_results
      SET entity_type = 'movie', entity_id = ${movieId}
      WHERE entity_type = 'scene' AND entity_id = ${sceneId}
    ` as unknown as { count: number };
    metrics.scrapeResultsRewritten += count ?? 0;
  }
  // Re-point scene_folder-entity scrapes to video_series.
  for (const [folderPath, seriesId] of seriesIdByPath) {
    const folder = legacyFolders.find((f) => f.folderPath === folderPath);
    if (!folder) continue;
    const { count } = await client`
      UPDATE scrape_results
      SET entity_type = 'series', entity_id = ${seriesId}
      WHERE entity_type = 'scene_folder' AND entity_id = ${folder.id}
    ` as unknown as { count: number };
    metrics.scrapeResultsRewritten += count ?? 0;
  }

  reportProgress(100, "stage complete");
  logger.info("videos_to_series_model_v1 stage complete", metrics);

  return {
    metrics: metrics as unknown as Record<string, unknown>,
    warnings,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/data-migrations/videos_to_series_model_v1/stage.ts
git commit -m "feat(api): add stage implementation for videos_to_series migration"
```

---

### Task 9: `finalize` implementation

**Files:**
- Create: `apps/api/src/db/data-migrations/videos_to_series_model_v1/finalize.ts`

- [ ] **Step 1: Write finalize**

```ts
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
```

Note: `scene_subtitles` is included in the drop list because it references `scenes.id` via a foreign key — the reference is broken by then but the table still exists. Plan D's scan pipeline will set up the typed equivalent (`video_episode_subtitles` / `video_movie_subtitles`) if needed; Plan B does not migrate subtitle data.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/data-migrations/videos_to_series_model_v1/finalize.ts
git commit -m "feat(api): add finalize implementation for videos_to_series migration"
```

---

### Task 10: Migration index module

**Files:**
- Create: `apps/api/src/db/data-migrations/videos_to_series_model_v1/index.ts`

- [ ] **Step 1: Write the index**

```ts
import type { DataMigration } from "../types";
import { precheck } from "./precheck";
import { stage } from "./stage";
import { finalize } from "./finalize";

export const videosToSeriesModelV1: DataMigration = {
  name: "videos_to_series_model_v1",
  description:
    "Migrate video scenes and scene folders into the typed series / season / episode / movie model.",
  precheck,
  stage,
  finalize,
};
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/data-migrations/videos_to_series_model_v1/index.ts
git commit -m "feat(api): assemble videos_to_series_model_v1 migration module"
```

---

### Task 11: Integration test — stage + finalize end-to-end

**Files:**
- Create: `apps/api/src/db/data-migrations/videos_to_series_model_v1/migration.integration.test.ts`

This test spins up a real database (uses the running dev postgres on `DATABASE_URL` or similar), seeds a representative set of legacy scenes / scene_folders / joins / scrape_results, runs `stage()` directly, asserts the new tables are populated as expected, then runs `finalize()` and asserts the old tables are gone.

- [ ] **Step 1: Check if there's an existing integration test config**

```bash
find /Users/pauldavis/Dev/Obscura -name "vitest.integration*" -type f
cat /Users/pauldavis/Dev/Obscura/vitest.integration.config.ts 2>/dev/null || echo "no integration config yet"
```

If there's no integration test config, this test can run under the regular unit test runner as long as it guards on `DATABASE_URL` being set and skips gracefully otherwise.

- [ ] **Step 2: Write the integration test**

Write `apps/api/src/db/data-migrations/videos_to_series_model_v1/migration.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import { videosToSeriesModelV1 } from "./index";
import type { DataMigrationContext } from "../types";

const DATABASE_URL = process.env.DATABASE_URL;

// Only run if we have a database available — skip cleanly in CI without one.
const shouldRun = !!DATABASE_URL;

const maybeDescribe = shouldRun ? describe : describe.skip;

maybeDescribe("videos_to_series_model_v1 integration", () => {
  let client: ReturnType<typeof postgres>;
  let ctx: DataMigrationContext;

  beforeAll(async () => {
    client = postgres(DATABASE_URL!, { max: 1 });
    ctx = {
      client: client as any,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      reportProgress: () => {},
    };
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    // Clean slate: wipe any data we might have left behind, AND re-create
    // the legacy tables (Plan B leaves scenes/scene_folders intact, but
    // the test may have just run finalize which drops them).
    await client`TRUNCATE video_episode_tags, video_episode_performers, video_episodes, video_seasons, video_series_tags, video_series_performers, video_series, video_movie_tags, video_movie_performers, video_movies RESTART IDENTITY CASCADE`;
    await client`DELETE FROM data_migrations WHERE name = ${videosToSeriesModelV1.name}`;

    // Ensure legacy tables exist. They should exist in the repo's dev DB;
    // if finalize dropped them from a previous test run, re-run migrate first.
    const scenesExists = await client<Array<{ exists: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scenes') AS exists
    `;
    if (!scenesExists[0]?.exists) {
      throw new Error(
        "scenes table is missing — re-run `pnpm --filter @obscura/api db:migrate` to restore the dev schema before running integration tests",
      );
    }
    await client`TRUNCATE scene_performers, scene_tags, scene_folder_performers, scene_folder_tags, scene_folders, scenes RESTART IDENTITY CASCADE`;
  });

  it("migrates a mixed movie + series library", async () => {
    // Seed: 1 library root, 1 movie scene at root, 2 episode scenes inside
    // a flat series folder, 2 episode scenes inside a season folder.
    const [root] = await client<Array<{ id: string; path: string }>>`
      INSERT INTO library_roots (path, label)
      VALUES ('/media/test', 'test')
      RETURNING id, path
    `;
    const [movieScene] = await client<Array<{ id: string }>>`
      INSERT INTO scenes (title, file_path, rating, play_count, is_nsfw, organized)
      VALUES ('Heat', '/media/test/Heat (1995).mkv', 5, 3, false, true)
      RETURNING id
    `;
    const [flatEpA] = await client<Array<{ id: string }>>`
      INSERT INTO scenes (title, file_path, play_count)
      VALUES ('Expanse S01E01', '/media/test/The Expanse/S01E01.mkv', 1)
      RETURNING id
    `;
    const [flatEpB] = await client<Array<{ id: string }>>`
      INSERT INTO scenes (title, file_path, play_count)
      VALUES ('Expanse S01E02', '/media/test/The Expanse/S01E02.mkv', 0)
      RETURNING id
    `;
    const [seasonEpA] = await client<Array<{ id: string }>>`
      INSERT INTO scenes (title, file_path, play_count)
      VALUES ('BB S01E01', '/media/test/Breaking Bad/Season 1/S01E01.mkv', 2)
      RETURNING id
    `;
    const [seasonEpB] = await client<Array<{ id: string }>>`
      INSERT INTO scenes (title, file_path, play_count)
      VALUES ('BB S01E02', '/media/test/Breaking Bad/Season 1/S01E02.mkv', 0)
      RETURNING id
    `;

    // Stage
    const result = await videosToSeriesModelV1.stage(ctx);
    expect(result.warnings).toEqual([]);
    const metrics = result.metrics as Record<string, number>;
    expect(metrics.moviesCreated).toBe(1);
    expect(metrics.seriesCreated).toBe(2);
    expect(metrics.seasonsCreated).toBe(2); // one per series
    expect(metrics.episodesCreated).toBe(4);

    // Verify video_series has two rows with the expected titles
    const series = await client<Array<{ title: string; folder_path: string }>>`
      SELECT title, folder_path FROM video_series ORDER BY title
    `;
    expect(series.map((s) => s.title)).toEqual(["Breaking Bad", "The Expanse"]);

    // Verify video_episodes carries over play_count from the source scenes
    const episodes = await client<Array<{ title: string; play_count: number; season_number: number }>>`
      SELECT title, play_count, season_number FROM video_episodes ORDER BY title
    `;
    expect(episodes.length).toBe(4);
    const expanseEp01 = episodes.find((e) => e.title === "Expanse S01E01");
    expect(expanseEp01?.play_count).toBe(1);
    expect(expanseEp01?.season_number).toBe(0); // flat series → Season 0
    const bbEp01 = episodes.find((e) => e.title === "BB S01E01");
    expect(bbEp01?.play_count).toBe(2);
    expect(bbEp01?.season_number).toBe(1); // Season 1 folder

    // Verify video_movies
    const movies = await client<Array<{ title: string; rating: number; play_count: number }>>`
      SELECT title, rating, play_count FROM video_movies
    `;
    expect(movies.length).toBe(1);
    expect(movies[0].title).toBe("Heat");
    expect(movies[0].rating).toBe(5);
    expect(movies[0].play_count).toBe(3);
  });

  it("drops legacy tables on finalize", async () => {
    // Seed minimal data
    await client`INSERT INTO library_roots (path, label) VALUES ('/media/test2', 'test2')`;
    await client`INSERT INTO scenes (title, file_path) VALUES ('One', '/media/test2/One.mkv')`;

    await videosToSeriesModelV1.stage(ctx);
    await videosToSeriesModelV1.finalize(ctx);

    const tables = await client<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('scenes', 'scene_folders')
    `;
    expect(tables).toEqual([]);

    const columns = await client<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'library_roots' AND column_name = 'scan_videos'
    `;
    expect(columns).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the integration test against the dev database**

```bash
DATABASE_URL=postgres://obscura:obscura@localhost:5432/obscura pnpm --filter @obscura/api test -- migration.integration
```

Expected: both tests pass. If they fail, inspect the output and the actual DB state. If the `finalize` test fails because the next `beforeEach` can't find the `scenes` table, the test file needs to re-run `pnpm --filter @obscura/api db:migrate` between tests — document that as a known limitation and add a reset step.

If you can't get integration tests running against the dev DB because of contention or migration state, **do NOT rewrite the dev DB schema**. Instead, report BLOCKED and document the exact failure mode so the controller can decide whether to provision a separate test DB.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/data-migrations/videos_to_series_model_v1/migration.integration.test.ts
git commit -m "test(api): integration test for videos_to_series migration"
```

---

### Task 12: Module README

**Files:**
- Create: `apps/api/src/db/data-migrations/videos_to_series_model_v1/README.md`

- [ ] **Step 1: Write the README**

```markdown
# videos_to_series_model_v1

Two-phase data migration that moves Obscura's video library from the
legacy `scenes` + `scene_folders` shape into the typed
`video_series` / `video_seasons` / `video_episodes` / `video_movies`
model.

## Files

- `index.ts` — assembles the `DataMigration` export.
- `precheck.ts` — detects whether the migration should run.
- `stage.ts` — non-destructive copy from legacy to new tables.
- `finalize.ts` — destructive drop of legacy tables.
- `legacy-schema.ts` — frozen drizzle definitions of retired tables.
  Delete this file (and `read.ts`) after finalize has shipped to
  production in Plan E.
- `read.ts` — query helpers that use the legacy schema.
- `series-tree.ts` — pure helper that groups classified episodes
  into a series→season tree.
- `migration.integration.test.ts` — end-to-end test against a real
  postgres database (skipped when `DATABASE_URL` is unset).

## Registration status

**This migration is NOT registered in `registry.ts` as of Plan B.**
Plan D ships both the UI banner that surfaces it and the code that
registers it, because landing registration without the UI would put
the app in permanent lockdown. Between Plan B and Plan D the module
exists, is fully tested, and is ready to plug in.

## Idempotency

`stage()` is not currently idempotent. The precheck refuses to run
if any `video_*` table already has rows, so a second stage() call
bails. If Plan D needs to support partial-retry of a crashed stage,
revisit this — the framework contract requires idempotency.

## Data preserved from the old model

Per-entity carry-over:

- `rating`, `isNsfw`, `organized`
- `play_count`, `orgasm_count`, `play_duration`, `resume_time`, `last_played_at`
- All file/probe metadata (duration, width, codec, checksums, etc.)
- All generated asset paths (thumbnails, previews, sprites, trickplay)
- Performer and tag links (via join-table rewrites)
- `scene_folders` metadata (customName, details, studio, cover, backdrop, externalSeriesId as `tmdb`) onto the corresponding `video_series` row.
- `scrape_results` entity-type remapping (`scene`/`scene_folder` → `movie`/`episode`/`series`).

Not preserved:

- Subtitle rows. Subtitles will be re-ingested by Plan D's new scan
  pipeline. Cached subtitle files on disk survive.
- Scene markers. The feature is unused by the existing scan pipeline
  and the new model does not have a `video_episode_markers` table yet.
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/db/data-migrations/videos_to_series_model_v1/README.md
git commit -m "docs(api): document videos_to_series_model_v1 migration module"
```

---

### Task 13: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entries under `## [Unreleased]`**

Under `### Added`, add:

```markdown
- **Data migration: `videos_to_series_model_v1`.** Moves existing `scenes` and `scene_folders` into the new typed `video_series` / `video_seasons` / `video_episodes` / `video_movies` model, preserving ratings, watch state (play count, resume time), NSFW flags, performer/tag links, and scrape history. Not yet registered in the data-migration runner — the upgrade banner and the scan pipeline rewrite that depend on it land together in a later release.
- **Shared `classifyVideoFile` helper** in `@obscura/media-core`. Pure function that decides whether a file at a given depth under a library root should become a movie, an episode, or be skipped/rejected. Used by the data migration and will be used by the rewritten scan pipeline.
```

Add a matching bullet to `### What's New` only if you think the user-visible story warrants it — this is intentionally quiet for Plan B.

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for Plan B data migration module"
```

---

## Final verification

No dedicated verification task needed — the integration test in Task 11 is the end-to-end verification for this plan. After Task 13, run:

```bash
pnpm typecheck
pnpm test:unit
DATABASE_URL=postgres://obscura:obscura@localhost:5432/obscura pnpm --filter @obscura/api test -- migration.integration
git log --oneline main..HEAD | wc -l
```

Expected: all green, roughly 13 commits on the branch.

---

## Notes for the implementing engineer

- **Do NOT register the migration in `registry.ts`.** Plan D does that.
- **Do NOT touch `processLibraryScan`.** Plan D rewrites it.
- **Do NOT remove `scenes` or `scene_folders` from `packages/db/src/schema.ts`.** Those stay until Plan D/E has adapted all consumers.
- The integration test assumes a dev postgres is running and reachable via `DATABASE_URL`. It skips gracefully when the env var is unset so CI without a DB doesn't fail.
- If you discover during implementation that the legacy-schema read needs additional columns (e.g., the migration of `scene_folders.urls` onto `video_series`), add them to `read.ts` AND update the frozen `legacy-schema.ts` to match. Do not reach into `packages/db/src/schema.ts`.
- The `client.json()` helper is the same one used by the Plan A orchestrator — it wraps a JSON value into a postgres-js bindable parameter. If typecheck complains about JSONB parameters in raw SQL, use `client.json(...)` instead of a bare object.
- `scrape_results` updates use postgres-js's result metadata for the affected row count. If the cast `as unknown as { count: number }` doesn't compile against your postgres-js version, inspect the actual result shape and adjust — don't fall back to counting rows manually.
- The integration test's `beforeEach` truncates both old and new tables. If `finalize` has dropped legacy tables in a previous test run, the beforeEach will fail with a missing-table error. That's expected and documented; the fix is to re-run `db:migrate` between test runs, or to restructure the test file so finalize runs last.
