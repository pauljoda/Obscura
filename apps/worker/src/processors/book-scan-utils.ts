import path from "node:path";
import { fileNameToTitle, type ComicInfoMetadata } from "@obscura/media-core";

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

export function inferComicBookArchivePlan(
  input: ComicBookArchivePlanInput,
): ComicBookArchivePlan {
  const relativePath = path.relative(input.rootPath, input.archivePath) || path.basename(input.archivePath);
  const containingFolder = path.dirname(relativePath);
  const fallbackTitle = fileNameToTitle(input.archivePath);
  const chapterNumber = parseChapterNumber(input.comicInfo?.number, input.archivePath);
  const hasFolder = containingFolder !== ".";
  const metadataSeries = input.comicInfo?.series?.trim();
  const metadataTitle = input.comicInfo?.title?.trim();

  const bookTitle = metadataSeries || (hasFolder ? path.basename(containingFolder) : (metadataTitle || fallbackTitle));
  const chapterTitle = metadataTitle || (hasFolder ? fallbackTitle : bookTitle);
  const bookRelativePath = hasFolder ? containingFolder : relativePath;

  return {
    bookTitle,
    chapterTitle,
    chapterNumber,
    relativePath,
    bookRelativePath,
  };
}
