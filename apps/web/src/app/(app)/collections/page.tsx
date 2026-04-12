export const dynamic = "force-dynamic";

import { fetchCollections } from "../../../lib/server-api";
import { CollectionsPageClient } from "../../../components/routes/collections-page-client";

export default async function CollectionsPage() {
  const { items, total } = await fetchCollections({ limit: 100 }).catch(
    () => ({ items: [], total: 0 }),
  );

  return (
    <CollectionsPageClient initialCollections={items} initialTotal={total} />
  );
}
