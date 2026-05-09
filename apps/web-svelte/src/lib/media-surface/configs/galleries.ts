import { LayoutGrid, LayoutList } from "@lucide/svelte";
import type { GalleryListItemDto } from "@obscura/contracts";
import type {
  FilterSectionSpec,
  MediaSurfaceConfig,
} from "$lib/media-surface/config";
import {
  deleteGallery,
  fetchGalleries,
  updateGallery,
} from "$lib/api/media";
import GalleryCard from "./GalleryCard.svelte";

type GalleryFilterType =
  | "rating"
  | "ratingMin"
  | "ratingMax"
  | "date"
  | "dateFrom"
  | "dateTo"
  | "comic"
  | "read"
  | "tag"
  | "performer"
  | "studio";

interface BuildArgs {
  initial: { items: GalleryListItemDto[]; total: number };
  pageSize: number;
  page: number;
  nsfwMode: string;
  root?: string;
  onMutated?: () => void | Promise<void>;
  onConfirmDelete?: (selected: GalleryListItemDto[]) => void;
  onMergeSeries?: (selected: GalleryListItemDto[]) => void;
}

export function galleriesSurfaceConfig(
  args: BuildArgs,
): MediaSurfaceConfig<GalleryListItemDto, GalleryFilterType> {
  const filterSections: FilterSectionSpec<GalleryFilterType>[] = [
    {
      kind: "rating",
      filterType: "rating",
      label: "Rating",
      rangeTypes: { min: "ratingMin", max: "ratingMax" },
    },
    {
      kind: "date-range",
      filterType: "date",
      label: "Date",
      rangeTypes: { min: "dateFrom", max: "dateTo" },
    },
    {
      kind: "enum",
      filterType: "comic",
      label: "Library flags",
      options: [
        { value: "true", label: "Comic" },
        { value: "false", label: "Not comic" },
      ],
    },
    {
      kind: "enum",
      filterType: "read",
      label: "Library flags",
      options: [
        { value: "unread", label: "Unread" },
        { value: "read", label: "Read" },
      ],
    },
  ];

  return {
    surfaceId: "galleries",
    pageSize: args.pageSize,
    initial: {
      items: args.initial.items,
      total: args.initial.total,
      loadedStart: (args.page - 1) * args.pageSize,
    },
    fetcher: async ({ offset, limit, signal, prefs }) => {
      const ratingMin = prefs.activeFilters.find((f) => f.type === "ratingMin")?.value;
      const ratingMax = prefs.activeFilters.find((f) => f.type === "ratingMax")?.value;
      const dateFrom = prefs.activeFilters.find((f) => f.type === "dateFrom")?.value;
      const dateTo = prefs.activeFilters.find((f) => f.type === "dateTo")?.value;
      const comic = prefs.activeFilters.find((f) => f.type === "comic")?.value;
      const read = prefs.activeFilters.find((f) => f.type === "read")?.value;
      const studio = prefs.activeFilters.find((f) => f.type === "studio")?.value;
      const tags = prefs.activeFilters.filter((f) => f.type === "tag").map((f) => f.value);
      const performers = prefs.activeFilters
        .filter((f) => f.type === "performer")
        .map((f) => f.value);

      const response = await fetchGalleries(
        {
          search: prefs.search.trim() || undefined,
          sort: prefs.sortBy,
          order: prefs.sortDir,
          randomSeed: prefs.extras?.randomSeed?.toString(),
          studio,
          tag: tags,
          performer: performers,
          root: args.root,
          ratingMin: ratingMin ? Number(ratingMin) : undefined,
          ratingMax: ratingMax ? Number(ratingMax) : undefined,
          dateFrom,
          dateTo,
          comic,
          read,
          nsfw: args.nsfwMode,
          limit,
          offset,
        },
        { signal },
      );
      return { items: response.galleries, total: response.total };
    },
    card: GalleryCard,
    bodyLayout: "grid",
    layoutByViewMode: { grid: "grid", list: "list" },
    defaultPrefs: {
      viewMode: "grid",
      sortBy: "recent",
      sortDir: "desc",
      search: "",
      activeFilters: [],
      cols: 4,
    },
    sortOptions: [
      { value: "recent", label: "Recently Added" },
      { value: "date", label: "Gallery Date" },
      { value: "title", label: "Title A–Z" },
      { value: "imageCount", label: "Image Count" },
      { value: "rating", label: "Rating" },
      { value: "randomized", label: "Randomized" },
    ],
    defaultSortDir: {
      recent: "desc",
      date: "desc",
      title: "asc",
      imageCount: "desc",
      rating: "desc",
      randomized: "asc",
    },
    viewModes: [
      { mode: "grid", icon: LayoutGrid, label: "Grid view" },
      { mode: "list", icon: LayoutList, label: "List view" },
    ],
    filterSections,
    exclusiveFilterTypes: new Set([
      "ratingMin",
      "ratingMax",
      "dateFrom",
      "dateTo",
      "comic",
      "read",
      "studio",
    ]),
    searchPlaceholder: "Search galleries...",
    thumbSize: { min: 2, max: 8, default: 4, label: "Gallery card size" },
    bulkItemLabel: "galleries",
    bulkActions: [
      {
        id: "merge-series",
        label: "Merge into series",
        handler: async (selected) => {
          args.onMergeSeries?.(selected);
        },
      },
      {
        id: "mark-nsfw",
        label: "Mark NSFW",
        handler: async (selected) => {
          await Promise.all(selected.map((g) => updateGallery(g.id, { isNsfw: true })));
          await args.onMutated?.();
        },
      },
      {
        id: "delete",
        label: "Delete",
        variant: "danger",
        handler: async (selected) => {
          if (args.onConfirmDelete) {
            args.onConfirmDelete(selected);
            return;
          }
          await Promise.all(selected.map((g) => deleteGallery(g.id)));
          await args.onMutated?.();
        },
      },
    ],
  };
}
