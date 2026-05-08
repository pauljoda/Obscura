import path from "node:path";
import { ValidationError } from "./errors";

export type GallerySeriesMergeGallery = {
  id: string;
  galleryType: string;
  folderPath: string | null;
  zipFilePath: string | null;
};

export type GallerySeriesMergeMove = {
  galleryId: string;
  sourcePath: string;
  destinationPath: string;
  kind: "folder" | "zip";
};

export type GallerySeriesMergePlan = {
  targetDir: string;
  moves: GallerySeriesMergeMove[];
};

function sanitizeFolderName(value: string): string {
  return value
    .trim()
    .replace(/[/:\\]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 180)
    .trim();
}

function galleryDiskPath(gallery: GallerySeriesMergeGallery) {
  if (gallery.galleryType === "zip" && gallery.zipFilePath) {
    return { path: gallery.zipFilePath, kind: "zip" as const };
  }
  if (gallery.galleryType === "folder" && gallery.folderPath) {
    return { path: gallery.folderPath, kind: "folder" as const };
  }
  throw new ValidationError("Only file-backed galleries can be merged into a series");
}

export function planGallerySeriesMerge(input: {
  title: string;
  galleries: GallerySeriesMergeGallery[];
}): GallerySeriesMergePlan {
  const folderName = sanitizeFolderName(input.title);
  if (!folderName) throw new ValidationError("Series title is required");
  if (input.galleries.length === 0) {
    throw new ValidationError("Choose at least one gallery to merge");
  }

  const diskItems = input.galleries.map((gallery) => ({
    gallery,
    ...galleryDiskPath(gallery),
  }));
  const parentDir = path.dirname(diskItems[0].path);
  if (!diskItems.every((item) => path.dirname(item.path) === parentDir)) {
    throw new ValidationError("Selected galleries must live in the same folder");
  }

  const targetDir =
    path.basename(parentDir).toLowerCase() === folderName.toLowerCase()
      ? parentDir
      : path.join(parentDir, folderName);
  const moves = diskItems.flatMap((item): GallerySeriesMergeMove[] => {
    if (path.resolve(path.dirname(item.path)) === path.resolve(targetDir)) {
      return [];
    }
    if (path.resolve(item.path) === path.resolve(targetDir)) {
      return [];
    }
    return [
      {
        galleryId: item.gallery.id,
        sourcePath: item.path,
        destinationPath: path.join(targetDir, path.basename(item.path)),
        kind: item.kind,
      },
    ];
  });

  return { targetDir, moves };
}
