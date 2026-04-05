import { StudiosPageClient } from "../../../components/routes/studios-page-client";
import { fetchStudios } from "../../../lib/server-api";

export default async function StudiosPage() {
  const studiosResponse = await fetchStudios().catch(() => ({ studios: [] }));

  return <StudiosPageClient initialStudios={studiosResponse.studios} />;
}
