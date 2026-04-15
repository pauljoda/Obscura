/**
 * Collection Rule Engine
 *
 * Translates a CollectionRuleGroup tree into per-entity-type SQL queries,
 * evaluates them, and returns the matching entity references.
 *
 * All functions accept a `db` parameter so the engine works with any
 * Drizzle connection (API or worker).
 *
 * Video-scene rules now evaluate against `video_episodes` and
 * `video_movies` (not the retired `scenes` table). For wire-compat with
 * existing `collection_items.entityType = 'scene'` rows, both sources
 * are still surfaced under the external entity type `"scene"` — the
 * collection hydration service resolves each id against either
 * `video_episodes` or `video_movies` at read time.
 */
import {
  eq,
  ne,
  and,
  or,
  not,
  gte,
  lte,
  gt,
  lt,
  ilike,
  inArray,
  isNull,
  isNotNull,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { AppDb } from "../types";
import * as schema from "../schema";
import type {
  CollectionEntityType,
  CollectionRuleGroup,
  CollectionRuleCondition,
  CollectionRuleNode,
  CollectionOperator,
  CollectionConditionValue,
} from "@obscura/contracts";

const {
  videoEpisodes,
  videoMovies,
  videoSeries,
  galleries,
  images,
  audioTracks,
  videoEpisodeTags,
  videoEpisodePerformers,
  videoMovieTags,
  videoMoviePerformers,
  galleryTags,
  galleryPerformers,
  imageTags,
  imagePerformers,
  audioTrackTags,
  audioTrackPerformers,
  tags,
  performers,
  studios,
} = schema;

export const RESOLUTION_MAP: Record<string, [number, number]> = {
  "4K": [2160, 99999],
  "1080p": [1080, 2159],
  "720p": [720, 1079],
  "480p": [0, 719],
};

// ─── Entity table metadata ────────────────────────────────────────

interface EntityTableMeta {
  table: any;
  idCol: PgColumn;
  columns: Record<string, PgColumn>;
  tagJoin: { table: any; entityIdCol: PgColumn; tagIdCol: PgColumn };
  performerJoin: { table: any; entityIdCol: PgColumn; performerIdCol: PgColumn };
  /** For episodes, studio is a subquery against video_series.studio_id. */
  studioIdExpr: SQL<string | null> | PgColumn | null;
  studioOperator?: "direct" | "series-inherit";
}

/**
 * Episodes and movies live in two physical tables but surface as a
 * single "scene" entity type externally. Both metas are evaluated when
 * a rule targets "scene", and their results are merged.
 */
const VIDEO_EPISODE_META: EntityTableMeta = {
  table: videoEpisodes,
  idCol: videoEpisodes.id,
  columns: {
    title: videoEpisodes.title,
    rating: videoEpisodes.rating,
    date: videoEpisodes.airDate,
    organized: videoEpisodes.organized,
    isNsfw: videoEpisodes.isNsfw,
    createdAt: videoEpisodes.createdAt,
    fileSize: videoEpisodes.fileSize,
    duration: videoEpisodes.duration,
    height: videoEpisodes.height,
    codec: videoEpisodes.codec,
    playCount: videoEpisodes.playCount,
  },
  tagJoin: {
    table: videoEpisodeTags,
    entityIdCol: videoEpisodeTags.episodeId,
    tagIdCol: videoEpisodeTags.tagId,
  },
  performerJoin: {
    table: videoEpisodePerformers,
    entityIdCol: videoEpisodePerformers.episodeId,
    performerIdCol: videoEpisodePerformers.performerId,
  },
  studioIdExpr: null,
  studioOperator: "series-inherit",
};

const VIDEO_MOVIE_META: EntityTableMeta = {
  table: videoMovies,
  idCol: videoMovies.id,
  columns: {
    title: videoMovies.title,
    rating: videoMovies.rating,
    date: videoMovies.releaseDate,
    organized: videoMovies.organized,
    isNsfw: videoMovies.isNsfw,
    createdAt: videoMovies.createdAt,
    fileSize: videoMovies.fileSize,
    duration: videoMovies.duration,
    height: videoMovies.height,
    codec: videoMovies.codec,
    playCount: videoMovies.playCount,
  },
  tagJoin: {
    table: videoMovieTags,
    entityIdCol: videoMovieTags.movieId,
    tagIdCol: videoMovieTags.tagId,
  },
  performerJoin: {
    table: videoMoviePerformers,
    entityIdCol: videoMoviePerformers.movieId,
    performerIdCol: videoMoviePerformers.performerId,
  },
  studioIdExpr: videoMovies.studioId,
  studioOperator: "direct",
};

const ENTITY_META: Record<
  Exclude<CollectionEntityType, "scene">,
  EntityTableMeta
> = {
  gallery: {
    table: galleries,
    idCol: galleries.id,
    columns: {
      title: galleries.title,
      rating: galleries.rating,
      date: galleries.date,
      organized: galleries.organized,
      isNsfw: galleries.isNsfw,
      createdAt: galleries.createdAt,
      galleryType: galleries.galleryType,
      imageCount: galleries.imageCount,
    },
    tagJoin: {
      table: galleryTags,
      entityIdCol: galleryTags.galleryId,
      tagIdCol: galleryTags.tagId,
    },
    performerJoin: {
      table: galleryPerformers,
      entityIdCol: galleryPerformers.galleryId,
      performerIdCol: galleryPerformers.performerId,
    },
    studioIdExpr: galleries.studioId,
    studioOperator: "direct",
  },
  image: {
    table: images,
    idCol: images.id,
    columns: {
      title: images.title,
      rating: images.rating,
      date: images.date,
      organized: images.organized,
      isNsfw: images.isNsfw,
      createdAt: images.createdAt,
      fileSize: images.fileSize,
      width: images.width,
      height: images.height,
      format: images.format,
    },
    tagJoin: {
      table: imageTags,
      entityIdCol: imageTags.imageId,
      tagIdCol: imageTags.tagId,
    },
    performerJoin: {
      table: imagePerformers,
      entityIdCol: imagePerformers.imageId,
      performerIdCol: imagePerformers.performerId,
    },
    studioIdExpr: images.studioId,
    studioOperator: "direct",
  },
  "audio-track": {
    table: audioTracks,
    idCol: audioTracks.id,
    columns: {
      title: audioTracks.title,
      rating: audioTracks.rating,
      date: audioTracks.date,
      organized: audioTracks.organized,
      isNsfw: audioTracks.isNsfw,
      createdAt: audioTracks.createdAt,
      fileSize: audioTracks.fileSize,
      duration: audioTracks.duration,
      bitRate: audioTracks.bitRate,
      channels: audioTracks.channels,
      codec: audioTracks.codec,
      playCount: audioTracks.playCount,
    },
    tagJoin: {
      table: audioTrackTags,
      entityIdCol: audioTrackTags.trackId,
      tagIdCol: audioTrackTags.tagId,
    },
    performerJoin: {
      table: audioTrackPerformers,
      entityIdCol: audioTrackPerformers.trackId,
      performerIdCol: audioTrackPerformers.performerId,
    },
    studioIdExpr: audioTracks.studioId,
    studioOperator: "direct",
  },
};

// ─── Name → ID resolution ───────────────────────────────────────

async function resolveTagNameIds(db: AppDb, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(inArray(tags.name, names));
  return rows.map((r) => r.id);
}

async function resolvePerformerNameIds(db: AppDb, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const rows = await db
    .select({ id: performers.id })
    .from(performers)
    .where(inArray(performers.name, names));
  return rows.map((r) => r.id);
}

async function resolveStudioNameIds(db: AppDb, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const rows = await db
    .select({ id: studios.id })
    .from(studios)
    .where(inArray(studios.name, names));
  return rows.map((r) => r.id);
}

// ─── Condition → SQL translation ─────────────────────────────────

function conditionAppliesToEntity(
  condition: CollectionRuleCondition,
  entityType: CollectionEntityType,
): boolean {
  if (condition.entityTypes.length === 0) return true;
  return condition.entityTypes.includes(entityType);
}

async function translateCondition(
  db: AppDb,
  condition: CollectionRuleCondition,
  entityType: CollectionEntityType,
  meta: EntityTableMeta,
): Promise<SQL | null> {
  if (!conditionAppliesToEntity(condition, entityType)) return null;

  const { field, operator, value } = condition;

  if (field === "tags") {
    return translateRelationCondition(
      db,
      operator,
      value,
      meta.idCol,
      meta.tagJoin,
      (names) => resolveTagNameIds(db, names),
    );
  }

  if (field === "performers") {
    return translateRelationCondition(
      db,
      operator,
      value,
      meta.idCol,
      meta.performerJoin,
      (names) => resolvePerformerNameIds(db, names),
    );
  }

  if (field === "studio") {
    // Direct-column studios (movies, galleries, images, audio) use the
    // literal column. Episodes inherit studio from their parent series,
    // so the operator falls back to a subquery on video_series.studio_id
    // keyed by the episode's seriesId.
    if (meta.studioOperator === "series-inherit") {
      const seriesIdCol = videoEpisodes.seriesId;
      if (operator === "is_null") {
        return sql`(
          SELECT studio_id FROM video_series WHERE id = ${seriesIdCol}
        ) IS NULL`;
      }
      if (operator === "is_not_null") {
        return sql`(
          SELECT studio_id FROM video_series WHERE id = ${seriesIdCol}
        ) IS NOT NULL`;
      }
      const names = Array.isArray(value) ? (value as string[]) : [value as string];
      const ids = await resolveStudioNameIds(db, names);
      if (ids.length === 0) return sql`false`;
      const idList = sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      );
      if (operator === "in") {
        return sql`(
          SELECT studio_id FROM video_series WHERE id = ${seriesIdCol}
        ) IN (${idList})`;
      }
      if (operator === "not_in") {
        return sql`(
          SELECT studio_id FROM video_series WHERE id = ${seriesIdCol}
        ) NOT IN (${idList})`;
      }
      return null;
    }

    const studioCol = meta.studioIdExpr as PgColumn | null;
    if (!studioCol) return null;
    if (operator === "is_null") return isNull(studioCol);
    if (operator === "is_not_null") return isNotNull(studioCol);
    const names = Array.isArray(value) ? (value as string[]) : [value as string];
    const ids = await resolveStudioNameIds(db, names);
    if (ids.length === 0) return sql`false`;
    if (operator === "in") return inArray(studioCol, ids);
    if (operator === "not_in") return not(inArray(studioCol, ids));
    return null;
  }

  if (field === "sceneFolderId") {
    // The legacy `scene_folder_id` mapped to the folder a scene lived
    // in; its new-model equivalent is `video_episodes.series_id`.
    if (meta.table === videoEpisodes) {
      const col = videoEpisodes.seriesId;
      if (operator === "equals") return eq(col, value as string);
      if (operator === "in") return inArray(col, value as string[]);
      if (operator === "not_in") return not(inArray(col, value as string[]));
    }
    return null;
  }

  if (field === "resolution") {
    const heightCol = meta.columns.height;
    if (!heightCol) return null;
    const values = Array.isArray(value) ? (value as string[]) : [value as string];
    const resConditions = values
      .map((r) => RESOLUTION_MAP[r])
      .filter(Boolean)
      .map((range) => and(gte(heightCol, range[0]), lte(heightCol, range[1]))!);
    if (resConditions.length === 0) return sql`false`;
    if (operator === "in") return or(...resConditions)!;
    if (operator === "not_in") return not(or(...resConditions)!);
    return null;
  }

  const col = meta.columns[field];
  if (!col) return null;

  return translateScalarCondition(col, operator, value);
}

function translateScalarCondition(
  col: PgColumn,
  operator: CollectionOperator,
  value: CollectionConditionValue,
): SQL | null {
  switch (operator) {
    case "equals":
      return eq(col, value as string | number);
    case "not_equals":
      return ne(col, value as string | number);
    case "contains":
      return ilike(col, `%${value}%`);
    case "not_contains":
      return not(ilike(col, `%${value}%`));
    case "greater_than":
      return gt(col, value as number);
    case "less_than":
      return lt(col, value as number);
    case "greater_equal":
      return gte(col, value as number);
    case "less_equal":
      return lte(col, value as number);
    case "between": {
      const [min, max] = value as [number, number];
      return and(gte(col, min), lte(col, max))!;
    }
    case "in":
      return inArray(col, value as string[]);
    case "not_in":
      return not(inArray(col, value as string[]));
    case "is_null":
      return isNull(col);
    case "is_not_null":
      return isNotNull(col);
    case "is_true":
      return eq(col, true);
    case "is_false":
      return eq(col, false);
    default:
      return null;
  }
}

async function translateRelationCondition(
  db: AppDb,
  operator: CollectionOperator,
  value: CollectionConditionValue,
  entityIdCol: PgColumn,
  joinMeta: { table: any; entityIdCol: PgColumn; tagIdCol?: PgColumn; performerIdCol?: PgColumn },
  resolveNames: (names: string[]) => Promise<string[]>,
): Promise<SQL | null> {
  const names = Array.isArray(value) ? (value as string[]) : [value as string];
  const ids = await resolveNames(names);
  if (ids.length === 0) return sql`false`;

  const relIdCol = joinMeta.tagIdCol ?? joinMeta.performerIdCol!;

  const matchingEntityIds = db
    .selectDistinct({ id: joinMeta.entityIdCol })
    .from(joinMeta.table)
    .where(inArray(relIdCol, ids));

  if (operator === "in") {
    return inArray(entityIdCol, matchingEntityIds);
  }
  if (operator === "not_in") {
    return not(inArray(entityIdCol, matchingEntityIds));
  }
  return null;
}

// ─── Rule tree → SQL ─────────────────────────────────────────────

async function translateNode(
  db: AppDb,
  node: CollectionRuleNode,
  entityType: CollectionEntityType,
  meta: EntityTableMeta,
): Promise<SQL | null> {
  if (node.type === "condition") {
    return translateCondition(db, node, entityType, meta);
  }

  const group = node as CollectionRuleGroup;
  const childSqlPromises = group.children.map((child) =>
    translateNode(db, child, entityType, meta),
  );
  const childSqls = (await Promise.all(childSqlPromises)).filter(
    (s): s is SQL => s !== null,
  );

  if (childSqls.length === 0) return null;

  switch (group.operator) {
    case "and":
      return childSqls.length === 1 ? childSqls[0] : and(...childSqls)!;
    case "or":
      return childSqls.length === 1 ? childSqls[0] : or(...childSqls)!;
    case "not":
      return childSqls.length === 1
        ? not(childSqls[0])
        : not(and(...childSqls)!);
    default:
      return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────

export interface ResolvedItem {
  entityType: CollectionEntityType;
  entityId: string;
}

async function evaluateSceneRules(
  db: AppDb,
  ruleTree: CollectionRuleGroup,
): Promise<string[]> {
  const [episodeSql, movieSql] = await Promise.all([
    translateNode(db, ruleTree, "scene", VIDEO_EPISODE_META),
    translateNode(db, ruleTree, "scene", VIDEO_MOVIE_META),
  ]);

  const ids: string[] = [];
  if (episodeSql) {
    const rows = await db
      .select({ id: videoEpisodes.id })
      .from(videoEpisodes)
      .where(episodeSql);
    for (const row of rows) ids.push(row.id);
  }
  if (movieSql) {
    const rows = await db
      .select({ id: videoMovies.id })
      .from(videoMovies)
      .where(movieSql);
    for (const row of rows) ids.push(row.id);
  }
  return ids;
}

/**
 * Evaluate a rule tree and return all matching entity references.
 */
export async function evaluateRuleTree(
  db: AppDb,
  ruleTree: CollectionRuleGroup,
): Promise<ResolvedItem[]> {
  const allItems: ResolvedItem[] = [];

  // Scenes first — union of episode + movie ids, surfaced as "scene" type.
  for (const id of await evaluateSceneRules(db, ruleTree)) {
    allItems.push({ entityType: "scene", entityId: id });
  }

  const otherTypes: Array<Exclude<CollectionEntityType, "scene">> = [
    "gallery",
    "image",
    "audio-track",
  ];
  for (const entityType of otherTypes) {
    const meta = ENTITY_META[entityType];
    const whereSql = await translateNode(db, ruleTree, entityType, meta);
    if (!whereSql) continue;

    const rows = (await db
      .select({ id: meta.idCol })
      .from(meta.table)
      .where(whereSql)) as Array<{ id: string }>;
    for (const row of rows) {
      allItems.push({ entityType, entityId: row.id });
    }
  }

  return allItems;
}

/**
 * Evaluate a rule tree and return a preview with counts and sample items.
 */
export async function previewRuleTree(
  db: AppDb,
  ruleTree: CollectionRuleGroup,
  sampleLimit = 20,
): Promise<{
  total: number;
  byType: Record<CollectionEntityType, number>;
  items: ResolvedItem[];
}> {
  const byType: Record<CollectionEntityType, number> = {
    scene: 0,
    gallery: 0,
    image: 0,
    "audio-track": 0,
  };

  const sampleItems: ResolvedItem[] = [];
  let total = 0;

  // Scenes (episode + movie union)
  const sceneIds = await evaluateSceneRules(db, ruleTree);
  byType.scene = sceneIds.length;
  total += sceneIds.length;
  for (const id of sceneIds) {
    if (sampleItems.length >= sampleLimit) break;
    sampleItems.push({ entityType: "scene", entityId: id });
  }

  const otherTypes: Array<Exclude<CollectionEntityType, "scene">> = [
    "gallery",
    "image",
    "audio-track",
  ];
  for (const entityType of otherTypes) {
    const meta = ENTITY_META[entityType];
    const whereSql = await translateNode(db, ruleTree, entityType, meta);
    if (!whereSql) continue;

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(meta.table)
      .where(whereSql);

    const count = countRow?.count ?? 0;
    byType[entityType] = count;
    total += count;

    if (count > 0 && sampleItems.length < sampleLimit) {
      const remaining = sampleLimit - sampleItems.length;
      const rows = (await db
        .select({ id: meta.idCol })
        .from(meta.table)
        .where(whereSql)
        .limit(remaining)) as Array<{ id: string }>;

      for (const row of rows) {
        sampleItems.push({ entityType, entityId: row.id });
      }
    }
  }

  return { total, byType, items: sampleItems };
}

void videoSeries; // Ensure the import is live even if only referenced from SQL templates.
