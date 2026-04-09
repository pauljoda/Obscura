import { and, eq } from "drizzle-orm";
import {
  db,
  scenes,
  tags,
  performers,
  studios,
  scenePerformers,
  sceneTags,
} from "./db.js";

/**
 * Computes whether a scene should be marked NSFW based on its library root
 * flag plus any related entities (tags, performers, studio).
 */
export async function propagateSceneNsfw(sceneId: string, libraryRootIsNsfw: boolean) {
  if (libraryRootIsNsfw) {
    await db.update(scenes).set({ isNsfw: true }).where(eq(scenes.id, sceneId));
    return;
  }

  // Check related tags
  const nsfwTag = await db
    .select({ id: tags.id })
    .from(sceneTags)
    .innerJoin(tags, eq(sceneTags.tagId, tags.id))
    .where(and(eq(sceneTags.sceneId, sceneId), eq(tags.isNsfw, true)))
    .limit(1);

  if (nsfwTag.length > 0) {
    await db.update(scenes).set({ isNsfw: true }).where(eq(scenes.id, sceneId));
    return;
  }

  // Check related performers
  const nsfwPerformer = await db
    .select({ id: performers.id })
    .from(scenePerformers)
    .innerJoin(performers, eq(scenePerformers.performerId, performers.id))
    .where(and(eq(scenePerformers.sceneId, sceneId), eq(performers.isNsfw, true)))
    .limit(1);

  if (nsfwPerformer.length > 0) {
    await db.update(scenes).set({ isNsfw: true }).where(eq(scenes.id, sceneId));
    return;
  }

  // Check studio
  const [sceneRow] = await db
    .select({ studioId: scenes.studioId })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (sceneRow?.studioId) {
    const [studio] = await db
      .select({ isNsfw: studios.isNsfw })
      .from(studios)
      .where(eq(studios.id, sceneRow.studioId))
      .limit(1);

    if (studio?.isNsfw) {
      await db.update(scenes).set({ isNsfw: true }).where(eq(scenes.id, sceneId));
      return;
    }
  }

  // No NSFW signals found — clear stale flag if it was set by a previous
  // propagation. This ensures removed NSFW tags/performers/studios are
  // reflected after a rescan.
  await db.update(scenes).set({ isNsfw: false }).where(eq(scenes.id, sceneId));
}
