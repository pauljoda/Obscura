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
  const existingTarget = diskItems.find(
    (item) => path.basename(path.dirname(item.path)).toLowerCase() === folderName.toLowerCase(),
  );
  const directTarget = diskItems.find(
    (item) => path.basename(item.path).toLowerCase() === folderName.toLowerCase(),
  );
  const firstParentDir = path.dirname(diskItems[0].path);
  const targetDir =
    existingTarget
      ? path.dirname(existingTarget.path)
      : directTarget
        ? directTarget.path
        : path.basename(firstParentDir).toLowerCase() === folderName.toLowerCase()
          ? firstParentDir
          : path.join(firstParentDir, folderName);
  const targetParentDir = path.dirname(targetDir);
  if (
    !diskItems.every((item) => {
      const itemParentDir = path.dirname(item.path);
      return (
        path.resolve(item.path) === path.resolve(targetDir) ||
        path.resolve(itemParentDir) === path.resolve(targetDir) ||
        path.resolve(itemParentDir) === path.resolve(targetParentDir)
      );
    })
  ) {
    throw new ValidationError("Selected galleries must live in the same folder or target series folder");
  }
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
