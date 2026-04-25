import { LayoutGrid, LayoutList, Rows3 } from "@lucide/svelte";
import type { ImageListItemDto } from "@obscura/contracts";
import type {
  FilterSectionSpec,
  MediaSurfaceConfig,
} from "$lib/media-surface/config";
import {
  deleteImage,
  fetchImages,
  updateImage,
} from "$lib/api/media";
import ImageCard from "./ImageCard.svelte";

type ImageFilterType =
  | "rating"
  | "ratingMin"
  | "ratingMax"
  | "date"
  | "dateFrom"
  | "dateTo"
  | "resolution"
  | "organized"
  | "format"
  | "animated"
  | "dimension"
  | "tag"
  | "performer"
  | "studio";

interface BuildArgs {
  initial: { items: ImageListItemDto[]; total: number };
  pageSize: number;
  page: number;
  nsfwMode: string;
  /** Optional gallery scope; when set, fetcher only returns images from this gallery. */
  galleryId?: string;
  onMutated?: () => void | Promise<void>;
  onConfirmDelete?: (selected: ImageListItemDto[]) => void;
  onItemActivate?: (item: ImageListItemDto, index: number) => void;
}

export function imagesSurfaceConfig(
  args: BuildArgs,
): MediaSurfaceConfig<ImageListItemDto, ImageFilterType> {
  const filterSections: FilterSectionSpec<ImageFilterType>[] = [
    {
      kind: "enum",
      filterType: "resolution",
      label: "Resolution",
      options: [
        { value: "4K", label: "4K" },
        { value: "1080p", label: "1080p" },
        { value: "720p", label: "720p" },
        { value: "480p", label: "480p" },
      ],
    },
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
      filterType: "organized",
      label: "Library flags",
      options: [
        { value: "true", label: "Organized" },
        { value: "false", label: "Not organized" },
      ],
    },
  ];

  return {
    surfaceId: "images",
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
      const resolution = prefs.activeFilters.find((f) => f.type === "resolution")?.value;
      const organized = prefs.activeFilters.find((f) => f.type === "organized")?.value;
      const animated = prefs.activeFilters.find((f) => f.type === "animated")?.value;
      const studio = prefs.activeFilters.find((f) => f.type === "studio")?.value;
      const format = prefs.activeFilters.filter((f) => f.type === "format").map((f) => f.value);
      const dimension = prefs.activeFilters
        .filter((f) => f.type === "dimension")
        .map((f) => f.value);
      const tags = prefs.activeFilters.filter((f) => f.type === "tag").map((f) => f.value);
      const performers = prefs.activeFilters
        .filter((f) => f.type === "performer")
        .map((f) => f.value);

      const response = await fetchImages(
        {
          search: prefs.search.trim() || undefined,
          sort: prefs.sortBy,
          order: prefs.sortDir,
          gallery: args.galleryId,
          studio,
          tag: tags,
          performer: performers,
          format,
          animated,
          dimension,
          ratingMin: ratingMin ? Number(ratingMin) : undefined,
          ratingMax: ratingMax ? Number(ratingMax) : undefined,
          dateFrom,
          dateTo,
          resolution,
          organized,
          nsfw: args.nsfwMode,
          limit,
          offset,
        },
        { signal },
      );
      return { items: response.images, total: response.total };
    },
    card: ImageCard,
    bodyLayout: "masonry",
    layoutByViewMode: { grid: "masonry", list: "list", feed: "feed" },
    defaultPrefs: {
      viewMode: "grid",
      sortBy: "recent",
      sortDir: "desc",
      search: "",
      activeFilters: [],
      cols: 8,
    },
    sortOptions: [
      { value: "recent", label: "Recently Added" },
      { value: "date", label: "Image Date" },
      { value: "title", label: "Title A–Z" },
      { value: "resolution", label: "Resolution" },
      { value: "size", label: "File Size" },
      { value: "rating", label: "Rating" },
    ],
    defaultSortDir: {
      recent: "desc",
      date: "desc",
      title: "asc",
      resolution: "desc",
      size: "desc",
      rating: "desc",
    },
    viewModes: [
      { mode: "grid", icon: LayoutGrid, label: "Grid view" },
      { mode: "list", icon: LayoutList, label: "List view" },
      { mode: "feed", icon: Rows3, label: "Feed view" },
    ],
    filterSections,
    exclusiveFilterTypes: new Set([
      "ratingMin",
      "ratingMax",
      "dateFrom",
      "dateTo",
      "resolution",
      "organized",
      "animated",
      "studio",
    ]),
    searchPlaceholder: "Search images...",
    thumbSize: { min: 3, max: 14, default: 8, label: "Thumbnail size" },
    bulkItemLabel: "images",
    bulkActions: [
      {
        id: "mark-nsfw",
        label: "Mark NSFW",
        handler: async (selected) => {
          await Promise.all(selected.map((i) => updateImage(i.id, { isNsfw: true })));
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
          await Promise.all(selected.map((i) => deleteImage(i.id)));
          await args.onMutated?.();
        },
      },
    ],
    onItemActivate: args.onItemActivate,
  };
}
