import path from "node:path";
import {
  bookVolumeFolderName,
  duplicatedBookVolumeFolderNameRepair,
  fileNameToTitle,
  type ComicInfoMetadata,
} from "@obscura/media-core";

export interface ComicBookArchivePlanInput {
  archivePath: string;
  rootPath: string;
  comicInfo: ComicInfoMetadata | null;
}

export interface ComicBookArchivePlan {
  bookTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  relativePath: string;
  bookRelativePath: string;
  volumeNumber: number | null;
  volumeTitle: string | null;
  volumeRelativePath: string | null;
}

export function isSupportedComicBookArchive(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".zip" || ext === ".cbz";
}

function parseChapterNumber(value: string | undefined, fallback: string): number {
  const explicit = value ? Number.parseFloat(value) : Number.NaN;
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.max(1, Math.round(explicit));
  }

  const match = path.basename(fallback, path.extname(fallback)).match(/(?:^|[^0-9])([0-9]+(?:\.[0-9]+)?)$/);
  if (!match) return 1;
  const parsed = Number.parseFloat(match[1] ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.round(parsed)) : 1;
}

function parseVolumeFolderName(value: string): {
  number: number | null;
  title: string;
  relativeName: string;
} | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const repaired = duplicatedBookVolumeFolderNameRepair(trimmed);
  if (repaired) {
    const parsed = Number.parseInt(repaired.replace(/^Volume\s+/i, ""), 10);
    return {
      number: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null,
      title: repaired,
      relativeName: repaired,
    };
  }
  const explicit = trimmed.match(/^(?:volume|vol\.?|v|book)\s*0*([0-9]+(?:\.[0-9]+)?)$/i);
  if (explicit) {
    const parsed = Number.parseFloat(explicit[1] ?? "");
    const number = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
    return {
      number,
      title: number == null ? trimmed : bookVolumeFolderName(number),
      relativeName: trimmed,
    };
  }
  return null;
}

function volumeTitle(number: number | null, fallback?: string | null): string | null {
  if (fallback?.trim()) return fallback.trim();
  if (number == null) return null;
  return bookVolumeFolderName(number);
}

export function inferComicBookArchivePlan(
  input: ComicBookArchivePlanInput,
): ComicBookArchivePlan {
  const relativePath = path.relative(input.rootPath, input.archivePath) || path.basename(input.archivePath);
  const containingFolder = path.dirname(relativePath);
  const segments = relativePath.split(path.sep).filter(Boolean);
  const fileName = segments.at(-1) ?? path.basename(input.archivePath);
  const folderSegments = segments.slice(0, -1);
  const parentFolder = folderSegments.at(-1) ?? "";
  const archiveName = path.basename(fileName, path.extname(fileName));
  const sameNamedWrapperFolder = parentFolder === archiveName;
  const explicitVolumeFolder =
    parentFolder && folderSegments.length >= 2
      ? parseVolumeFolderName(parentFolder)
      : null;
  const folderBackedVolume = explicitVolumeFolder;
  const fallbackTitle = fileNameToTitle(input.archivePath);
  const chapterNumber = parseChapterNumber(input.comicInfo?.number, input.archivePath);
  const hasFolder = containingFolder !== ".";
  const metadataSeries = input.comicInfo?.series?.trim();
  const metadataTitle = input.comicInfo?.title?.trim();
  const metadataVolumeNumber =
    folderBackedVolume && Number.isFinite(input.comicInfo?.volume) && (input.comicInfo?.volume ?? 0) > 0
      ? Math.round(input.comicInfo!.volume!)
      : null;
  const volumeNumber = folderBackedVolume?.number ?? metadataVolumeNumber;
  const volumeTitleValue = volumeTitle(volumeNumber, folderBackedVolume?.title ?? null);
  const volumeRelativePath = folderBackedVolume
    ? [...folderSegments.slice(0, -1), folderBackedVolume.relativeName].join(path.sep)
    : null;

  const bookFolderSegments =
    folderBackedVolume || (sameNamedWrapperFolder && folderSegments.length >= 2)
      ? folderSegments.slice(0, -1)
      : folderSegments.length >= 2
        ? folderSegments.slice(0, 1)
      : folderSegments;
  const bookFolderName = bookFolderSegments.at(-1) ?? path.basename(containingFolder);
  const bookTitle = metadataSeries || (hasFolder ? bookFolderName : (metadataTitle || fallbackTitle));
  const chapterTitle = metadataTitle || (hasFolder ? fallbackTitle : bookTitle);
  const bookRelativePath = hasFolder ? (bookFolderSegments.join(path.sep) || containingFolder) : fileName;

  return {
    bookTitle,
    chapterTitle,
    chapterNumber,
    relativePath,
    bookRelativePath,
    volumeNumber,
    volumeTitle: volumeTitleValue,
    volumeRelativePath,
  };
}
