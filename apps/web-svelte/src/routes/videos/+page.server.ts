import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { fetchVideoCards } from "$lib/server/videos";
import { parseNsfwModeCookie } from "$lib/nsfw-cookie";
import {
  VIDEOS_LIST_PREFS_COOKIE,
  defaultVideosListPrefs,
  parseVideosListPrefs,
  videosListPrefsToFetchParams,
} from "$lib/prefs/videos-list-prefs";
import { serverFetch } from "$lib/server/core";
import type { PerformerItem, StudioItem, TagItem } from "$lib/api/types";

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ cookies, url, depends, fetch }) => {
  depends("videos");

  const nsfwMode = parseNsfwModeCookie(cookies.get("obscura-nsfw-mode"));
  const cookieRaw = cookies.get(VIDEOS_LIST_PREFS_COOKIE);
  const prefs = parseVideosListPrefs(cookieRaw) ?? defaultVideosListPrefs();

  // Navigation params — these stay on the URL; view prefs live on the cookie.
  // `?view=series` is a legacy URL from the React build; redirect it to
  // /series so deep links keep working even though the cookie now owns
  // view mode.
  const seriesParam = url.searchParams.get("series");
  const legacyViewRaw = url.searchParams.get("view");
  if (seriesParam || legacyViewRaw === "series" || prefs.viewMode === "series") {
    const params = new URLSearchParams(url.searchParams);
    params.delete("view");
    const qs = params.toString();
    throw redirect(307, qs ? `/series?${qs}` : "/series");
  }
  const seasonRaw = url.searchParams.get("season");
  const seasonNumber =
    seasonRaw != null && /^\d+$/.test(seasonRaw) ? seasonRaw : undefined;
  const pageParam = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const fetchParams = videosListPrefsToFetchParams(prefs, nsfwMode);

  const videosPromise = fetchVideoCards(
    {
      ...fetchParams,
      seasonNumber,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
    { fetch },
  ).catch(() => ({ videos: [], total: 0, limit: PAGE_SIZE, offset: 0 }));

  // Filter-panel data — studios, tags, and top performers. Streamed so
  // the card grid renders without waiting for these larger payloads.
  const qs = (n: string) => (nsfwMode ? `?nsfw=${nsfwMode}` : "");
  const studiosPromise = serverFetch<{ studios: StudioItem[] }>(
    `/studios${qs("nsfw")}`,
    { fetch },
  )
    .then((r) => r.studios)
    .catch(() => [] as StudioItem[]);
  const tagsPromise = serverFetch<{ tags: TagItem[] }>(
    `/tags${qs("nsfw")}`,
    { fetch },
  )
    .then((r) => r.tags)
    .catch(() => [] as TagItem[]);
  const performersPromise = serverFetch<{ performers: PerformerItem[] }>(
    `/performers${nsfwMode ? `?nsfw=${nsfwMode}&sort=videos&order=desc&limit=200` : "?sort=videos&order=desc&limit=200"}`,
    { fetch },
  )
    .then((r) => r.performers)
    .catch(() => [] as PerformerItem[]);

  const response = await videosPromise;

  return {
    videos: response.videos,
    total: response.total,
    page,
    pageSize: PAGE_SIZE,
    prefs,
    // Streamed — render the page skeleton immediately, fill in the
    // filter panel on arrival.
    streamed: {
      studios: studiosPromise,
      tags: tagsPromise,
      performers: performersPromise,
    },
  };
};
