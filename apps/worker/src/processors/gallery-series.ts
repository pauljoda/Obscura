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

export function inferComicArchiveGrouping(
  zipPath: string,
  rootPath: string,
  galleryIdByPath: Map<string, string>,
): { parentId: string | null; parentTitle: string | null } {
  const zipDir = path.dirname(zipPath);
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
