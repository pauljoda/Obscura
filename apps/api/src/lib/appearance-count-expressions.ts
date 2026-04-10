/**
 * Correlated subqueries for performer/studio rows: cross-media appearance counts.
 * When `sfwOnly`, NSFW-tagged galleries, images, and audio libraries are excluded.
 */
import { sql } from "drizzle-orm";
import { performers, studios } from "../db/schema";

/** Scenes linked to this performer that are viewable in SFW mode. */
export function performerSfwSceneCountExpr() {
  return sql<number>`(
    SELECT COUNT(*)::int
    FROM scene_performers sp
    INNER JOIN scenes s ON s.id = sp.scene_id
    WHERE sp.performer_id = ${performers.id}
      AND (s.is_nsfw IS NOT TRUE)
  )`;
}

export function performerImageAppearanceCountExpr(sfwOnly: boolean) {
  const galleryPart = sfwOnly
    ? sql`COALESCE((
        SELECT COUNT(DISTINCT gp.gallery_id)::int
        FROM gallery_performers gp
        INNER JOIN galleries g ON g.id = gp.gallery_id
        WHERE gp.performer_id = ${performers.id}
          AND (g.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql`COALESCE((
        SELECT COUNT(DISTINCT gp.gallery_id)::int
        FROM gallery_performers gp
        WHERE gp.performer_id = ${performers.id}
      ), 0)`;

  const imagePart = sfwOnly
    ? sql`COALESCE((
        SELECT COUNT(DISTINCT ip.image_id)::int
        FROM image_performers ip
        INNER JOIN images i ON i.id = ip.image_id
        WHERE ip.performer_id = ${performers.id}
          AND (i.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql`COALESCE((
        SELECT COUNT(DISTINCT ip.image_id)::int
        FROM image_performers ip
        WHERE ip.performer_id = ${performers.id}
      ), 0)`;

  return sql<number>`(${galleryPart} + ${imagePart})`;
}

export function performerAudioLibraryCountExpr(sfwOnly: boolean) {
  return sfwOnly
    ? sql<number>`COALESCE((
        SELECT COUNT(DISTINCT alp.library_id)::int
        FROM audio_library_performers alp
        INNER JOIN audio_libraries al ON al.id = alp.library_id
        WHERE alp.performer_id = ${performers.id}
          AND (al.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql<number>`COALESCE((
        SELECT COUNT(DISTINCT alp.library_id)::int
        FROM audio_library_performers alp
        WHERE alp.performer_id = ${performers.id}
      ), 0)`;
}

/** Scenes linked to this studio that are viewable in SFW mode. */
export function studioSfwSceneCountExpr() {
  return sql<number>`(
    SELECT COUNT(*)::int FROM scenes s
    WHERE s.studio_id = ${studios.id} AND (s.is_nsfw IS NOT TRUE)
  )`;
}

export function studioImageAppearanceCountExpr(sfwOnly: boolean) {
  const galleryPart = sfwOnly
    ? sql`COALESCE((
        SELECT COUNT(*)::int FROM galleries g
        WHERE g.studio_id = ${studios.id} AND (g.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql`COALESCE((
        SELECT COUNT(*)::int FROM galleries g WHERE g.studio_id = ${studios.id}
      ), 0)`;

  const imagePart = sfwOnly
    ? sql`COALESCE((
        SELECT COUNT(*)::int FROM images i
        WHERE i.studio_id = ${studios.id} AND (i.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql`COALESCE((
        SELECT COUNT(*)::int FROM images i WHERE i.studio_id = ${studios.id}
      ), 0)`;

  return sql<number>`(${galleryPart} + ${imagePart})`;
}

export function studioAudioLibraryCountExpr(sfwOnly: boolean) {
  return sfwOnly
    ? sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM audio_libraries al
        WHERE al.studio_id = ${studios.id} AND (al.is_nsfw IS NOT TRUE)
      ), 0)`
    : sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM audio_libraries al WHERE al.studio_id = ${studios.id}
      ), 0)`;
}
