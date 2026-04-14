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
import { buildSeriesTree } from "./series-tree";

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
        ${JSON.stringify(externalIds)}::jsonb
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
          ${"{}"}::jsonb
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
        ${"{}"}::jsonb,
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
        ${"{}"}::jsonb,
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
    const { count } = (await client`
      UPDATE scrape_results
      SET entity_type = 'episode', entity_id = ${episodeId}
      WHERE entity_type = 'scene' AND entity_id = ${sceneId}
    `) as unknown as { count: number };
    metrics.scrapeResultsRewritten += count ?? 0;
  }
  for (const [sceneId, movieId] of movieIdBySceneId) {
    const { count } = (await client`
      UPDATE scrape_results
      SET entity_type = 'movie', entity_id = ${movieId}
      WHERE entity_type = 'scene' AND entity_id = ${sceneId}
    `) as unknown as { count: number };
    metrics.scrapeResultsRewritten += count ?? 0;
  }
  // Re-point scene_folder-entity scrapes to video_series.
  for (const [folderPath, seriesId] of seriesIdByPath) {
    const folder = legacyFolders.find((f) => f.folderPath === folderPath);
    if (!folder) continue;
    const { count } = (await client`
      UPDATE scrape_results
      SET entity_type = 'series', entity_id = ${seriesId}
      WHERE entity_type = 'scene_folder' AND entity_id = ${folder.id}
    `) as unknown as { count: number };
    metrics.scrapeResultsRewritten += count ?? 0;
  }

  reportProgress(100, "stage complete");
  logger.info(
    "videos_to_series_model_v1 stage complete",
    metrics as unknown as Record<string, unknown>,
  );

  return {
    metrics: metrics as unknown as Record<string, unknown>,
    warnings,
  };
}
