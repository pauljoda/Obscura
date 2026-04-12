import { propagateSceneNsfw as propagateSceneNsfwImpl } from "@obscura/db/src/lib/nsfw-scene-propagation";
import { db } from "./db.js";

/**
 * Computes whether a scene should be marked NSFW based on its library root
 * flag plus any related entities (tags, performers, studio).
 */
export async function propagateSceneNsfw(sceneId: string, libraryRootIsNsfw: boolean) {
  return propagateSceneNsfwImpl(db, sceneId, libraryRootIsNsfw);
}
