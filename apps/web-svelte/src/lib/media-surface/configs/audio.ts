import { LayoutGrid, LayoutList } from "@lucide/svelte";
import type { AudioLibraryListItemDto } from "@obscura/contracts";
import type {
  FilterSectionSpec,
  MediaSurfaceConfig,
} from "$lib/media-surface/config";
import {
  deleteAudioLibrary,
  fetchAudioLibraries,
  updateAudioLibrary,
} from "$lib/api/media";
import AudioLibraryCard from "./AudioLibraryCard.svelte";

type AudioFilterType =
  | "rating"
  | "ratingMin"
  | "ratingMax"
  | "organized"
  | "tag"
  | "performer"
  | "studio";

interface BuildArgs {
  initial: { items: AudioLibraryListItemDto[]; total: number };
  pageSize: number;
  page: number;
  nsfwMode: string;
  root?: string;
  onMutated?: () => void | Promise<void>;
  onConfirmDelete?: (selected: AudioLibraryListItemDto[]) => void;
}

export function audioSurfaceConfig(
  args: BuildArgs,
): MediaSurfaceConfig<AudioLibraryListItemDto, AudioFilterType> {
  const filterSections: FilterSectionSpec<AudioFilterType>[] = [
    {
      kind: "rating",
      filterType: "rating",
      label: "Rating",
      rangeTypes: { min: "ratingMin", max: "ratingMax" },
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
    surfaceId: "audio",
    pageSize: args.pageSize,
    initial: {
      items: args.initial.items,
      total: args.initial.total,
      loadedStart: (args.page - 1) * args.pageSize,
    },
    fetcher: async ({ offset, limit, signal, prefs }) => {
      const ratingMin = prefs.activeFilters.find((f) => f.type === "ratingMin")?.value;
      const ratingMax = prefs.activeFilters.find((f) => f.type === "ratingMax")?.value;
      const organized = prefs.activeFilters.find((f) => f.type === "organized")?.value;
      const studio = prefs.activeFilters.find((f) => f.type === "studio")?.value;
      const response = await fetchAudioLibraries(
        {
          search: prefs.search.trim() || undefined,
          sort: prefs.sortBy,
          order: prefs.sortDir,
          randomSeed: prefs.extras?.randomSeed?.toString(),
          ratingMin: ratingMin ? Number(ratingMin) : undefined,
          ratingMax: ratingMax ? Number(ratingMax) : undefined,
          organized,
          studio,
          tag: prefs.activeFilters.filter((f) => f.type === "tag").map((f) => f.value),
          performer: prefs.activeFilters.filter((f) => f.type === "performer").map((f) => f.value),
          root: args.root,
          nsfw: args.nsfwMode,
          limit,
          offset,
        },
        { signal },
      );
      return { items: response.items, total: response.total };
    },
    card: AudioLibraryCard,
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
      { value: "date", label: "Release Date" },
      { value: "title", label: "Title A–Z" },
      { value: "trackCount", label: "Track Count" },
      { value: "rating", label: "Rating" },
      { value: "randomized", label: "Randomized" },
    ],
    defaultSortDir: {
      recent: "desc",
      date: "desc",
      title: "asc",
      trackCount: "desc",
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
      "organized",
    ]),
    searchPlaceholder: "Search audio...",
    thumbSize: { min: 2, max: 8, default: 5, label: "Album card size" },
    bulkItemLabel: "audio libraries",
    bulkActions: [
      {
        id: "mark-nsfw",
        label: "Mark NSFW",
        handler: async (selected) => {
          await Promise.all(selected.map((l) => updateAudioLibrary(l.id, { isNsfw: true })));
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
          await Promise.all(selected.map((l) => deleteAudioLibrary(l.id)));
          await args.onMutated?.();
        },
      },
    ],
  };
}
