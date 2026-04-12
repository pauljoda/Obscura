import { and, eq } from "drizzle-orm";
import type { AppDb } from "../types";
import * as schema from "../schema";

const {
  scenes,
  tags,
  performers,
  studios,
  scenePerformers,
  sceneTags,
} = schema;

/**
 * Computes whether a scene should be marked NSFW based on its library root
 * flag plus any related entities (tags, performers, studio).
 */
export async function propagateSceneNsfw(
  db: AppDb,
  sceneId: string,
  libraryRootIsNsfw: boolean,
) {
  if (libraryRootIsNsfw) {
    await db.update(scenes).set({ isNsfw: true }).where(eq(scenes.id, sceneId));
    return;
  }

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

  await db.update(scenes).set({ isNsfw: false }).where(eq(scenes.id, sceneId));
}
