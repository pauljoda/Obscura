import path from "node:path";

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function trailingNumber(value: string): number | null {
  const match = value.trim().match(/(?:^|[\s._#-])(\d{1,4})$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function stripTrailingNumber(value: string): string {
  return value.trim().replace(/(?:[\s._#-]+)\d{1,4}$/, "").trim();
}

export function redundantSingleArchiveFolders(input: {
  rootPath: string;
  imageFiles: string[];
  zipFiles: string[];
}): Set<string> {
  const imageCountByDir = new Map<string, number>();
  for (const filePath of input.imageFiles) {
    const dir = path.dirname(filePath);
    imageCountByDir.set(dir, (imageCountByDir.get(dir) ?? 0) + 1);
  }

  const zipFilesByDir = new Map<string, string[]>();
  for (const zipPath of input.zipFiles) {
    const dir = path.dirname(zipPath);
    zipFilesByDir.set(dir, [...(zipFilesByDir.get(dir) ?? []), zipPath]);
  }

  const rootPath = path.resolve(input.rootPath);
  const redundant = new Set<string>();
  for (const [dir, zipFiles] of zipFilesByDir) {
    if (path.resolve(dir) === rootPath) continue;
    if (zipFiles.length !== 1) continue;
    if ((imageCountByDir.get(dir) ?? 0) > 0) continue;

    const zipPath = zipFiles[0];
    const dirTitle = normalizeTitle(path.basename(dir));
    const archiveTitle = normalizeTitle(path.basename(zipPath, path.extname(zipPath)));
    if (dirTitle === archiveTitle) redundant.add(dir);
  }
  return redundant;
}

export function effectiveComicArchiveDir(
  zipPath: string,
  redundantFolders: Set<string>,
): string {
  const zipDir = path.dirname(zipPath);
  return redundantFolders.has(zipDir) ? path.dirname(zipDir) : zipDir;
}

export function inferComicArchiveGrouping(
  zipPath: string,
  rootPath: string,
  galleryIdByPath: Map<string, string>,
  redundantFolders: Set<string> = new Set(),
): { parentId: string | null; parentTitle: string | null } {
  const zipDir = effectiveComicArchiveDir(zipPath, redundantFolders);
  if (path.resolve(zipDir) === path.resolve(rootPath)) {
    return { parentId: null, parentTitle: null };
  }

  const parentId = galleryIdByPath.get(zipDir) ?? null;
  return {
    parentId,
    parentTitle: parentId ? path.basename(zipDir) : null,
  };
}

export function inferComicArchiveTitle(input: {
  zipPath: string;
  fallbackTitle: string;
  parentTitle: string | null;
  comicInfoTitle?: string;
  comicInfoNumber?: string;
}): string {
  const sourceTitle = input.comicInfoTitle?.trim() || input.fallbackTitle;
  if (!input.parentTitle) return sourceTitle;

  const explicitNumber = input.comicInfoNumber ? Number(input.comicInfoNumber) : NaN;
  const sequence =
    Number.isFinite(explicitNumber) && explicitNumber > 0
      ? explicitNumber
      : trailingNumber(path.basename(input.zipPath, path.extname(input.zipPath)));

  if (!sequence) return sourceTitle;

  const parent = normalizeTitle(input.parentTitle);
  const baseWithoutNumber = normalizeTitle(stripTrailingNumber(sourceTitle));
  const fallbackWithoutNumber = normalizeTitle(stripTrailingNumber(input.fallbackTitle));

  if (baseWithoutNumber !== parent && fallbackWithoutNumber !== parent) {
    return sourceTitle;
  }

  return `${input.parentTitle} #${String(sequence).padStart(2, "0")}`;
}
