import { PerformersPageClient } from "../../../components/routes/performers-page-client";
import { fetchPerformers } from "../../../lib/server-api";

export default async function PerformersPage() {
  const performersResponse = await fetchPerformers({
    sort: "scenes",
    order: "desc",
    limit: 50,
    offset: 0,
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
