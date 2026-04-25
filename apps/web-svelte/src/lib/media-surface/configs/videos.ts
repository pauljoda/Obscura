import { LayoutGrid, LayoutList } from "@lucide/svelte";
import type {
  AvailableFilterItems,
  FilterSectionSpec,
  MediaSurfaceConfig,
} from "$lib/media-surface/config";
import {
  deleteVideo,
  fetchVideoCards,
  updateVideo,
} from "$lib/api/videos";
import type { VideoCardListItem } from "$lib/api/types";
import {
  videosListPrefsToFetchParams,
  type VideosListPrefs,
  type VideosListPrefsActiveFilter,
} from "$lib/prefs/videos-list-prefs";
import VideoCardWrapper from "./VideoCardWrapper.svelte";

type VideoFilterType =
  | "rating"
  | "ratingMin"
  | "ratingMax"
  | "date"
  | "dateFrom"
  | "dateTo"
  | "duration"
  | "resolution"
  | "codec"
  | "organized"
  | "interactive"
  | "played"
  | "hasFile"
  | "tag"
  | "performer"
  | "studio";

interface BuildArgs {
  initial: { items: VideoCardListItem[]; total: number };
  pageSize: number;
  page: number;
  nsfwMode: string;
  /** Optional season scope forwarded as `seasonNumber` to the API. */
  seasonNumber?: string;
  available?: AvailableFilterItems;
  onMutated?: () => void | Promise<void>;
  onConfirmDelete?: (selected: VideoCardListItem[]) => void;
}

export function videosSurfaceConfig(
  args: BuildArgs,
): MediaSurfaceConfig<VideoCardListItem, VideoFilterType> {
  const filterSections: FilterSectionSpec<VideoFilterType>[] = [
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
      filterType: "duration",
      label: "Duration",
      options: [
        { value: "lt300", label: "< 5 min" },
        { value: "300-900", label: "5–15 min" },
        { value: "900-1800", label: "15–30 min" },
        { value: "gte1800", label: "30+ min" },
      ],
    },
    {
      kind: "enum",
      filterType: "played",
      label: "Playback & file",
      options: [
        { value: "true", label: "Played" },
        { value: "false", label: "Unplayed" },
      ],
    },
    {
      kind: "enum",
      filterType: "hasFile",
      label: "Playback & file",
      options: [
        { value: "true", label: "Has file" },
        { value: "false", label: "No file" },
      ],
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
    {
      kind: "enum",
      filterType: "interactive",
      label: "Library flags",
      options: [
        { value: "true", label: "Interactive" },
        { value: "false", label: "Not interactive" },
      ],
    },
    {
      kind: "enum",
      filterType: "codec",
      label: "Codec",
      options: [
        { value: "h264", label: "H.264" },
        { value: "hevc", label: "HEVC" },
        { value: "av1", label: "AV1" },
        { value: "vp9", label: "VP9" },
        { value: "vp8", label: "VP8" },
        { value: "mpeg4", label: "MPEG-4" },
        { value: "prores", label: "ProRes" },
        { value: "wmv", label: "WMV" },
      ],
    },
    {
      kind: "alphabetical-id-list",
      filterType: "tag",
      label: "Tags",
      source: "tags",
    },
    {
      kind: "alphabetical-id-list",
      filterType: "performer",
      label: "Performers",
      source: "performers",
    },
    {
      kind: "alphabetical-id-list",
      filterType: "studio",
      label: "Studios",
      source: "studios",
    },
  ];

  return {
    surfaceId: "videos",
    pageSize: args.pageSize,
    initial: {
      items: args.initial.items,
      total: args.initial.total,
      loadedStart: (args.page - 1) * args.pageSize,
    },
    fetcher: async ({ offset, limit, signal, prefs }) => {
      const legacyPrefs: VideosListPrefs = {
        viewMode: prefs.viewMode === "list" ? "list" : "grid",
        sortBy: prefs.sortBy as VideosListPrefs["sortBy"],
        sortDir: prefs.sortDir,
        search: prefs.search,
        activeFilters: prefs.activeFilters as VideosListPrefsActiveFilter[],
        activePresetId: prefs.activePresetId,
      };
      const fetchParams = videosListPrefsToFetchParams(legacyPrefs, args.nsfwMode);
      const response = await fetchVideoCards(
        {
          ...fetchParams,
          seasonNumber: args.seasonNumber,
          limit,
          offset,
        },
        { signal },
      );
      return { items: response.videos, total: response.total };
    },
    card: VideoCardWrapper,
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
      { value: "date", label: "Video date" },
      { value: "title", label: "Title A-Z" },
      { value: "duration", label: "Duration" },
      { value: "size", label: "File Size" },
      { value: "rating", label: "Rating" },
      { value: "plays", label: "Most Played" },
    ],
    defaultSortDir: {
      recent: "desc",
      date: "desc",
      title: "asc",
      duration: "desc",
      size: "desc",
      rating: "desc",
      plays: "desc",
    },
    viewModes: [
      { mode: "grid", icon: LayoutGrid, label: "Grid view" },
      { mode: "list", icon: LayoutList, label: "List view" },
    ],
    filterSections,
    availableFilterItems: args.available,
    exclusiveFilterTypes: new Set([
      "ratingMin",
      "ratingMax",
      "dateFrom",
      "dateTo",
      "duration",
      "resolution",
      "organized",
      "interactive",
      "played",
      "hasFile",
    ]),
    searchPlaceholder: "Search videos...",
    thumbSize: { min: 2, max: 8, default: 5, label: "Video card size" },
    bulkItemLabel: "videos",
    bulkActions: [
      {
        id: "mark-nsfw",
        label: "Mark NSFW",
        handler: async (selected) => {
          await Promise.all(selected.map((v) => updateVideo(v.id, { isNsfw: true })));
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
          await Promise.all(selected.map((v) => deleteVideo(v.id)));
          await args.onMutated?.();
        },
      },
    ],
  };
}
