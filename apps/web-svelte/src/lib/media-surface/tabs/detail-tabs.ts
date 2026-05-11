/**
 * Registry mapping a detail entity (tag, performer, studio, etc.) to
 * its set of tabs, derived from the FK audit of packages/db/src/schema.ts.
 * Each entry returns a `MediaTabSpec[]` that the page hands to
 * `<MediaTabs>`.
 *
 * The current pass only fills in the tabs that compose without new
 * server endpoints — i.e. tabs whose fetcher is an existing list API
 * with an existing filter parameter. Reverse-lookup tabs (e.g. "In
 * Collections") and FK gaps (collection_items polymorphism missing
 * series/episodes/audio_libraries) are explicitly omitted here and
 * land in commit 18 once the matching endpoints exist.
 */

import { fetchVideoCards, fetchSeries } from "$lib/api/videos";
import {
  fetchAudioLibraries,
  fetchAudioTracks,
  fetchGalleries,
  fetchImages,
} from "$lib/api/media";
import { fetchPerformers } from "$lib/api/entities";
import { videosSurfaceConfig } from "../configs/videos";
import { galleriesSurfaceConfig } from "../configs/galleries";
import { imagesSurfaceConfig } from "../configs/images";
import { audioSurfaceConfig } from "../configs/audio";
import { booksSurfaceConfig } from "../configs/books";
import { performersSurfaceConfig } from "../configs/performers";
import type { MediaTabSpec } from "./MediaTabs.svelte";
import type {
  AudioLibraryListItemDto,
  AudioTrackListItemDto,
  BookListItemDto,
  GalleryListItemDto,
  ImageListItemDto,
  VideoSeriesListItemDto,
} from "@obscura/contracts";
import type { VideoCardListItem, PerformerItem } from "$lib/api/types";
import AudioLibraryCard from "../configs/AudioLibraryCard.svelte";
import AudioTrackCard from "../configs/AudioTrackCard.svelte";
import SeriesCardWrapper from "../configs/SeriesCardWrapper.svelte";
import VideoCardWrapper from "../configs/VideoCardWrapper.svelte";

export type DetailEntityKind =
  | "tag"
  | "performer"
  | "studio";

type DetailTabId =
  | "videos"
  | "series"
  | "books"
  | "galleries"
  | "images"
  | "audio-libraries"
  | "audio-tracks"
  | "performers";

export interface DetailContext {
  entityKind: DetailEntityKind;
  entityId: string;
  /** Display name (used for tag/studio name-based filters). */
  entityName?: string;
  nsfwMode: string;
  /** SSR'd first page for the active tab; populated only for that tab. */
  initialActive?: {
    tabId: string;
    items: unknown[];
    total: number;
  };
  totals?: Partial<Record<DetailTabId, number>>;
}

const PAGE_SIZE = 60;

function nameFilterValue(ctx: DetailContext): string {
  return ctx.entityName ?? ctx.entityId;
}

function galleryFilterValue(ctx: DetailContext): string {
  return ctx.entityKind === "studio" ? ctx.entityId : nameFilterValue(ctx);
}

function videosTab(ctx: DetailContext): MediaTabSpec {
  const filterValue = nameFilterValue(ctx);
  const initial =
    ctx.initialActive?.tabId === "videos"
      ? {
          items: ctx.initialActive.items as VideoCardListItem[],
          total: ctx.initialActive.total,
        }
      : { items: [], total: 0 };
  const baseConfig = videosSurfaceConfig({
    initial,
    pageSize: PAGE_SIZE,
    page: 1,
    nsfwMode: ctx.nsfwMode,
  });
  // Force the tag/performer/studio scope into every fetch.
  const scopedConfig: any = {
    ...baseConfig,
    surfaceId: `${ctx.entityKind}:${ctx.entityId}:videos`,
    fetcher: async (args: any) => {
      const baseFilters = args.prefs.activeFilters.slice();
      const scopeFilter = (() => {
        if (ctx.entityKind === "tag") return { type: "tag", label: "Tag", value: filterValue };
        if (ctx.entityKind === "performer")
          return { type: "performer", label: "Performer", value: filterValue };
        if (ctx.entityKind === "studio")
          return { type: "studio", label: "Studio", value: filterValue };
        return null;
      })();
      const merged =
        scopeFilter && !baseFilters.some((f: any) => f.type === scopeFilter.type && f.value === scopeFilter.value)
          ? [...baseFilters, scopeFilter]
          : baseFilters;
      return baseConfig.fetcher({
        ...args,
        prefs: { ...args.prefs, activeFilters: merged as typeof args.prefs.activeFilters },
      });
    },
  };
  return {
    id: "videos",
    label: "Videos",
    count: ctx.totals?.videos,
    build: () => scopedConfig,
  };
}

function galleriesTab(ctx: DetailContext): MediaTabSpec {
  const filterValue = galleryFilterValue(ctx);
  const initial =
    ctx.initialActive?.tabId === "galleries"
      ? {
          items: ctx.initialActive.items as GalleryListItemDto[],
          total: ctx.initialActive.total,
        }
      : { items: [], total: 0 };
  const baseConfig = galleriesSurfaceConfig({
    initial,
    pageSize: PAGE_SIZE,
    page: 1,
    nsfwMode: ctx.nsfwMode,
    root: "all",
  });
  const scopedConfig: any = {
    ...baseConfig,
    surfaceId: `${ctx.entityKind}:${ctx.entityId}:galleries`,
    fetcher: async (args: any) => {
      const baseFilters = args.prefs.activeFilters.slice();
      const scopeFilter =
        ctx.entityKind === "tag"
          ? { type: "tag", label: "Tag", value: filterValue }
          : ctx.entityKind === "performer"
            ? { type: "performer", label: "Performer", value: filterValue }
            : { type: "studio", label: "Studio", value: filterValue };
      const merged = baseFilters.some(
        
        (f: any) => f.type === scopeFilter.type && f.value === scopeFilter.value,
      )
        ? baseFilters
        : [...baseFilters, scopeFilter];
      return baseConfig.fetcher({
        ...args,
        prefs: { ...args.prefs, activeFilters: merged as typeof args.prefs.activeFilters },
      });
    },
  };
  return {
    id: "galleries",
    label: "Galleries",
    count: ctx.totals?.galleries,
    build: () => scopedConfig,
  };
}

function booksTab(ctx: DetailContext): MediaTabSpec {
  const filterValue = galleryFilterValue(ctx);
  const initial =
    ctx.initialActive?.tabId === "books"
      ? {
          items: ctx.initialActive.items as BookListItemDto[],
          total: ctx.initialActive.total,
        }
      : { items: [], total: 0 };
  const baseConfig = booksSurfaceConfig({
    initial,
    pageSize: PAGE_SIZE,
    page: 1,
    nsfwMode: ctx.nsfwMode,
  });
  const scopedConfig: any = {
    ...baseConfig,
    surfaceId: `${ctx.entityKind}:${ctx.entityId}:books`,
    fetcher: async (args: any) => {
      const baseFilters = args.prefs.activeFilters.slice();
      const scopeFilter =
        ctx.entityKind === "tag"
          ? { type: "tag", label: "Tag", value: filterValue }
          : ctx.entityKind === "performer"
            ? { type: "performer", label: "Performer", value: filterValue }
            : { type: "studio", label: "Studio", value: filterValue };
      const merged = baseFilters.some(
        (filter: any) => filter.type === scopeFilter.type && filter.value === scopeFilter.value,
      )
        ? baseFilters
        : [...baseFilters, scopeFilter];
      return baseConfig.fetcher({
        ...args,
        prefs: { ...args.prefs, activeFilters: merged as typeof args.prefs.activeFilters },
      });
    },
  };
  return {
    id: "books",
    label: "Books",
    count: ctx.totals?.books,
    build: () => scopedConfig,
  };
}

function imagesTab(ctx: DetailContext): MediaTabSpec {
  const filterValue = galleryFilterValue(ctx);
  const initial =
    ctx.initialActive?.tabId === "images"
      ? {
          items: ctx.initialActive.items as ImageListItemDto[],
          total: ctx.initialActive.total,
        }
      : { items: [], total: 0 };
  const baseConfig = imagesSurfaceConfig({
    initial,
    pageSize: PAGE_SIZE,
    page: 1,
    nsfwMode: ctx.nsfwMode,
  });
  const scopedConfig: any = {
    ...baseConfig,
    surfaceId: `${ctx.entityKind}:${ctx.entityId}:images`,
    fetcher: async (args: any) => {
      const baseFilters = args.prefs.activeFilters.slice();
      const scopeFilter =
        ctx.entityKind === "tag"
          ? { type: "tag", label: "Tag", value: filterValue }
          : ctx.entityKind === "performer"
            ? { type: "performer", label: "Performer", value: filterValue }
            : { type: "studio", label: "Studio", value: filterValue };
      const merged = baseFilters.some(
        
        (f: any) => f.type === scopeFilter.type && f.value === scopeFilter.value,
      )
        ? baseFilters
        : [...baseFilters, scopeFilter];
      return baseConfig.fetcher({
        ...args,
        prefs: { ...args.prefs, activeFilters: merged as typeof args.prefs.activeFilters },
      });
    },
  };
  return {
    id: "images",
    label: "Images",
    count: ctx.totals?.images,
    build: () => scopedConfig,
  };
}

function audioLibrariesTab(ctx: DetailContext): MediaTabSpec {
  const filterValue = nameFilterValue(ctx);
  const initial =
    ctx.initialActive?.tabId === "audio-libraries"
      ? {
          items: ctx.initialActive.items as AudioLibraryListItemDto[],
          total: ctx.initialActive.total,
        }
      : { items: [], total: 0 };
  const baseConfig = audioSurfaceConfig({
    initial,
    pageSize: PAGE_SIZE,
    page: 1,
    nsfwMode: ctx.nsfwMode,
    root: "all",
  });
  const scopedConfig: any = {
    ...baseConfig,
    surfaceId: `${ctx.entityKind}:${ctx.entityId}:audio-libraries`,
    fetcher: async (args: any) => {
      const baseFilters = args.prefs.activeFilters.slice();
      const scopeFilter =
        ctx.entityKind === "tag"
          ? { type: "tag", label: "Tag", value: filterValue }
          : ctx.entityKind === "performer"
            ? { type: "performer", label: "Performer", value: filterValue }
            : { type: "studio", label: "Studio", value: filterValue };
      const merged = baseFilters.some(
        
        (f: any) => f.type === scopeFilter.type && f.value === scopeFilter.value,
      )
        ? baseFilters
        : [...baseFilters, scopeFilter];
      return baseConfig.fetcher({
        ...args,
        prefs: { ...args.prefs, activeFilters: merged as typeof args.prefs.activeFilters },
      });
    },
  };
  return {
    id: "audio-libraries",
    label: "Audio Libraries",
    count: ctx.totals?.["audio-libraries"],
    build: () => scopedConfig,
  };
}

function audioTracksTab(ctx: DetailContext): MediaTabSpec {
  const filterValue = nameFilterValue(ctx);
  return {
    id: "audio-tracks",
    label: "Audio Tracks",
    count: ctx.totals?.["audio-tracks"],
    build: () =>
      ({
        surfaceId: `${ctx.entityKind}:${ctx.entityId}:audio-tracks`,
        pageSize: PAGE_SIZE,
        initial:
          ctx.initialActive?.tabId === "audio-tracks"
            ? {
                items: ctx.initialActive.items as AudioTrackListItemDto[],
                total: ctx.initialActive.total,
                loadedStart: 0,
              }
            : undefined,
        fetcher: async ({ offset, limit, signal, prefs }) => {
          const filterKey =
            ctx.entityKind === "tag"
              ? "tag"
              : ctx.entityKind === "performer"
                ? "performer"
                : "studio";
          const response = await fetchAudioTracks(
            {
              search: prefs.search.trim() || undefined,
              sort: prefs.sortBy,
              order: prefs.sortDir,
              randomSeed: prefs.extras?.randomSeed?.toString(),
              [filterKey]: filterValue,
              nsfw: ctx.nsfwMode,
              limit,
              offset,
            },
            { signal },
          );
          return { items: response.items, total: response.total };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        card: AudioTrackCard as unknown as any,
        bodyLayout: "list",
        defaultPrefs: {
          viewMode: "list",
          sortBy: "recent",
          sortDir: "desc",
          search: "",
          activeFilters: [],
        },
        sortOptions: [
          { value: "recent", label: "Recently Added" },
          { value: "title", label: "Title A–Z" },
          { value: "rating", label: "Rating" },
          { value: "randomized", label: "Randomized" },
        ],
        defaultSortDir: { recent: "desc", title: "asc", rating: "desc", randomized: "asc" },
        searchPlaceholder: "Search tracks...",
      }),
  };
}

function seriesTab(ctx: DetailContext): MediaTabSpec {
  const filterValue = nameFilterValue(ctx);
  return {
    id: "series",
    label: "Series",
    count: ctx.totals?.series,
    build: () =>
      ({
        surfaceId: `${ctx.entityKind}:${ctx.entityId}:series`,
        pageSize: PAGE_SIZE,
        initial:
          ctx.initialActive?.tabId === "series"
            ? {
                items: ctx.initialActive.items as VideoSeriesListItemDto[],
                total: ctx.initialActive.total,
                loadedStart: 0,
              }
            : undefined,
        fetcher: async ({ offset, limit, signal, prefs }) => {
          const filterKey =
            ctx.entityKind === "tag"
              ? "tag"
              : ctx.entityKind === "performer"
                ? "performer"
                : "studio";
          const response = await fetchSeries(
            {
              search: prefs.search.trim() || undefined,
              sort: prefs.sortBy,
              order: prefs.sortDir,
              randomSeed: prefs.extras?.randomSeed?.toString(),
              [filterKey]: filterValue,
              nsfw: ctx.nsfwMode,
              limit,
              offset,
            },
            { signal },
          );
          return { items: response.items, total: response.total };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        card: SeriesCardWrapper as unknown as any,
        bodyLayout: "grid",
        defaultPrefs: {
          viewMode: "grid",
          sortBy: "recent",
          sortDir: "desc",
          search: "",
          activeFilters: [],
        },
        sortOptions: [
          { value: "recent", label: "Recently Added" },
          { value: "title", label: "Title A–Z" },
          { value: "rating", label: "Rating" },
          { value: "randomized", label: "Randomized" },
        ],
        defaultSortDir: { recent: "desc", title: "asc", rating: "desc", randomized: "asc" },
        searchPlaceholder: "Search series...",
      }),
  };
}

function performersTab(ctx: DetailContext): MediaTabSpec {
  // Performers tab on a *tag* detail — uses the tag-name filter on the
  // performer list. Server-side performer endpoint doesn't expose a tag
  // filter today, so this tab is wired against fetchPerformers without
  // it; the hookup goes live with commit 18 (reverse-lookup filters).
  const initial =
    ctx.initialActive?.tabId === "performers"
      ? {
          items: ctx.initialActive.items as PerformerItem[],
          total: ctx.initialActive.total,
        }
      : { items: [], total: 0 };
  const baseConfig = performersSurfaceConfig({
    initial,
    pageSize: PAGE_SIZE,
    page: 1,
    nsfwMode: ctx.nsfwMode,
  });
  return {
    id: "performers",
    label: "Performers",
    count: ctx.totals?.performers,
    build: () =>
      ({
        ...baseConfig,
        surfaceId: `${ctx.entityKind}:${ctx.entityId}:performers`,
      }),
  };
}

export function detailTabsFor(ctx: DetailContext): MediaTabSpec[] {
  const tabs = (() => {
    switch (ctx.entityKind) {
    case "tag":
      return [
        videosTab(ctx),
        seriesTab(ctx),
        booksTab(ctx),
        galleriesTab(ctx),
        imagesTab(ctx),
        audioLibrariesTab(ctx),
        audioTracksTab(ctx),
        performersTab(ctx),
      ];
    case "performer":
      return [
        videosTab(ctx),
        seriesTab(ctx),
        booksTab(ctx),
        galleriesTab(ctx),
        imagesTab(ctx),
        audioLibrariesTab(ctx),
        audioTracksTab(ctx),
      ];
    case "studio":
      return [
        videosTab(ctx),
        seriesTab(ctx),
        booksTab(ctx),
        galleriesTab(ctx),
        imagesTab(ctx),
        audioLibrariesTab(ctx),
        audioTracksTab(ctx),
      ];
    }
  })();

  return tabs.filter((tab) => ctx.totals?.[tab.id as DetailTabId] !== 0);
}
