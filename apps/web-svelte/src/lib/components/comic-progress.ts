export interface ComicReadingProgress {
  pageIndex: number;
  pageCount: number;
  readerMode?: "paged" | "webtoon";
  updatedAt?: string | null;
  completedAt?: string | null;
}

export const defaultComicProgress: ComicReadingProgress = {
  pageIndex: 0,
  pageCount: 0,
  readerMode: "paged",
  updatedAt: null,
  completedAt: null,
};

function clampPageIndex(pageIndex: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.max(0, Math.min(pageCount - 1, Math.trunc(pageIndex)));
}

export function comicReadingProgressKey(galleryId: string): string {
  return `comic-reader:${galleryId}:progress`;
}

export function validateComicProgress(raw: unknown): ComicReadingProgress | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Partial<ComicReadingProgress>;
  if (typeof candidate.pageIndex !== "number") return null;
  return {
    pageIndex: Math.trunc(candidate.pageIndex),
    pageCount: typeof candidate.pageCount === "number" ? Math.trunc(candidate.pageCount) : 0,
    readerMode: candidate.readerMode === "webtoon" ? "webtoon" : "paged",
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    completedAt: typeof candidate.completedAt === "string" ? candidate.completedAt : null,
  };
}

export function normalizeComicProgress(
  progress: Partial<ComicReadingProgress> | null | undefined,
  currentPageCount: number,
): ComicReadingProgress {
  const pageCount = Math.max(0, Math.trunc(currentPageCount));
  return {
    pageIndex: clampPageIndex(Number(progress?.pageIndex ?? 0), pageCount),
    pageCount,
    readerMode: progress?.readerMode === "webtoon" ? "webtoon" : "paged",
    updatedAt: progress?.updatedAt ?? null,
    completedAt: progress?.completedAt ?? null,
  };
}

export function isComicComplete(
  progress: Partial<ComicReadingProgress> | null | undefined,
  currentPageCount: number,
): boolean {
  const normalized = normalizeComicProgress(progress, currentPageCount);
  return Boolean(normalized.completedAt);
}

export function canResumeComic(
  progress: Partial<ComicReadingProgress> | null | undefined,
  currentPageCount: number,
): boolean {
  return normalizeComicProgress(progress, currentPageCount).pageIndex > 0;
}

export function comicProgressPercent(pageIndex: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.round(((clampPageIndex(pageIndex, pageCount) + 1) / pageCount) * 100);
}

export function comicProgressLabel(pageIndex: number, pageCount: number): string {
  if (pageCount <= 0) return "No pages";
  return `Page ${clampPageIndex(pageIndex, pageCount) + 1} of ${pageCount}`;
}
