/**
 * Aligns `isNsfw` on all media rows scoped under a library root path with
 * the root's flag. When enabling NSFW, linked tags, performers, and studios
 * inherit the signal. Video episodes and movies use full propagation when
 * clearing NSFW so tag/performer/studio signals are preserved.
 *
 * Shared by library-root mutations so the PATCH /libraries/:id flow keeps
 * its media propagation rules in one place.
 */
import {
  propagateEpisodeNsfw,
  propagateMovieNsfw,
} from "@obscura/db/src/lib/nsfw-video-propagation";
import { schema, type AppDb } from "@obscura/db";
import { like, or, sql } from "drizzle-orm";

const {
  videoEpisodes,
  videoMovies,
  videoSeries,
  images,
  galleries,
  audioLibraries,
  audioTracks,
} = schema;

const VIDEO_PROPAGATE_BATCH = 64;

export async function markLinkedMetadataNsfwForLibraryRoot(
  db: AppDb,
  rootPath: string,
) {
  const pathPrefix = `${rootPath}%`;

  await db.execute(sql`
    UPDATE studios
    SET is_nsfw = TRUE, updated_at = NOW()
    WHERE id IN (
      SELECT g.studio_id FROM galleries g
      WHERE g.studio_id IS NOT NULL
        AND (g.folder_path LIKE ${pathPrefix} OR g.zip_file_path LIKE ${pathPrefix})
      UNION
      SELECT i.studio_id FROM images i
      WHERE i.studio_id IS NOT NULL AND i.file_path LIKE ${pathPrefix}
      UNION
      SELECT al.studio_id FROM audio_libraries al
      WHERE al.studio_id IS NOT NULL AND al.folder_path LIKE ${pathPrefix}
      UNION
      SELECT at.studio_id FROM audio_tracks at
      WHERE at.studio_id IS NOT NULL AND at.file_path LIKE ${pathPrefix}
      UNION
      SELECT vs.studio_id FROM video_series vs
      WHERE vs.studio_id IS NOT NULL AND vs.folder_path LIKE ${pathPrefix}
      UNION
      SELECT vm.studio_id FROM video_movies vm
      WHERE vm.studio_id IS NOT NULL AND vm.file_path LIKE ${pathPrefix}
    )
  `);

  await db.execute(sql`
    UPDATE performers
    SET is_nsfw = TRUE, updated_at = NOW()
    WHERE id IN (
      SELECT gp.performer_id FROM gallery_performers gp
      INNER JOIN galleries g ON g.id = gp.gallery_id
      WHERE g.folder_path LIKE ${pathPrefix} OR g.zip_file_path LIKE ${pathPrefix}
      UNION
      SELECT ip.performer_id FROM image_performers ip
      INNER JOIN images i ON i.id = ip.image_id
      WHERE i.file_path LIKE ${pathPrefix}
      UNION
      SELECT alp.performer_id FROM audio_library_performers alp
      INNER JOIN audio_libraries al ON al.id = alp.library_id
      WHERE al.folder_path LIKE ${pathPrefix}
      UNION
      SELECT atp.performer_id FROM audio_track_performers atp
      INNER JOIN audio_tracks at ON at.id = atp.track_id
      WHERE at.file_path LIKE ${pathPrefix}
      UNION
      SELECT vsp.performer_id FROM video_series_performers vsp
      INNER JOIN video_series vs ON vs.id = vsp.series_id
      WHERE vs.folder_path LIKE ${pathPrefix}
      UNION
      SELECT vep.performer_id FROM video_episode_performers vep
      INNER JOIN video_episodes ve ON ve.id = vep.episode_id
      WHERE ve.file_path LIKE ${pathPrefix}
      UNION
      SELECT vmp.performer_id FROM video_movie_performers vmp
      INNER JOIN video_movies vm ON vm.id = vmp.movie_id
      WHERE vm.file_path LIKE ${pathPrefix}
    )
  `);

  await db.execute(sql`
    UPDATE tags
    SET is_nsfw = TRUE, updated_at = NOW()
    WHERE id IN (
      SELECT gt.tag_id FROM gallery_tags gt
      INNER JOIN galleries g ON g.id = gt.gallery_id
      WHERE g.folder_path LIKE ${pathPrefix} OR g.zip_file_path LIKE ${pathPrefix}
      UNION
      SELECT it.tag_id FROM image_tags it
      INNER JOIN images i ON i.id = it.image_id
      WHERE i.file_path LIKE ${pathPrefix}
      UNION
      SELECT alt.tag_id FROM audio_library_tags alt
      INNER JOIN audio_libraries al ON al.id = alt.library_id
      WHERE al.folder_path LIKE ${pathPrefix}
      UNION
      SELECT att.tag_id FROM audio_track_tags att
      INNER JOIN audio_tracks at ON at.id = att.track_id
      WHERE at.file_path LIKE ${pathPrefix}
      UNION
      SELECT vst.tag_id FROM video_series_tags vst
      INNER JOIN video_series vs ON vs.id = vst.series_id
      WHERE vs.folder_path LIKE ${pathPrefix}
      UNION
      SELECT vet.tag_id FROM video_episode_tags vet
      INNER JOIN video_episodes ve ON ve.id = vet.episode_id
      WHERE ve.file_path LIKE ${pathPrefix}
      UNION
      SELECT vmt.tag_id FROM video_movie_tags vmt
      INNER JOIN video_movies vm ON vm.id = vmt.movie_id
      WHERE vm.file_path LIKE ${pathPrefix}
    )
  `);
}

export async function syncMediaNsfwWithLibraryRoot(
  db: AppDb,
  rootPath: string,
  isNsfw: boolean,
) {
  const pathPrefix = `${rootPath}%`;
  const now = new Date();

  if (isNsfw) {
    await db
      .update(videoSeries)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(videoSeries.folderPath, pathPrefix));
    await db
      .update(videoEpisodes)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(videoEpisodes.filePath, pathPrefix));
    await db
      .update(videoMovies)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(videoMovies.filePath, pathPrefix));
    await db
      .update(images)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(images.filePath, pathPrefix));
    await db
      .update(galleries)
      .set({ isNsfw: true, updatedAt: now })
      .where(
        or(
          like(galleries.folderPath, pathPrefix),
          like(galleries.zipFilePath, pathPrefix),
        )!,
      );
    await db
      .update(audioLibraries)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(audioLibraries.folderPath, pathPrefix));
    await db
      .update(audioTracks)
      .set({ isNsfw: true, updatedAt: now })
      .where(like(audioTracks.filePath, pathPrefix));
    await markLinkedMetadataNsfwForLibraryRoot(db, rootPath);
    return;
  }

  await db
    .update(videoSeries)
    .set({ isNsfw: false, updatedAt: now })
    .where(like(videoSeries.folderPath, pathPrefix));
  await db
    .update(images)
    .set({ isNsfw: false, updatedAt: now })
    .where(like(images.filePath, pathPrefix));
  await db
    .update(galleries)
    .set({ isNsfw: false, updatedAt: now })
    .where(
      or(
        like(galleries.folderPath, pathPrefix),
        like(galleries.zipFilePath, pathPrefix),
      )!,
    );
  await db
    .update(audioLibraries)
    .set({ isNsfw: false, updatedAt: now })
    .where(like(audioLibraries.folderPath, pathPrefix));
  await db
    .update(audioTracks)
    .set({ isNsfw: false, updatedAt: now })
    .where(like(audioTracks.filePath, pathPrefix));

  const episodeRows = await db
    .select({ id: videoEpisodes.id })
    .from(videoEpisodes)
    .where(like(videoEpisodes.filePath, pathPrefix));

  for (let i = 0; i < episodeRows.length; i += VIDEO_PROPAGATE_BATCH) {
    const chunk = episodeRows.slice(i, i + VIDEO_PROPAGATE_BATCH);
    await Promise.all(
      chunk.map((row) => propagateEpisodeNsfw(db, row.id, false)),
    );
  }

  const movieRows = await db
    .select({ id: videoMovies.id })
    .from(videoMovies)
    .where(like(videoMovies.filePath, pathPrefix));

  for (let i = 0; i < movieRows.length; i += VIDEO_PROPAGATE_BATCH) {
    const chunk = movieRows.slice(i, i + VIDEO_PROPAGATE_BATCH);
    await Promise.all(
      chunk.map((row) => propagateMovieNsfw(db, row.id, false)),
    );
  }
}
