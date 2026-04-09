export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { TagsPageClient } from "../../../components/routes/tags-page-client";
import { fetchTags } from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";
import {
  defaultTagsListPrefs,
  parseTagsListPrefs,
  TAGS_LIST_PREFS_COOKIE,
} from "../../../lib/tags-list-prefs";

export default async function TagsPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);
  const listPrefs =
    parseTagsListPrefs(cookieStore.get(TAGS_LIST_PREFS_COOKIE)?.value) ?? defaultTagsListPrefs();

  const tagsResponse = await fetchTags({ nsfw: nsfwMode }).catch(() => ({ tags: [] }));

  return <TagsPageClient initialTags={tagsResponse.tags} initialListPrefs={listPrefs} />;
}
