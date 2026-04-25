import { LayoutGrid, LayoutList } from "@lucide/svelte";
import type { CollectionListItemDto } from "@obscura/contracts";
import type { MediaSurfaceConfig } from "$lib/media-surface/config";
import { fetchCollections } from "$lib/api/media";
import CollectionCard from "./CollectionCard.svelte";

type CollectionFilterType = never;

interface BuildArgs {
  initial: { items: CollectionListItemDto[]; total: number };
  pageSize: number;
  page: number;
  /** Optional collection-mode filter forwarded as `?mode=` to the API. */
  mode?: string;
}

export function collectionsSurfaceConfig(
  args: BuildArgs,
): MediaSurfaceConfig<CollectionListItemDto, CollectionFilterType> {
  return {
    surfaceId: "collections",
    pageSize: args.pageSize,
    initial: {
      items: args.initial.items,
      total: args.initial.total,
      loadedStart: (args.page - 1) * args.pageSize,
    },
    fetcher: async ({ offset, limit, signal, prefs }) => {
      const response = await fetchCollections(
        {
          search: prefs.search.trim() || undefined,
          sort: prefs.sortBy,
          order: prefs.sortDir,
          mode: args.mode,
          limit,
          offset,
        },
        { signal },
      );
      return { items: response.items, total: response.total };
    },
    card: CollectionCard,
    bodyLayout: "grid",
    layoutByViewMode: { grid: "grid", list: "list" },
    defaultPrefs: {
      viewMode: "grid",
      sortBy: "recent",
      sortDir: "desc",
      search: "",
      activeFilters: [],
      cols: 5,
    },
    sortOptions: [
      { value: "recent", label: "Recently Added" },
      { value: "name", label: "Name A–Z" },
      { value: "itemCount", label: "Item Count" },
    ],
    defaultSortDir: { recent: "desc", name: "asc", itemCount: "desc" },
    viewModes: [
      { mode: "grid", icon: LayoutGrid, label: "Grid view" },
      { mode: "list", icon: LayoutList, label: "List view" },
    ],
    searchPlaceholder: "Search collections...",
    thumbSize: { min: 2, max: 8, default: 5, label: "Collection card size" },
  };
}
