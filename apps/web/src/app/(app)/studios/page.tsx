export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { StudiosPageClient } from "../../../components/routes/studios-page-client";
import { fetchStudios } from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";
import {
  defaultStudiosListPrefs,
  parseStudiosListPrefs,
  STUDIOS_LIST_PREFS_COOKIE,
} from "../../../lib/studios-list-prefs";

export default async function StudiosPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);
  const listPrefs =
    parseStudiosListPrefs(cookieStore.get(STUDIOS_LIST_PREFS_COOKIE)?.value) ?? defaultStudiosListPrefs();

  const studiosResponse = await fetchStudios({ nsfw: nsfwMode }).catch(() => ({ studios: [] }));

  return <StudiosPageClient initialStudios={studiosResponse.studios} initialListPrefs={listPrefs} />;
}
