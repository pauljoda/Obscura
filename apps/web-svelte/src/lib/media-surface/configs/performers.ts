import { LayoutGrid, LayoutList } from "@lucide/svelte";
import type {
  FilterSectionSpec,
  MediaSurfaceConfig,
} from "$lib/media-surface/config";
import { fetchPerformers, deletePerformer, updatePerformer } from "$lib/api/entities";
import type { PerformerItem } from "$lib/api/types";
import PerformerCard from "./PerformerCard.svelte";

type PerformerFilterType =
  | "rating"
  | "ratingMin"
  | "ratingMax"
  | "gender"
  | "country"
  | "favorite"
  | "hasImage";

interface BuildArgs {
  initial: { items: PerformerItem[]; total: number };
  pageSize: number;
  page: number;
  nsfwMode: string;
  onMutated?: () => void | Promise<void>;
}

export function performersSurfaceConfig(
  args: BuildArgs,
): MediaSurfaceConfig<PerformerItem, PerformerFilterType> {
  const filterSections: FilterSectionSpec<PerformerFilterType>[] = [
    {
      kind: "rating",
      filterType: "rating",
      label: "Rating",
      rangeTypes: { min: "ratingMin", max: "ratingMax" },
    },
  ];

  return {
    surfaceId: "performers",
    pageSize: args.pageSize,
    initial: {
      items: args.initial.items,
      total: args.initial.total,
      loadedStart: (args.page - 1) * args.pageSize,
    },
    fetcher: async ({ offset, limit, signal, prefs }) => {
      const ratingMin = prefs.activeFilters.find((f) => f.type === "ratingMin")?.value;
      const ratingMax = prefs.activeFilters.find((f) => f.type === "ratingMax")?.value;
      const gender = prefs.activeFilters.find((f) => f.type === "gender")?.value;
      const country = prefs.activeFilters.find((f) => f.type === "country")?.value;
      const favorite = prefs.activeFilters.find((f) => f.type === "favorite")?.value;
      const hasImage = prefs.activeFilters.find((f) => f.type === "hasImage")?.value;
      const response = await fetchPerformers(
        {
          search: prefs.search.trim() || undefined,
          sort: prefs.sortBy,
          order: prefs.sortDir,
          gender,
          country,
          favorite,
          hasImage,
          ratingMin: ratingMin ? Number(ratingMin) : undefined,
          ratingMax: ratingMax ? Number(ratingMax) : undefined,
          counts: "false",
          nsfw: args.nsfwMode,
          limit,
          offset,
        },
        { signal },
      );
      return { items: response.performers, total: response.total };
    },
    card: PerformerCard,
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
      { value: "name", label: "Name A–Z" },
      { value: "recent", label: "Recently Added" },
      { value: "rating", label: "Rating" },
    ],
    defaultSortDir: { name: "asc", recent: "desc", rating: "desc" },
    viewModes: [
      { mode: "grid", icon: LayoutGrid, label: "Grid view" },
      { mode: "list", icon: LayoutList, label: "List view" },
    ],
    filterSections,
    exclusiveFilterTypes: new Set([
      "ratingMin",
      "ratingMax",
      "gender",
      "country",
      "favorite",
      "hasImage",
    ]),
    searchPlaceholder: "Search actors...",
    thumbSize: { min: 3, max: 8, default: 5, label: "Actor card size" },
    bulkItemLabel: "actors",
    bulkActions: [
      {
        id: "mark-nsfw",
        label: "Mark NSFW",
        handler: async (selected) => {
          await Promise.all(selected.map((p) => updatePerformer(p.id, { isNsfw: true })));
          await args.onMutated?.();
        },
      },
      {
        id: "delete",
        label: "Delete",
        variant: "danger",
        handler: async (selected) => {
          await Promise.all(selected.map((p) => deletePerformer(p.id)));
          await args.onMutated?.();
        },
      },
    ],
  };
}
