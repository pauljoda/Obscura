export const dynamic = "force-dynamic";

import {
  fetchTags,
  fetchPerformers,
  fetchStudios,
} from "../../../../lib/server-api";
import {
  buildPerformerSuggestions,
  buildStudioSuggestions,
  buildTagSuggestions,
} from "../../../../lib/collection-suggestions";
import { CollectionEditorClient } from "../../../../components/routes/collection-editor-client";

export default async function NewCollectionPage() {
  const [tagsResponse, performersResponse, studiosResponse] =
    await Promise.all([
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
      isNew
      availableTags={buildTagSuggestions(tagsResponse.tags)}
      availablePerformers={buildPerformerSuggestions(
        performersResponse.performers,
      )}
      availableStudios={buildStudioSuggestions(studiosResponse.studios)}
    />
  );
}
