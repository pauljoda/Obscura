export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { StudiosPageClient } from "../../../components/routes/studios-page-client";
import { fetchStudios } from "../../../lib/server-api";
import { parseNsfwModeCookie } from "../../../lib/nsfw-cookie";

export default async function StudiosPage() {
  const cookieStore = await cookies();
  const nsfwMode = parseNsfwModeCookie(cookieStore.get("obscura-nsfw-mode")?.value);

  const studiosResponse = await fetchStudios({ nsfw: nsfwMode }).catch(() => ({ studios: [] }));

  return <StudiosPageClient initialStudios={studiosResponse.studios} />;
}
