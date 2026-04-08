export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { PerformersPageClient } from "../../../components/routes/performers-page-client";
import { fetchPerformers } from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";

export default async function PerformersPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const performersResponse = await fetchPerformers({
    sort: "scenes",
    order: "desc",
    limit: 50,
    offset: 0,
    nsfw: nsfwMode,
  }).catch(() => ({
    performers: [],
    total: 0,
    limit: 50,
    offset: 0,
  }));

  return (
    <PerformersPageClient
      initialPerformers={performersResponse.performers}
      initialTotal={performersResponse.total}
    />
  );
}
