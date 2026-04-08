export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { TagsPageClient } from "../../../components/routes/tags-page-client";
import { fetchTags } from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";

export default async function TagsPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const tagsResponse = await fetchTags({ nsfw: nsfwMode }).catch(() => ({ tags: [] }));

  return <TagsPageClient initialTags={tagsResponse.tags} />;
}
