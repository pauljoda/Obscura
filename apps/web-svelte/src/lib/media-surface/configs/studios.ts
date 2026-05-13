import { LayoutGrid, LayoutList } from "@lucide/svelte";
import type {
  FilterSectionSpec,
  MediaSurfaceConfig,
} from "$lib/media-surface/config";
import { deleteStudio, fetchStudios, updateStudio } from "$lib/v1/api/entities-v1";
import type { StudioItem } from "$lib/v1/api/types-v1";
import StudioCard from "./StudioCard.svelte";

export type StudioFilterType =
  | "rating"
  | "ratingMin"
  | "ratingMax"
  | "favorite"
  | "hasImage"
  | "isNsfw";

interface BuildArgs {
  initial: { items: StudioItem[]; total: number };
  pageSize: number;
  page: number;
  nsfwMode: string;
  onMutated?: () => void | Promise<void>;
}

export function studiosSurfaceConfig(
  args: BuildArgs,
): MediaSurfaceConfig<StudioItem, StudioFilterType> {
  const filterSections: FilterSectionSpec<StudioFilterType>[] = [
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
    surfaceId: "studios",
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
      const response = await fetchStudios(
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
      return { items: response.studios, total: response.total };
    },
    card: StudioCard,
    bodyLayout: "grid",
    layoutByViewMode: { grid: "grid", list: "list" },
    defaultPrefs: {
      viewMode: "grid",
      sortBy: "name",
      sortDir: "asc",
      search: "",
      activeFilters: [],
      cols: 5,
    },
    sortOptions: [
      { value: "name", label: "Name" },
      { value: "videoCount", label: "Video Count" },
      { value: "rating", label: "Rating" },
      { value: "randomized", label: "Randomized" },
    ],
    defaultSortDir: { name: "asc", videoCount: "desc", rating: "desc", randomized: "asc" },
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
    searchPlaceholder: "Search studios...",
    thumbSize: { min: 3, max: 8, default: 5, label: "Studio card size" },
    bulkItemLabel: "studios",
    bulkActions: [
      {
        id: "mark-nsfw",
        label: "Mark NSFW",
        handler: async (selected) => {
          await Promise.all(selected.map((studio) => updateStudio(studio.id, { isNsfw: true })));
          await args.onMutated?.();
        },
      },
      {
        id: "delete",
        label: "Delete",
        variant: "danger",
        handler: async (selected) => {
          await Promise.all(selected.map((studio) => deleteStudio(studio.id)));
          await args.onMutated?.();
        },
      },
    ],
  };
}
