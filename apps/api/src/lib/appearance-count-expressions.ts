/**
 * Correlated subqueries for performer/studio rows: cross-media appearance counts.
 * When `sfwOnly`, NSFW-tagged episodes, movies, galleries, images, and audio
 * libraries are excluded.
 *
 * "Video appearance count" in Obscura's new model is the union of individual
 * playable files linked to the entity: video_episodes + video_movies. Series
 * and season rows are containers, not files, so they do not contribute to the
 * count. Episode NSFW status is its own column; movie NSFW status is its own
 * column; both apply independently from the parent series/season.
 */
import { sql } from "drizzle-orm";

// Drizzle renders `${table.column}` inside nested correlated subqueries
// as a bare `"column"`, which PostgreSQL can't resolve when the inner
// scope shadows the outer column name (e.g. `video_episodes.id` in a
// subquery correlated with `studios.id`). Use explicit qualified raw
// references for every outer-table correlation. These are safe because
// the table names are fixed.
const PERFORMERS_ID_REF = sql.raw('"performers"."id"');
const TAGS_ID_REF = sql.raw('"tags"."id"');

/**
 * Episodes + movies linked to this performer that are viewable in SFW mode.
 * Returned as a single integer so existing callers that selected the old
 * `scenes` column unchanged.
 */
export function performerSfwSceneCountExpr() {
  return sql<number>`(
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_episode_performers vep
      INNER JOIN video_episodes ve ON ve.id = vep.episode_id
      WHERE vep.performer_id = ${PERFORMERS_ID_REF}
        AND (ve.is_nsfw IS NOT TRUE)
    ), 0)
    +
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_movie_performers vmp
      INNER JOIN video_movies vm ON vm.id = vmp.movie_id
      WHERE vmp.performer_id = ${PERFORMERS_ID_REF}
        AND (vm.is_nsfw IS NOT TRUE)
    ), 0)
  )`;
}

/**
 * Episodes + movies linked to this performer regardless of NSFW status.
 * Replaces the cached `performers.scene_count` column after the
 * videos-to-series finalize phase drops the legacy scenes tables.
 */
export function performerTotalSceneCountExpr() {
  return sql<number>`(
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_episode_performers vep
      WHERE vep.performer_id = ${PERFORMERS_ID_REF}
    ), 0)
    +
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_movie_performers vmp
      WHERE vmp.performer_id = ${PERFORMERS_ID_REF}
    ), 0)
  )`;
}

export function performerImageAppearanceCountExpr(sfwOnly: boolean) {
  const galleryPart = sfwOnly
    ? sql`COALESCE((
        SELECT COUNT(DISTINCT gp.gallery_id)::int
        FROM gallery_performers gp
        INNER JOIN galleries g ON g.id = gp.gallery_id
        WHERE gp.performer_id = ${PERFORMERS_ID_REF}
          AND (g.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql`COALESCE((
        SELECT COUNT(DISTINCT gp.gallery_id)::int
        FROM gallery_performers gp
        WHERE gp.performer_id = ${PERFORMERS_ID_REF}
      ), 0)`;

  const imagePart = sfwOnly
    ? sql`COALESCE((
        SELECT COUNT(DISTINCT ip.image_id)::int
        FROM image_performers ip
        INNER JOIN images i ON i.id = ip.image_id
        WHERE ip.performer_id = ${PERFORMERS_ID_REF}
          AND (i.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql`COALESCE((
        SELECT COUNT(DISTINCT ip.image_id)::int
        FROM image_performers ip
        WHERE ip.performer_id = ${PERFORMERS_ID_REF}
      ), 0)`;

  return sql<number>`(${galleryPart} + ${imagePart})`;
}

export function performerAudioLibraryCountExpr(sfwOnly: boolean) {
  return sfwOnly
    ? sql<number>`COALESCE((
        SELECT COUNT(DISTINCT alp.library_id)::int
        FROM audio_library_performers alp
        INNER JOIN audio_libraries al ON al.id = alp.library_id
        WHERE alp.performer_id = ${PERFORMERS_ID_REF}
          AND (al.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql<number>`COALESCE((
        SELECT COUNT(DISTINCT alp.library_id)::int
        FROM audio_library_performers alp
        WHERE alp.performer_id = ${PERFORMERS_ID_REF}
      ), 0)`;
}

const STUDIOS_ID_REF = sql.raw('"studios"."id"');

/**
 * Episodes + movies under this studio that are viewable in SFW mode. Episodes
 * inherit studio via their parent `video_series` row since episodes themselves
 * carry no studioId column.
 */
export function studioSfwSceneCountExpr() {
  return sql<number>`(
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_episodes ve
      INNER JOIN video_series vs ON vs.id = ve.series_id
      WHERE vs.studio_id = ${STUDIOS_ID_REF}
        AND (ve.is_nsfw IS NOT TRUE)
    ), 0)
    +
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_movies vm
      WHERE vm.studio_id = ${STUDIOS_ID_REF}
        AND (vm.is_nsfw IS NOT TRUE)
    ), 0)
  )`;
}

/**
 * Episodes + movies under this studio regardless of NSFW status.
 * Replaces the cached `studios.scene_count` column.
 */
export function studioTotalSceneCountExpr() {
  return sql<number>`(
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_episodes ve
      INNER JOIN video_series vs ON vs.id = ve.series_id
      WHERE vs.studio_id = ${STUDIOS_ID_REF}
    ), 0)
    +
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_movies vm
      WHERE vm.studio_id = ${STUDIOS_ID_REF}
    ), 0)
  )`;
}

export function studioImageAppearanceCountExpr(sfwOnly: boolean) {
  const galleryPart = sfwOnly
    ? sql`COALESCE((
        SELECT COUNT(*)::int FROM galleries g
        WHERE g.studio_id = ${STUDIOS_ID_REF} AND (g.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql`COALESCE((
        SELECT COUNT(*)::int FROM galleries g WHERE g.studio_id = ${STUDIOS_ID_REF}
      ), 0)`;

  const imagePart = sfwOnly
    ? sql`COALESCE((
        SELECT COUNT(*)::int FROM images i
        WHERE i.studio_id = ${STUDIOS_ID_REF} AND (i.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql`COALESCE((
        SELECT COUNT(*)::int FROM images i WHERE i.studio_id = ${STUDIOS_ID_REF}
      ), 0)`;

  return sql<number>`(${galleryPart} + ${imagePart})`;
}

/**
 * Episodes + movies linked to this tag, SFW-filtered.
 * Tag join tables: video_episode_tags, video_movie_tags, and optionally
 * video_series_tags. Series-level tags are counted via all the episodes of
 * the series so the number stays consistent with a "how many playable files
 * carry this tag" reading.
 */
export function tagSfwSceneCountExpr() {
  return sql<number>`(
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_episode_tags vet
      INNER JOIN video_episodes ve ON ve.id = vet.episode_id
      WHERE vet.tag_id = ${TAGS_ID_REF}
        AND (ve.is_nsfw IS NOT TRUE)
    ), 0)
    +
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_movie_tags vmt
      INNER JOIN video_movies vm ON vm.id = vmt.movie_id
      WHERE vmt.tag_id = ${TAGS_ID_REF}
        AND (vm.is_nsfw IS NOT TRUE)
    ), 0)
  )`;
}

/**
 * Episodes + movies linked to this tag regardless of NSFW status.
 * Replaces the cached `tags.scene_count` column.
 */
export function tagTotalSceneCountExpr() {
  return sql<number>`(
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_episode_tags vet
      WHERE vet.tag_id = ${TAGS_ID_REF}
    ), 0)
    +
    COALESCE((
      SELECT COUNT(*)::int
      FROM video_movie_tags vmt
      WHERE vmt.tag_id = ${TAGS_ID_REF}
    ), 0)
  )`;
}

export function studioAudioLibraryCountExpr(sfwOnly: boolean) {
  return sfwOnly
    ? sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM audio_libraries al
        WHERE al.studio_id = ${STUDIOS_ID_REF} AND (al.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM audio_libraries al WHERE al.studio_id = ${STUDIOS_ID_REF}
      ), 0)`;
}
