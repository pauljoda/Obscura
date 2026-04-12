export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import {
  fetchCollectionDetail,
  fetchCollectionItems,
} from "../../../../lib/server-api";
import { CollectionDetailClient } from "../../../../components/routes/collection-detail-client";

interface CollectionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionDetailPage({
  params,
}: CollectionDetailPageProps) {
  const { id } = await params;

  try {
    const [collection, itemsResponse] = await Promise.all([
      fetchCollectionDetail(id),
      fetchCollectionItems(id, { limit: 100 }),
    ]);

    return (
      <CollectionDetailClient
        collection={collection}
        initialItems={itemsResponse.items}
        initialTotal={itemsResponse.total}
      />
    );
  } catch {
    notFound();
  }
}
