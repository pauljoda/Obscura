import { LayoutGrid, LayoutList } from "@lucide/svelte";
import type {
  FilterSectionSpec,
  MediaSurfaceConfig,
} from "$lib/media-surface/config";
import { deleteTag, fetchTags, updateTag } from "$lib/v1/api/entities-v1";
import type { TagItem } from "$lib/v1/api/types-v1";
import TagCard from "./TagCard.svelte";

export type TagFilterType =
  | "rating"
  | "ratingMin"
  | "ratingMax"
  | "favorite"
  | "hasImage"
  | "isNsfw";

interface BuildArgs {
  initial: { items: TagItem[]; total: number };
  pageSize: number;
  page: number;
  nsfwMode: string;
  onMutated?: () => void | Promise<void>;
}

export function tagsSurfaceConfig(
  args: BuildArgs,
): MediaSurfaceConfig<TagItem, TagFilterType> {
  const filterSections: FilterSectionSpec<TagFilterType>[] = [
    {
      kind: "rating",
      filterType: "rating",
      label: "Rating",
      rangeTypes: { min: "ratingMin", max: "ratingMax" },
    },
    {
      kind: "enum",
      filterType: "isNsfw",
      label: "Library flags",
      options: [
        { value: "true", label: "Is NSFW" },
        { value: "false", label: "Not NSFW" },
      ],
    },
  ];

  return {
    surfaceId: "tags",
    pageSize: args.pageSize,
    initial: {
      items: args.initial.items,
      total: args.initial.total,
      loadedStart: (args.page - 1) * args.pageSize,
    },
    fetcher: async ({ offset, limit, signal, prefs }) => {
      const ratingMin = prefs.activeFilters.find((f) => f.type === "ratingMin")?.value;
      const favorite = prefs.activeFilters.find((f) => f.type === "favorite")?.value;
      const hasImage = prefs.activeFilters.find((f) => f.type === "hasImage")?.value;
      const response = await fetchTags(
        {
          search: prefs.search.trim() || undefined,
          sort: prefs.sortBy,
          order: prefs.sortDir,
          randomSeed: prefs.extras?.randomSeed?.toString(),
          favorite,
          hasImage,
          ratingMin: ratingMin ? Number(ratingMin) : undefined,
          nsfw: args.nsfwMode,
          limit,
          offset,
        },
        { signal },
      );
      return { items: response.tags, total: response.total };
    },
    card: TagCard,
    bodyLayout: "grid",
    layoutByViewMode: { grid: "grid", list: "list" },
    defaultPrefs: {
      viewMode: "grid",
      sortBy: "videos",
      sortDir: "desc",
      search: "",
      activeFilters: [],
      cols: 5,
    },
    sortOptions: [
      { value: "videos", label: "Usage Count" },
      { value: "name", label: "Name A-Z" },
      { value: "rating", label: "Rating" },
      { value: "randomized", label: "Randomized" },
    ],
    defaultSortDir: { videos: "desc", name: "asc", rating: "desc", randomized: "asc" },
    viewModes: [
      { mode: "grid", icon: LayoutGrid, label: "Grid view" },
      { mode: "list", icon: LayoutList, label: "List view" },
    ],
    filterSections,
    exclusiveFilterTypes: new Set([
      "ratingMin",
      "ratingMax",
      "favorite",
      "hasImage",
      "isNsfw",
    ]),
    searchPlaceholder: "Search tags...",
    thumbSize: { min: 3, max: 8, default: 5, label: "Tag card size" },
    bulkItemLabel: "tags",
    bulkActions: [
      {
        id: "mark-nsfw",
        label: "Mark NSFW",
        handler: async (selected) => {
          await Promise.all(selected.map((tag) => updateTag(tag.id, { isNsfw: true })));
          await args.onMutated?.();
        },
      },
      {
        id: "delete",
        label: "Delete",
        variant: "danger",
        handler: async (selected) => {
          await Promise.all(selected.map((tag) => deleteTag(tag.id)));
          await args.onMutated?.();
        },
      },
    ],
  };
}
