import { LayoutGrid, LayoutList } from "@lucide/svelte";
import type {
  FilterSectionSpec,
  MediaSurfaceConfig,
} from "$lib/v1/media-surface/config-v1";
import { fetchPerformers, deletePerformer, updatePerformer } from "$lib/v1/api/entities-v1";
import type { PerformerItem } from "$lib/v1/api/types-v1";
import PerformerCard from "./PerformerCardV1.svelte";

type PerformerFilterType =
  | "rating"
  | "ratingMin"
  | "ratingMax"
  | "gender"
  | "country"
  | "favorite"
  | "isNsfw"
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
      const isNsfw = prefs.activeFilters.find((f) => f.type === "isNsfw")?.value;
      const hasImage = prefs.activeFilters.find((f) => f.type === "hasImage")?.value;
      const response = await fetchPerformers(
        {
          search: prefs.search.trim() || undefined,
          sort: prefs.sortBy,
          order: prefs.sortDir,
          randomSeed: prefs.extras?.randomSeed?.toString(),
          gender,
          country,
          favorite,
          isNsfw,
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
      { value: "randomized", label: "Randomized" },
    ],
    defaultSortDir: { name: "asc", recent: "desc", rating: "desc", randomized: "asc" },
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
      "isNsfw",
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
