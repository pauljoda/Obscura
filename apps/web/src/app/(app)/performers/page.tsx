export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { PerformersPageClient } from "../../../components/routes/performers-page-client";
import { fetchPerformers } from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";
import {
  defaultPerformersListPrefs,
  performersListPrefsToFetchParams,
  PERFORMERS_LIST_PREFS_COOKIE,
  parsePerformersListPrefs,
} from "../../../lib/performers-list-prefs";

export default async function PerformersPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);
  const listPrefs =
    parsePerformersListPrefs(cookieStore.get(PERFORMERS_LIST_PREFS_COOKIE)?.value) ??
    defaultPerformersListPrefs();
  const performerFetchParams = performersListPrefsToFetchParams(listPrefs, nsfwMode);

  const performersResponse = await fetchPerformers(performerFetchParams).catch(() => ({
    performers: [],
    total: 0,
    limit: 50,
    offset: 0,
  }));

  return (
    <PerformersPageClient
      initialPerformers={performersResponse.performers}
      initialTotal={performersResponse.total}
      initialListPrefs={listPrefs}
    />
  );
}
