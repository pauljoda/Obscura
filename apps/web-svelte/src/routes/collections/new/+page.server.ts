import {
  fetchTags,
  fetchPerformers,
  fetchStudios,
} from "$lib/v1/server/media-v1";
import {
  buildPerformerSuggestions,
  buildStudioSuggestions,
  buildTagSuggestions,
} from "$lib/collection-suggestions";

export const prerender = false;

export async function load({ fetch }) {
  const [tagsResponse, performersResponse, studiosResponse] = await Promise.all([
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
    availableTags: buildTagSuggestions(tagsResponse.tags),
    availablePerformers: buildPerformerSuggestions(performersResponse.performers),
    availableStudios: buildStudioSuggestions(studiosResponse.studios),
  };
}
