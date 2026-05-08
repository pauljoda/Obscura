export type ComicPageMode = "single" | "double";

export interface ComicReaderOptions {
  pageMode: ComicPageMode;
  firstPageIsCover: boolean;
}

function clampIndex(index: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, index));
}

export function comicSpreadForIndex(
  index: number,
  total: number,
  options: ComicReaderOptions,
): number[] {
  if (total <= 0) return [];
  const current = clampIndex(index, total);
  if (options.pageMode === "single") return [current];
  if (options.firstPageIsCover && current === 0) return [0];

  const spreadStart = options.firstPageIsCover
    ? current % 2 === 1
      ? current
      : current - 1
    : current % 2 === 0
      ? current
      : current - 1;
  const safeStart = clampIndex(spreadStart, total);
  const next = safeStart + 1;
  return next < total ? [safeStart, next] : [safeStart];
}

export function nextComicIndex(
  index: number,
  total: number,
  options: ComicReaderOptions,
): number {
  if (total <= 0) return 0;
  if (options.pageMode === "single") return clampIndex(index + 1, total);
  const spread = comicSpreadForIndex(index, total, options);
  const next = (spread.at(-1) ?? index) + 1;
  return clampIndex(next, total);
}

export function previousComicIndex(
  index: number,
  total: number,
  options: ComicReaderOptions,
): number {
  if (total <= 0) return 0;
  if (options.pageMode === "single") return clampIndex(index - 1, total);
  const spread = comicSpreadForIndex(index, total, options);
  const previous = (spread[0] ?? index) - 1;
  if (options.firstPageIsCover && previous <= 0) return 0;
  if (!options.firstPageIsCover) return previous % 2 === 0 ? clampIndex(previous, total) : clampIndex(previous - 1, total);
  return previous % 2 === 1 ? clampIndex(previous, total) : clampIndex(previous - 1, total);
}
