import { existsSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
import {
  formatDuration,
  formatFileSize,
  getResolutionLabel,
} from "@obscura/contracts";
import type { AppDb } from "@obscura/db";
import { schema } from "@obscura/db";

const {
  videoEpisodes,
  videoMovies,
  videoSeries,
  videoEpisodePerformers,
  videoEpisodeTags,
  videoMoviePerformers,
  videoMovieTags,
  performers,
  tags,
} = schema;

interface VideoRow {
  kind: "episode" | "movie";
  id: string;
  title: string;
  details: string | null;
  date: string | null;
  rating: number | null;
  url: string | null;
  organized: boolean;
  isNsfw: boolean;
  duration: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  container: string | null;
  fileSize: number | null;
  filePath: string | null;
  thumbnailPath: string | null;
  cardThumbnailPath: string | null;
  spritePath: string | null;
  trickplayVttPath: string | null;
  playCount: number;
  orgasmCount: number;
  studioId: string | null;
  seriesId: string | null;
  seriesTitle: string | null;
  createdAt: Date;
  updatedAt: Date;
  seasonNumber: number | null;
  episodeNumber: number | null;
}

function toVideoListItem(row: VideoRow) {
  const hasVideo = !!(row.filePath && existsSync(row.filePath));
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    date: row.date,
    rating: row.rating,
    organized: row.organized,
    isNsfw: row.isNsfw,
    duration: row.duration,
    durationFormatted: formatDuration(row.duration),
    resolution: getResolutionLabel(row.height),
    width: row.width,
    height: row.height,
    codec: row.codec?.toUpperCase() ?? null,
    container: row.container,
    fileSize: row.fileSize,
    fileSizeFormatted: formatFileSize(row.fileSize),
    filePath: row.filePath,
    hasVideo,
    streamUrl: hasVideo ? `/video-stream/${row.id}/hls2/master.m3u8` : null,
    directStreamUrl: hasVideo ? `/video-stream/${row.id}/source` : null,
    thumbnailPath: row.thumbnailPath,
    cardThumbnailPath: row.cardThumbnailPath,
    spritePath: row.spritePath,
    trickplayVttPath: row.trickplayVttPath,
    playCount: row.playCount,
    orgasmCount: row.orgasmCount,
    studioId: row.studioId,
    videoSeriesId: row.seriesId,
    videoSeriesTitle: row.seriesTitle,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    hasSubtitles: false,
    performers: [] as {
      id: string;
      name: string;
      imagePath: string | null;
      isNsfw: boolean;
    }[],
    tags: [] as { id: string; name: string; isNsfw: boolean }[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getVideosByIdsRead(db: AppDb, ids: string[]) {
  if (ids.length === 0) return [];

  const [epRows, mvRows] = await Promise.all([
    db
      .select()
      .from(videoEpisodes)
      .leftJoin(videoSeries, eq(videoEpisodes.seriesId, videoSeries.id))
      .where(inArray(videoEpisodes.id, ids)),
    db.select().from(videoMovies).where(inArray(videoMovies.id, ids)),
  ]);

  const episodeIds = epRows.map((row) => row.video_episodes.id);
  const movieIds = mvRows.map((row) => row.id);

  const [epPerfJoins, epTagJoins, mvPerfJoins, mvTagJoins] = await Promise.all([
    episodeIds.length > 0
      ? db
          .select({
            entityId: videoEpisodePerformers.episodeId,
            performerId: performers.id,
            performerName: performers.name,
            performerImagePath: performers.imagePath,
            performerIsNsfw: performers.isNsfw,
          })
          .from(videoEpisodePerformers)
          .innerJoin(performers, eq(videoEpisodePerformers.performerId, performers.id))
          .where(inArray(videoEpisodePerformers.episodeId, episodeIds))
      : Promise.resolve([]),
    episodeIds.length > 0
      ? db
          .select({
            entityId: videoEpisodeTags.episodeId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(videoEpisodeTags)
          .innerJoin(tags, eq(videoEpisodeTags.tagId, tags.id))
          .where(inArray(videoEpisodeTags.episodeId, episodeIds))
      : Promise.resolve([]),
    movieIds.length > 0
      ? db
          .select({
            entityId: videoMoviePerformers.movieId,
            performerId: performers.id,
            performerName: performers.name,
            performerImagePath: performers.imagePath,
            performerIsNsfw: performers.isNsfw,
          })
          .from(videoMoviePerformers)
          .innerJoin(performers, eq(videoMoviePerformers.performerId, performers.id))
          .where(inArray(videoMoviePerformers.movieId, movieIds))
      : Promise.resolve([]),
    movieIds.length > 0
      ? db
          .select({
            entityId: videoMovieTags.movieId,
            tagId: tags.id,
            tagName: tags.name,
            tagIsNsfw: tags.isNsfw,
          })
          .from(videoMovieTags)
          .innerJoin(tags, eq(videoMovieTags.tagId, tags.id))
          .where(inArray(videoMovieTags.movieId, movieIds))
      : Promise.resolve([]),
  ]);

  const perfByEntity = new Map<
    string,
    { id: string; name: string; imagePath: string | null; isNsfw: boolean }[]
  >();
  for (const join of [...epPerfJoins, ...mvPerfJoins]) {
    const list = perfByEntity.get(join.entityId) ?? [];
    list.push({
      id: join.performerId,
      name: join.performerName,
      imagePath: join.performerImagePath,
      isNsfw: join.performerIsNsfw,
    });
    perfByEntity.set(join.entityId, list);
  }

  const tagsByEntity = new Map<
    string,
    { id: string; name: string; isNsfw: boolean }[]
  >();
  for (const join of [...epTagJoins, ...mvTagJoins]) {
    const list = tagsByEntity.get(join.entityId) ?? [];
    list.push({ id: join.tagId, name: join.tagName, isNsfw: join.tagIsNsfw });
    tagsByEntity.set(join.entityId, list);
  }

  const items: Array<ReturnType<typeof toVideoListItem>> = [];

  for (const row of epRows) {
    const episode = row.video_episodes;
    const series = row.video_series;
    const item = toVideoListItem({
      kind: "episode",
      id: episode.id,
      title: episode.title ?? "Untitled Episode",
      details: episode.overview,
      date: episode.airDate,
      rating: episode.rating,
      url: episode.url,
      organized: episode.organized,
      isNsfw: episode.isNsfw,
      duration: episode.duration,
      width: episode.width,
      height: episode.height,
      codec: episode.codec,
      container: episode.container,
      fileSize: episode.fileSize,
      filePath: episode.filePath,
      thumbnailPath: episode.thumbnailPath,
      cardThumbnailPath: episode.cardThumbnailPath,
      spritePath: episode.spritePath,
      trickplayVttPath: episode.trickplayVttPath,
      playCount: episode.playCount,
      orgasmCount: episode.orgasmCount,
      studioId: series?.studioId ?? null,
      seriesId: episode.seriesId,
      seriesTitle: series?.title ?? null,
      createdAt: episode.createdAt,
      updatedAt: episode.updatedAt,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
    });
    item.performers = perfByEntity.get(episode.id) ?? [];
    item.tags = tagsByEntity.get(episode.id) ?? [];
    items.push(item);
  }

  for (const movie of mvRows) {
    const item = toVideoListItem({
      kind: "movie",
      id: movie.id,
      title: movie.title ?? "Untitled Movie",
      details: movie.overview,
      date: movie.releaseDate,
      rating: movie.rating,
      url: movie.url,
      organized: movie.organized,
      isNsfw: movie.isNsfw,
      duration: movie.duration,
      width: movie.width,
      height: movie.height,
      codec: movie.codec,
      container: movie.container,
      fileSize: movie.fileSize,
      filePath: movie.filePath,
      thumbnailPath: movie.thumbnailPath,
      cardThumbnailPath: movie.cardThumbnailPath,
      spritePath: movie.spritePath,
      trickplayVttPath: movie.trickplayVttPath,
      playCount: movie.playCount,
      orgasmCount: movie.orgasmCount,
      studioId: movie.studioId,
      seriesId: null,
      seriesTitle: null,
      createdAt: movie.createdAt,
      updatedAt: movie.updatedAt,
      seasonNumber: null,
      episodeNumber: null,
    });
    item.performers = perfByEntity.get(movie.id) ?? [];
    item.tags = tagsByEntity.get(movie.id) ?? [];
    items.push(item);
  }

  return items;
}
