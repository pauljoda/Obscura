import { error } from "@sveltejs/kit";
import {
  fetchCollectionDetail,
  fetchTags,
  fetchPerformers,
  fetchStudios,
} from "$lib/server/media";
import {
  buildPerformerSuggestions,
  buildStudioSuggestions,
  buildTagSuggestions,
} from "$lib/collection-suggestions";

export const prerender = false;

export async function load({ params, depends, fetch }) {
  const { id } = params;
  depends(`collections:${id}`);

  try {
    const [collection, tagsResponse, performersResponse, studiosResponse] =
      await Promise.all([
        fetchCollectionDetail(id, { fetch }),
        fetchTags(undefined, { fetch }).catch(() => ({ tags: [] })),
        fetchPerformers({ limit: 400 }, { fetch }).catch(() => ({
          performers: [],
          total: 0,
          limit: 400,
          offset: 0,
        })),
        fetchStudios(undefined, { fetch }).catch(() => ({ studios: [] })),
      ]);

    return {
      collection,
      availableTags: buildTagSuggestions(tagsResponse.tags),
      availablePerformers: buildPerformerSuggestions(performersResponse.performers),
      availableStudios: buildStudioSuggestions(studiosResponse.studios),
    };
  } catch {
    throw error(404, "Collection not found");
  }
}
