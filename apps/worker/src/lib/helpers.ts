import { db } from "./db.js";
import {
  pruneUntrackedLibraryReferences as pruneUntrackedLibraryReferencesWithDb,
  removeGeneratedImageDirs as removeGeneratedImageDirsImpl,
  removeGeneratedSceneDirs as removeGeneratedSceneDirsImpl,
} from "../../../api/src/lib/library-prune.js";

export function sceneAssetUrl(sceneId: string, fileName: string) {
  return `/assets/scenes/${sceneId}/${fileName}`;
}

export async function removeGeneratedSceneDirs(sceneIds: string[]) {
  return removeGeneratedSceneDirsImpl(sceneIds);
}

export async function removeGeneratedImageDirs(imageIds: string[]) {
  return removeGeneratedImageDirsImpl(imageIds);
}

export async function pruneUntrackedLibraryReferences() {
  return pruneUntrackedLibraryReferencesWithDb(db);
}
