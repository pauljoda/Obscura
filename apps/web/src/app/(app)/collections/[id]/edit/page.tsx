export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import {
  fetchCollectionDetail,
  fetchTags,
  fetchPerformers,
  fetchStudios,
} from "../../../../../lib/server-api";
import { CollectionEditorClient } from "../../../../../components/routes/collection-editor-client";

interface EditCollectionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCollectionPage({
  params,
}: EditCollectionPageProps) {
  const { id } = await params;

  try {
    const [collection, tagsResponse, performersResponse, studiosResponse] =
      await Promise.all([
        fetchCollectionDetail(id),
        fetchTags().catch(() => ({ tags: [] })),
        fetchPerformers({ limit: 400 }).catch(() => ({
          performers: [],
          total: 0,
          limit: 400,
          offset: 0,
        })),
        fetchStudios().catch(() => ({ studios: [] })),
      ]);

    return (
      <CollectionEditorClient
        collection={collection}
        availableTags={tagsResponse.tags.map((t) => ({
          name: t.name,
          count: t.sceneCount,
        }))}
        availablePerformers={performersResponse.performers.map((p) => ({
          name: p.name,
          count: p.sceneCount,
        }))}
        availableStudios={studiosResponse.studios.map((s) => ({
          name: s.name,
          count: s.sceneCount,
        }))}
      />
    );
  } catch {
    notFound();
  }
}
