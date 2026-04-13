export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import {
  fetchCollectionDetail,
  fetchTags,
  fetchPerformers,
  fetchStudios,
} from "../../../../../lib/server-api";
import {
  buildPerformerSuggestions,
  buildStudioSuggestions,
  buildTagSuggestions,
} from "../../../../../lib/collection-suggestions";
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
        availableTags={buildTagSuggestions(tagsResponse.tags)}
        availablePerformers={buildPerformerSuggestions(
          performersResponse.performers,
        )}
        availableStudios={buildStudioSuggestions(studiosResponse.studios)}
      />
    );
  } catch {
    notFound();
  }
}
