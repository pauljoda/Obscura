import { db } from "./db.js";
import {
  pruneUntrackedLibraryReferences as pruneUntrackedLibraryReferencesWithDb,
  removeGeneratedImageDirs as removeGeneratedImageDirsImpl,
  removeGeneratedVideoDirs as removeGeneratedVideoDirsImpl,
} from "@obscura/db/src/lib/library-prune";

export function videoAssetUrl(videoId: string, fileName: string) {
  return `/assets/videos/${videoId}/${fileName}`;
}

export async function removeGeneratedVideoDirs(entityIds: string[]) {
  return removeGeneratedVideoDirsImpl(entityIds);
}

export async function removeGeneratedImageDirs(imageIds: string[]) {
  return removeGeneratedImageDirsImpl(imageIds);
}

export async function pruneUntrackedLibraryReferences() {
  return pruneUntrackedLibraryReferencesWithDb(db);
}
