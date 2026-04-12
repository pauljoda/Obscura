export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { fetchCollectionDetail } from "../../../../../lib/server-api";
import { CollectionEditorClient } from "../../../../../components/routes/collection-editor-client";

interface EditCollectionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCollectionPage({
  params,
}: EditCollectionPageProps) {
  const { id } = await params;

  try {
    const collection = await fetchCollectionDetail(id);
    return <CollectionEditorClient collection={collection} />;
  } catch {
    notFound();
  }
}
