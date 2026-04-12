export const dynamic = "force-dynamic";

import {
  fetchTags,
  fetchPerformers,
  fetchStudios,
} from "../../../../lib/server-api";
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
}
