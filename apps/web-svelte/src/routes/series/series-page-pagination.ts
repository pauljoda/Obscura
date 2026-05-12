import { mergeUniquePage } from "$lib/media-surface/pagination/load-more";

export interface SeriesLoadedWindowArgs {
  loadedStart: number;
  itemCount: number;
  total: number;
  pageSize: number;
}

export function getSeriesLoadedWindow(args: SeriesLoadedWindowArgs) {
  const loadedEnd = Math.min(args.total, args.loadedStart + args.itemCount);
  return {
    loadedEnd,
    hasMore: loadedEnd < args.total,
    nextPageNumber:
      Math.floor((args.loadedStart + args.itemCount) / args.pageSize) + 1,
  };
}

export function seriesPageHref(url: URL, nextPage: number): string {
  const params = new URLSearchParams(url.searchParams);
  if (nextPage > 1) params.set("page", String(nextPage));
  else params.delete("page");
  const qs = params.toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}

export function applySeriesPageMerge<T extends { id: string }>(args: {
  current: T[];
  incoming: T[];
  loadedStart: number;
  total: number;
}) {
  return mergeUniquePage(args);
}
