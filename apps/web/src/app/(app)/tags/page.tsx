export const dynamic = "force-dynamic";

import { TagsPageClient } from "../../../components/routes/tags-page-client";
import { fetchTags } from "../../../lib/server-api";

export default async function TagsPage() {
  const tagsResponse = await fetchTags().catch(() => ({ tags: [] }));

  return <TagsPageClient initialTags={tagsResponse.tags} />;
}
