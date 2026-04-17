"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Clock,
  Edit2,
  FolderOpen,
  HardDrive,
  Loader2,
  Save,
  Trash2,
  TrendingUp,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VideoGrid } from "../video-grid";
import { ImportButton, UploadDropZone } from "../upload";
import { FilterBar } from "../filter-bar";
import type { SortDir, SortOption, ViewMode } from "../filter-bar";
import {
  fetchVideos,
  fetchVideoStats,
  fetchSeries,
  fetchSeriesDetail,
  fetchPerformers,
  fetchStudios,
  fetchTags,
  updateVideo,
  deleteVideo,
  toApiUrl,
  updateSeries,
  uploadSeriesCover,
  deleteSeriesCover,
  uploadSeriesBackdrop,
  deleteSeriesBackdrop,
  type PerformerItem,
  type SeriesDetail,
  type SeriesListItem,
  type VideoListItem,
  type VideoStats,
  type StudioItem,
  type TagItem,
} from "../../lib/api";
import { revalidateSeriesCache } from "../../app/actions/revalidate-series";
import { InfoRow } from "../shared/metadata-panel";
import { NsfwChip, NsfwEditToggle, NsfwTagLabel, tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { ChipInput } from "../shared/chip-input";
import { StarRatingPicker } from "../shared/star-rating-picker";
import { EntityPreviewMedia } from "../shared/entity-preview-media";
import { VIDEO_CARD_GRADIENTS } from "../videos/video-card-gradients";
import { useNsfw } from "../nsfw/nsfw-context";
import { formatVideoCount, useTerms } from "../../lib/terminology";
import { cn } from "@obscura/ui/lib/utils";
import { DASHBOARD_STAT_GRADIENTS } from "../dashboard/dashboard-utils";
import { useSelection } from "../../hooks/use-selection";
import { SelectAllHeader } from "../select-all-header";
import { BulkActionToolbar } from "../bulk-action-toolbar";
import { ConfirmDeleteDialog } from "../confirm-delete-dialog";
import type { VideosListPrefs, VideosListPrefsActiveFilter } from "../../lib/videos-list-prefs";
import {
  defaultVideosListPrefs,
  isDefaultVideosListPrefs,
  videosListPrefsToFetchParams,
  writeVideosListPrefsCookie,
  clearVideosListPrefsCookie,
} from "../../lib/videos-list-prefs";
import {
  type FilterPreset,
  loadPresets,
  savePresets,
} from "../../lib/filter-presets";
import { SeriesCard } from "../series/series-card";
import { HierarchyBreadcrumbs } from "../shared/hierarchy-breadcrumbs";
import { HierarchySection } from "../shared/hierarchy-section";
import { IdentifyButton } from "../identify/identify-button";
import { HierarchyShell } from "../shared/hierarchy-shell";
import { useCurrentPath } from "../../hooks/use-current-path";

interface VideosPageClientProps {
  initialVideos: VideoListItem[];
  initialStats: VideoStats | null;
  initialStudios: StudioItem[];
  initialTags: TagItem[];
  initialPerformers: PerformerItem[];
  initialTotal: number;
  initialListPrefs: VideosListPrefs;
  initialRootSeries: SeriesListItem[];
  initialActiveSeries: SeriesDetail | null;
}

export function VideosPageClient({
  initialVideos,
  initialStats,
  initialStudios,
  initialTags,
  initialPerformers,
  initialTotal,
  initialListPrefs,
  initialRootSeries,
  initialActiveSeries,
}: VideosPageClientProps) {
  const { mode: nsfwMode } = useNsfw();
  const terms = useTerms();
  const _currentPath = useCurrentPath();
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    void fetchVideoStats(nsfwMode)
      .then(setStats)
      .catch(() => {});
  }, [nsfwMode]);

  const skipFirstFilterRefetch = useRef(true);
  useEffect(() => {
    if (skipFirstFilterRefetch.current) {
      skipFirstFilterRefetch.current = false;
      return;
    }
    void Promise.all([
      fetchStudios({ nsfw: nsfwMode }),
      fetchTags({ nsfw: nsfwMode }),
      fetchPerformers({
        nsfw: nsfwMode,
        sort: "scenes",
        order: "desc",
        limit: 400,
      }),
    ])
      .then(([s, t, perf]) => {
        setFilterStudios(s.studios);
        setFilterTags(t.tags);
        setFilterPerformers(perf.performers);
      })
      .catch(() => {});
  }, [nsfwMode]);

  const [viewMode, setViewMode] = useState<ViewMode>(initialListPrefs.viewMode);
  // When the page lands inside a series folder (activeSeries set),
  // default to episode-order sort per spec §5.x — the natural way to
  // view a show is season 1 ep 1, 2, 3… Otherwise the user's saved
  // prefs win. `loadVideos` re-reads `sortBy` from state, so this
  // initial override flows through the first fetch.
  const [sortBy, setSortBy] = useState<SortOption>(
    initialActiveSeries ? "episode" : initialListPrefs.sortBy,
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    initialActiveSeries ? "asc" : initialListPrefs.sortDir,
  );
  const [searchQuery, setSearchQuery] = useState(initialListPrefs.search);
  const [activeFilters, setActiveFilters] = useState<VideosListPrefsActiveFilter[]>(
    initialListPrefs.activeFilters,
  );
  const [videos, setVideos] = useState(initialVideos);
  const [total, setTotal] = useState(initialTotal);
  const [filterStudios, setFilterStudios] = useState(initialStudios);
  const [filterTags, setFilterTags] = useState(initialTags);
  const [filterPerformers, setFilterPerformers] = useState(initialPerformers);
  const [rootSeries, setRootFolders] = useState(initialRootSeries);
  const [activeSeries, setActiveFolder] = useState<SeriesDetail | null>(initialActiveSeries);
  /**
   * When browsing a Case B series (seasons), the user can drill into a
   * specific season. `null` means "show the season grid" (no episodes
   * loaded); a number means "show episodes from that season only".
   * Case A series (single flat season) skip this entirely — the page
   * loads episodes directly.
   */
  const router = useRouter();

  // Season drill-down state. Uses pushState (NOT router.replace) to
  // avoid triggering a server re-render that would flash the full
  // episode list before the client-side re-fetch with the season
  // param. A popstate listener keeps the state in sync with
  // browser-back, and we compute the `from` param for episode links
  // manually below so it includes `&season=N`.
  const [activeSeasonNumber, setActiveSeasonNumberRaw] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("season");
    if (raw == null) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  });

  useEffect(() => {
    function readSeason(): number | null {
      const raw = new URLSearchParams(window.location.search).get("season");
      if (raw == null) return null;
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    function onPopState() {
      setActiveSeasonNumberRaw(readSeason());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setActiveSeasonNumber = useCallback(
    (n: number | null) => {
      setActiveSeasonNumberRaw(n);
      if (!activeSeries) return;
      const url = new URL(window.location.href);
      if (n !== null) {
        url.searchParams.set("season", String(n));
      } else {
        url.searchParams.delete("season");
      }
      window.history.pushState(null, "", url.toString());
    },
    [activeSeries],
  );

  // useCurrentPath reads from useSearchParams which doesn't see
  // pushState updates. Manually inject &season=N so episode card
  // links encode the correct from-path for browser-back.
  const currentPath = useMemo(() => {
    if (activeSeasonNumber == null) return _currentPath;
    const sep = _currentPath.includes("?") ? "&" : "?";
    return `${_currentPath}${sep}season=${activeSeasonNumber}`;
  }, [_currentPath, activeSeasonNumber]);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [backdropBusy, setBackdropBusy] = useState(false);
  const [seriesError, setFolderError] = useState<string | null>(null);
  const [seriesEditMode, setFolderEditMode] = useState(false);
  const [editCustomName, setEditCustomName] = useState("");
  const [editIsNsfw, setEditIsNsfw] = useState(false);
  const [editDetails, setEditDetails] = useState("");
  const [editStudioName, setEditStudioName] = useState("");
  const [editStudioFocused, setEditStudioFocused] = useState(false);
  const [editPerformerNames, setEditPerformerNames] = useState<string[]>([]);
  const [editTagNames, setEditTagNames] = useState<string[]>([]);
  const [editRating, setEditRating] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [seriesSaving, setFolderSaving] = useState(false);
  const [seriesEditStudios, setFolderEditStudios] = useState<StudioItem[]>([]);
  const [seriesEditPerformers, setFolderEditPerformers] = useState<PerformerItem[]>([]);
  const [seriesEditTags, setFolderEditTags] = useState<TagItem[]>([]);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const backdropInputRef = useRef<HTMLInputElement>(null);

  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(
    initialListPrefs.activePresetId ?? null,
  );

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const selection = useSelection();
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setRootFolders(initialRootSeries);
    setActiveFolder(initialActiveSeries);
    // Don't reset season to null here — seasonFromUrl above handles
    // reading the initial ?season= param from the URL.
    // Navigating INTO a series folder resets the sort to episode
    // order; navigating OUT (initialActiveSeries becomes null) falls
    // back to the user's saved listing preference. Keeps "episode"
    // meaningful only where it makes sense and never bleeds into the
    // flat video feed.
    if (initialActiveSeries) {
      setSortBy("episode");
      setSortDir("asc");
    } else {
      setSortBy(initialListPrefs.sortBy);
      setSortDir(initialListPrefs.sortDir);
    }
  }, [initialRootSeries, initialActiveSeries, initialListPrefs]);

  useEffect(() => {
    const prefs: VideosListPrefs = {
      viewMode,
      sortBy,
      sortDir,
      search: searchQuery,
      activeFilters,
      activePresetId: activePresetId ?? undefined,
    };
    if (isDefaultVideosListPrefs(prefs)) {
      clearVideosListPrefsCookie();
    } else {
      writeVideosListPrefsCookie(prefs);
    }
  }, [viewMode, sortBy, sortDir, searchQuery, activeFilters, activePresetId]);

  const handleClearFiltersAndSort = useCallback(() => {
    const d = defaultVideosListPrefs();
    setViewMode(d.viewMode);
    setSortBy(d.sortBy);
    setSortDir(d.sortDir);
    setSearchQuery(d.search);
    setActiveFilters(d.activeFilters);
  }, []);

  const buildParams = useCallback(() => {
    return videosListPrefsToFetchParams(
      {
        viewMode,
        sortBy,
        sortDir,
        search: deferredSearchQuery,
        activeFilters,
      },
      nsfwMode,
    );
  }, [activeFilters, deferredSearchQuery, sortBy, sortDir, nsfwMode, viewMode]);

  const seriesSearch = deferredSearchQuery.trim() || undefined;
  const hasFolderScopedSceneQuery =
    Boolean(seriesSearch) || activeFilters.length > 0;

  const filterBarDisplayFilters = useMemo(() => {
    const durationLabels: Record<string, string> = {
      lt300: "< 5 min",
      "300-900": "5–15 min",
      "900-1800": "15–30 min",
      gte1800: "30+ min",
    };
    const codecLabels: Record<string, string> = {
      h264: "H.264",
      hevc: "HEVC",
      av1: "AV1",
      vp9: "VP9",
      vp8: "VP8",
      mpeg4: "MPEG-4",
      prores: "ProRes",
      wmv: "WMV",
    };
    return activeFilters.map((f) => {
      let v = f.value;
      if (f.type === "studio") {
        v = filterStudios.find((s) => s.id === f.value)?.name ?? f.value;
      } else if (f.type === "played") {
        v = f.value === "true" ? "Played" : "Unplayed";
      } else if (f.type === "hasFile") {
        v = f.value === "true" ? "Has file" : "No file";
      } else if (f.type === "organized" || f.type === "interactive") {
        v = f.value === "true" ? "Yes" : "No";
      } else if (f.type === "duration") {
        v = durationLabels[f.value] ?? f.value;
      } else if (f.type === "codec") {
        v = codecLabels[f.value] ?? f.value;
      } else if (f.type === "ratingMin") {
        v = `${f.value}★+`;
      } else if (f.type === "ratingMax") {
        v = `≤${f.value}★`;
      }
      return { type: f.type, label: f.label, value: v };
    });
  }, [activeFilters, filterStudios]);

  // Should we hold off on fetching episodes and instead show the
  // season grid? True only for Case B series (seasons rendering mode)
  // when the user hasn't drilled into a specific season yet.
  const showSeasonGrid =
    viewMode === "series" &&
    activeSeries?.renderingMode === "seasons" &&
    activeSeasonNumber === null &&
    !hasFolderScopedSceneQuery;

  const loadVideos = useCallback(async () => {
    if (showSeasonGrid) {
      setVideos([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const result = await fetchVideos(
        viewMode === "series"
          ? {
              ...buildParams(),
              limit: 50,
              videoSeriesId: activeSeries?.id ?? undefined,
              seriesScope:
                activeSeries?.id && hasFolderScopedSceneQuery ? "subtree" : "direct",
              uncategorized: !activeSeries?.id,
              seasonNumber:
                activeSeries?.id && activeSeasonNumber !== null
                  ? String(activeSeasonNumber)
                  : undefined,
            }
          : {
              ...buildParams(),
              limit: 50,
            },
      );

      setVideos(result.videos);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load videos:", error);
    } finally {
      setLoading(false);
    }
  }, [
    activeSeries?.id,
    activeSeasonNumber,
    buildParams,
    hasFolderScopedSceneQuery,
    showSeasonGrid,
    viewMode,
  ]);

  const loadMore = useCallback(async () => {
    if (loadingMore || videos.length >= total) return;
    setLoadingMore(true);

    try {
      const result = await fetchVideos(
        viewMode === "series"
          ? {
              ...buildParams(),
              limit: 50,
              offset: videos.length,
              videoSeriesId: activeSeries?.id ?? undefined,
              seriesScope:
                activeSeries?.id && hasFolderScopedSceneQuery ? "subtree" : "direct",
              uncategorized: !activeSeries?.id,
              seasonNumber:
                activeSeries?.id && activeSeasonNumber !== null
                  ? String(activeSeasonNumber)
                  : undefined,
            }
          : {
              ...buildParams(),
              limit: 50,
              offset: videos.length,
            },
      );

      setVideos((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const newItems = result.videos.filter((s) => !existingIds.has(s.id));
        return [...prev, ...newItems];
      });
    } catch (error) {
      console.error("Failed to load more videos:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [
    activeSeries?.id,
    buildParams,
    hasFolderScopedSceneQuery,
    loadingMore,
    videos.length,
    total,
    viewMode,
  ]);

  const loadSeriesContext = useCallback(async () => {
    if (viewMode !== "series") return;

    if (activeSeries?.id) {
      try {
        const detail = await fetchSeriesDetail(activeSeries.id, {
          nsfw: nsfwMode,
        });
        setActiveFolder(detail);
      } catch (error) {
        console.error("Failed to load scene folder detail:", error);
        setActiveFolder(null);
      }
      return;
    }

    try {
      const result = await fetchSeries({
        search: seriesSearch,
        root: seriesSearch ? "all" : undefined,
        limit: 200,
        nsfw: nsfwMode,
      });
      setRootFolders(result.items);
    } catch (error) {
      console.error("Failed to load scene folders:", error);
      setRootFolders([]);
    }
  }, [activeSeries?.id, seriesSearch, nsfwMode, viewMode]);

  const reloadSeries = useCallback(async () => {
    if (!activeSeries?.id) return;
    const detail = await fetchSeriesDetail(activeSeries.id, { nsfw: nsfwMode });
    setActiveFolder(detail);
  }, [activeSeries?.id, nsfwMode]);

  const handleSeriesSave = useCallback(
    async (patch: { customName?: string | null; isNsfw?: boolean }) => {
      if (!activeSeries) return;
      setFolderError(null);
      try {
        await updateSeries(activeSeries.id, patch);
        await revalidateSeriesCache(activeSeries.id);
        await reloadSeries();
      } catch (err) {
        setFolderError(err instanceof Error ? err.message : "Failed to update folder");
        throw err;
      }
    },
    [activeSeries, reloadSeries],
  );

  const handleSeriesUploadCover = useCallback(
    async (file: File | undefined) => {
      if (!file || !activeSeries) return;
      setFolderError(null);
      setCoverBusy(true);
      try {
        await uploadSeriesCover(activeSeries.id, file);
        await revalidateSeriesCache(activeSeries.id);
        await reloadSeries();
      } catch (err) {
        setFolderError(err instanceof Error ? err.message : "Failed to upload cover");
      } finally {
        setCoverBusy(false);
      }
    },
    [activeSeries, reloadSeries],
  );

  const handleSeriesDeleteCover = useCallback(async () => {
    if (!activeSeries) return;
    setFolderError(null);
    setCoverBusy(true);
    try {
      await deleteSeriesCover(activeSeries.id);
      await revalidateSeriesCache(activeSeries.id);
      await reloadSeries();
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Failed to delete cover");
    } finally {
      setCoverBusy(false);
    }
  }, [activeSeries, reloadSeries]);

  const beginSeriesEdit = useCallback(() => {
    if (!activeSeries) return;
    setEditCustomName(activeSeries.customName ?? "");
    setEditIsNsfw(activeSeries.isNsfw);
    setEditDetails(activeSeries.details ?? "");
    setEditStudioName(activeSeries.studio?.name ?? activeSeries.studioName ?? "");
    setEditPerformerNames(
      activeSeries.performers ? activeSeries.performers.map((p) => p.name) : [],
    );
    setEditTagNames(
      activeSeries.tags ? activeSeries.tags.map((t) => t.name) : [],
    );
    setEditRating(activeSeries.rating);
    setEditDate(activeSeries.date ?? "");
    setFolderEditMode(true);
    // Fetch suggestion data for chip inputs
    void Promise.all([
      fetchStudios({ nsfw: nsfwMode }),
      fetchPerformers({ nsfw: nsfwMode, sort: "scenes", order: "desc", limit: 400 }),
      fetchTags({ nsfw: nsfwMode }),
    ]).then(([s, p, t]) => {
      setFolderEditStudios(s.studios);
      setFolderEditPerformers(p.performers);
      setFolderEditTags(t.tags);
    }).catch(() => {});
  }, [activeSeries, nsfwMode]);

  const cancelSeriesEdit = useCallback(() => {
    setFolderEditMode(false);
  }, []);

  const saveSeriesEdit = useCallback(async () => {
    if (!activeSeries) return;
    setFolderSaving(true);
    setFolderError(null);
    try {
      await updateSeries(activeSeries.id, {
        customName: editCustomName.trim() || null,
        isNsfw: editIsNsfw,
        details: editDetails.trim() || null,
        studioName: editStudioName.trim() || null,
        performerNames: editPerformerNames,
        tagNames: editTagNames,
        rating: editRating,
        date: editDate.trim() || null,
      });
      await revalidateSeriesCache(activeSeries.id);
      await reloadSeries();
      setFolderEditMode(false);
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Failed to update folder");
    } finally {
      setFolderSaving(false);
    }
  }, [activeSeries, editCustomName, editIsNsfw, editDetails, editStudioName, editPerformerNames, editTagNames, editRating, editDate, reloadSeries]);

  const handleSeriesUploadBackdrop = useCallback(
    async (file: File | undefined) => {
      if (!file || !activeSeries) return;
      setFolderError(null);
      setBackdropBusy(true);
      try {
        await uploadSeriesBackdrop(activeSeries.id, file);
        await revalidateSeriesCache(activeSeries.id);
        await reloadSeries();
      } catch (err) {
        setFolderError(err instanceof Error ? err.message : "Failed to upload backdrop");
      } finally {
        setBackdropBusy(false);
      }
    },
    [activeSeries, reloadSeries],
  );

  const handleSeriesDeleteBackdrop = useCallback(async () => {
    if (!activeSeries) return;
    setFolderError(null);
    setBackdropBusy(true);
    try {
      await deleteSeriesBackdrop(activeSeries.id);
      await revalidateSeriesCache(activeSeries.id);
      await reloadSeries();
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Failed to delete backdrop");
    } finally {
      setBackdropBusy(false);
    }
  }, [activeSeries, reloadSeries]);

  const filteredSeriesStudios = editStudioFocused
    ? (editStudioName.trim()
        ? seriesEditStudios.filter(
            (s) =>
              s.name.toLowerCase().includes(editStudioName.toLowerCase()) &&
              s.name.toLowerCase() !== editStudioName.toLowerCase()
          )
        : seriesEditStudios)
    : [];

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      void Promise.all([loadVideos(), loadSeriesContext()]);
    }, deferredSearchQuery ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [deferredSearchQuery, loadSeriesContext, loadVideos]);

  function removeFilter(index: number) {
    startTransition(() => {
      setActivePresetId(null);
      setActiveFilters((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
    });
  }

  function addFilter(type: string, label: string, value: string) {
    const exclusiveOnePerType = new Set([
      "ratingMin",
      "ratingMax",
      "dateFrom",
      "dateTo",
      "duration",
      "organized",
      "interactive",
      "hasFile",
      "played",
    ]);

    startTransition(() => {
      setActivePresetId(null);
      setActiveFilters((previous) => {
        if (exclusiveOnePerType.has(type)) {
          if (previous.some((filter) => filter.type === type && filter.value === value)) {
            return previous.filter((filter) => !(filter.type === type && filter.value === value));
          }
          return [...previous.filter((filter) => filter.type !== type), { type, label, value }];
        }

        // Multi-select types: toggle on/off
        if (previous.some((filter) => filter.type === type && filter.value === value)) {
          return previous.filter((filter) => !(filter.type === type && filter.value === value));
        }

        return [...previous, { type, label, value }];
      });
    });
  }

  function handleApplyPreset(preset: FilterPreset) {
    startTransition(() => {
      if (activePresetId === preset.id) {
        // Toggle off: clear filters back to defaults
        const d = defaultVideosListPrefs();
        setActiveFilters(d.activeFilters);
        setSortBy(d.sortBy);
        setSortDir(d.sortDir);
        setActivePresetId(null);
      } else {
        setActiveFilters(preset.filters);
        setSortBy(preset.sortBy);
        setSortDir(preset.sortDir);
        setActivePresetId(preset.id);
      }
    });
  }

  function handleSavePreset(name: string) {
    const newPreset: FilterPreset = {
      id: crypto.randomUUID(),
      name,
      filters: activeFilters,
      sortBy,
      sortDir,
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    savePresets(updated);
    setActivePresetId(newPreset.id);
  }

  function handleOverwritePreset(id: string) {
    const updated = presets.map((p) =>
      p.id === id ? { ...p, filters: activeFilters, sortBy, sortDir } : p,
    );
    setPresets(updated);
    savePresets(updated);
  }

  function handleDeletePreset(id: string) {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    savePresets(updated);
    if (activePresetId === id) setActivePresetId(null);
  }

  async function handleBulkNsfw(isNsfw: boolean) {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selection.selectedIds).map((id) => updateVideo(id, { isNsfw })),
      );
      selection.deselectAll();
      await loadVideos();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkDelete(deleteFile?: boolean) {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selection.selectedIds).map((id) => deleteVideo(id, deleteFile)),
      );
      selection.deselectAll();
      setDeleteDialogOpen(false);
      await loadVideos();
    } finally {
      setBulkLoading(false);
    }
  }

  const visibleIds = videos.map((s) => s.id);
  const seriesCards = useMemo(() => {
    if (!activeSeries) return rootSeries;
    if (!seriesSearch) return activeSeries.children;
    const lowered = seriesSearch.toLowerCase();
    return activeSeries.children.filter(
      (folder) =>
        folder.displayTitle.toLowerCase().includes(lowered) ||
        folder.title.toLowerCase().includes(lowered) ||
        folder.relativePath.toLowerCase().includes(lowered),
    );
  }, [activeSeries, seriesSearch, rootSeries]);

  /** Library label + on-disk folder titles (breadcrumb `title` values), for the folder hero. */
  const seriesHeroDiskPath = useMemo(() => {
    if (!activeSeries) return null;
    const root = activeSeries.libraryRootLabel?.trim();
    const crumbs = activeSeries.breadcrumbs.map((c) => c.title.trim()).filter(Boolean);
    const parts = [root, ...crumbs].filter((s): s is string => Boolean(s));
    if (parts.length === 0) return null;
    return parts.join(" > ");
  }, [activeSeries]);

  const seriesSectionTitle = activeSeries
    ? `Child ${terms.series.toLowerCase()}`
    : seriesSearch
      ? `Matching ${terms.series.toLowerCase()}`
      : terms.series;
  const videoSectionTitle = activeSeries
    ? hasFolderScopedSceneQuery
      ? `Matching ${terms.videos.toLowerCase()} in this ${terms.seriesSingular.toLowerCase()}`
      : `${terms.videos} in this ${terms.seriesSingular.toLowerCase()}`
    : terms.movies;

  const uploadTarget = activeSeries
    ? { kind: "video" as const, videoSeriesId: activeSeries.id }
    : { kind: "video" as const };

  return (
    <div className="relative space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Film className="h-5 w-5 text-text-accent" />
            {terms.videos}
          </h1>
          <p className="mt-1 text-[0.78rem] text-text-muted">
            Browse and manage your media library
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ImportButton
            target={uploadTarget}
            onUploaded={() => router.refresh()}
          />
        </div>
      </div>

      <FilterBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={(sort, dir) => {
          startTransition(() => {
            setSortBy(sort);
            if (dir) {
              setSortDir(dir);
            }
          });
        }}
        activeFilters={filterBarDisplayFilters}
        rawActiveFilters={activeFilters}
        onRemoveFilter={removeFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        availableStudios={filterStudios}
        availableTags={filterTags}
        availablePerformers={filterPerformers}
        onAddFilter={addFilter}
        onClearFiltersAndSort={handleClearFiltersAndSort}
        canClearFiltersAndSort={
          !isDefaultVideosListPrefs({
            viewMode,
            sortBy,
            sortDir,
            search: searchQuery,
            activeFilters,
          })
        }
        presets={presets}
        activePresetId={activePresetId}
        onApplyPreset={handleApplyPreset}
        onSavePreset={handleSavePreset}
        onOverwritePreset={handleOverwritePreset}
        onDeletePreset={handleDeletePreset}
      />

      {viewMode === "list" && !loading && videos.length > 0 && (
        <SelectAllHeader
          allSelected={selection.isAllSelected(visibleIds)}
          onToggle={() =>
            selection.isAllSelected(visibleIds)
              ? selection.deselectAll()
              : selection.selectAll(visibleIds)
          }
          selectedCount={selection.count}
          totalVisible={videos.length}
        />
      )}
      <UploadDropZone
        target={uploadTarget}
        onUploaded={() => router.refresh()}
      >
      {viewMode === "series" ? (
        activeSeries ? (
          <div className="space-y-5">
            {/* ── Breadcrumbs ──────────────────────────────────── */}
            <HierarchyBreadcrumbs
              items={[
                { id: "root", title: terms.videos, href: "/videos" },
                ...activeSeries.breadcrumbs.map((crumb) => ({
                  id: crumb.id,
                  title: crumb.displayTitle,
                  href: `/videos?series=${crumb.id}`,
                })),
              ]}
            />

            {/* ── Jellyfin-style Hero Header ─────────────────── */}
            <div className="relative min-h-[200px] sm:min-h-[280px] overflow-hidden border border-border-subtle">
              {/* Backdrop image or blurred poster fallback */}
              {toApiUrl(activeSeries.backdropImagePath, activeSeries.updatedAt) ? (
                <img
                  src={toApiUrl(activeSeries.backdropImagePath, activeSeries.updatedAt)!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : toApiUrl(activeSeries.coverImagePath, activeSeries.updatedAt) ? (
                <img
                  src={toApiUrl(activeSeries.coverImagePath, activeSeries.updatedAt)!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover blur-lg scale-110 opacity-50"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-black/60 to-black/30" />

              {/* Content overlay: poster + metadata */}
              <div className="relative flex min-h-[200px] sm:min-h-[280px] items-end gap-4 p-4 sm:gap-6 sm:p-6">
                {/* Folder edit / save — top-right of hero so it stays out of the bottom-aligned title block */}
                <div className="absolute right-6 top-6 z-10 flex items-center gap-1">
                  {seriesEditMode ? (
                    <>
                      <button
                        type="button"
                        onClick={cancelSeriesEdit}
                        disabled={seriesSaving}
                        className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveSeriesEdit()}
                        disabled={seriesSaving}
                        className="p-1.5 text-accent-400 hover:text-accent-300 hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        {seriesSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={beginSeriesEdit}
                      className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Poster — compact on mobile, full on desktop */}
                {toApiUrl(activeSeries.coverImagePath, activeSeries.updatedAt) && (
                  <div className="flex-shrink-0 w-[72px] sm:w-[160px]">
                    <img
                      src={toApiUrl(activeSeries.coverImagePath, activeSeries.updatedAt)!}
                      alt={activeSeries.displayTitle}
                      className="aspect-[2/3] w-full object-cover border border-white/10 shadow-lg"
                    />
                  </div>
                )}

                {/* Metadata */}
                <div className="flex-1 min-w-0">
                  {seriesHeroDiskPath ? (
                    <div className="mb-1 flex min-w-0 items-start gap-1.5 text-[0.68rem] text-white/50">
                      <HardDrive className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      <span className="min-w-0 break-words">{seriesHeroDiskPath}</span>
                    </div>
                  ) : null}

                  <div className="mt-1.5">
                    {seriesEditMode ? (
                      <div className="min-w-0 space-y-2.5">
                        {/* Hidden file inputs for image uploads */}
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            void handleSeriesUploadCover(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                        <input
                          ref={backdropInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            void handleSeriesUploadBackdrop(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />

                        {/* Display name */}
                        <div>
                          <input
                            value={editCustomName}
                            onChange={(e) => setEditCustomName(e.target.value)}
                            placeholder={activeSeries.title}
                            className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-xl font-heading font-semibold text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled"
                          />
                          <p className="text-[0.65rem] text-text-disabled mt-0.5">
                            Leave empty to use directory name
                          </p>
                        </div>

                        {/* Description */}
                        <textarea
                          value={editDetails}
                          onChange={(e) => setEditDetails(e.target.value)}
                          rows={2}
                          placeholder="Description..."
                          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-[0.82rem] text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled resize-y"
                        />

                        {/* Studio autocomplete + Date */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <input
                              value={editStudioName}
                              onChange={(e) => setEditStudioName(e.target.value)}
                              onFocus={() => setEditStudioFocused(true)}
                              onBlur={() => setTimeout(() => setEditStudioFocused(false), 150)}
                              placeholder="Studio name"
                              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-[0.82rem] text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled"
                            />
                            {filteredSeriesStudios.length > 0 && (
                              <div className="autocomplete-dropdown">
                                {filteredSeriesStudios.slice(0, 8).map((s) => (
                                  <div
                                    key={s.name}
                                    className="autocomplete-item"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setEditStudioName(s.name);
                                      setEditStudioFocused(false);
                                    }}
                                  >
                                    {s.name}
                                  </div>
                                ))}
                              </div>
                            )}
                            {editStudioName.trim() &&
                              !seriesEditStudios.some(
                                (s) => s.name.toLowerCase() === editStudioName.trim().toLowerCase()
                              ) && (
                                <span className="text-[0.6rem] text-info-text mt-0.5 block">
                                  New studio will be created
                                </span>
                              )}
                          </div>
                          <input
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            placeholder="Date (e.g. 2020 - Present)"
                            className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-[0.82rem] text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled"
                          />
                        </div>

                        {/* Performers chip input */}
                        <div>
                          <div className="text-[0.68rem] text-text-muted mb-1">{terms.performers}</div>
                          <ChipInput
                            values={editPerformerNames}
                            onChange={setEditPerformerNames}
                            suggestions={tagsVisibleInNsfwMode(seriesEditPerformers, nsfwMode).map((p) => ({
                              name: p.name,
                              count: p.videoCount,
                            }))}
                            placeholder={`Type to add ${terms.performers.toLowerCase()}...`}
                          />
                        </div>

                        {/* Tags chip input */}
                        <div>
                          <div className="text-[0.68rem] text-text-muted mb-1">Tags</div>
                          <ChipInput
                            values={editTagNames}
                            onChange={setEditTagNames}
                            suggestions={tagsVisibleInNsfwMode(seriesEditTags, nsfwMode).map((t) => ({
                              name: t.name,
                              count: t.videoCount,
                            }))}
                            placeholder="Type to add tags..."
                          />
                        </div>

                        {/* Rating + NSFW + Image upload buttons */}
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.68rem] text-text-muted">Rating</span>
                            <StarRatingPicker value={editRating} onChange={setEditRating} />
                          </div>
                          <div className="flex items-center gap-2">
                            <NsfwEditToggle value={editIsNsfw} onChange={setEditIsNsfw} />
                            {editIsNsfw && <span className="text-[0.68rem] text-text-muted">NSFW</span>}
                          </div>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              type="button"
                              disabled={coverBusy}
                              onClick={() => coverInputRef.current?.click()}
                              className="inline-flex items-center gap-1.5 px-2 py-1 text-[0.68rem] text-text-muted border border-border-subtle hover:border-border-accent hover:text-text-primary transition-colors disabled:opacity-50"
                            >
                              {coverBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                              Poster
                            </button>
                            {activeSeries.coverImagePath && (
                              <button
                                type="button"
                                disabled={coverBusy}
                                onClick={() => void handleSeriesDeleteCover()}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[0.68rem] text-text-muted border border-border-subtle hover:border-red-400/50 hover:text-red-200 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={backdropBusy}
                              onClick={() => backdropInputRef.current?.click()}
                              className="inline-flex items-center gap-1.5 px-2 py-1 text-[0.68rem] text-text-muted border border-border-subtle hover:border-border-accent hover:text-text-primary transition-colors disabled:opacity-50"
                            >
                              {backdropBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                              Backdrop
                            </button>
                            {activeSeries.backdropImagePath && (
                              <button
                                type="button"
                                disabled={backdropBusy}
                                onClick={() => void handleSeriesDeleteBackdrop()}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[0.68rem] text-text-muted border border-border-subtle hover:border-red-400/50 hover:text-red-200 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <h1 className="min-w-0 text-xl sm:text-3xl font-heading font-semibold text-white leading-tight">
                        {activeSeries.displayTitle}
                      </h1>
                    )}
                  </div>

                  {!seriesEditMode && (
                    <>
                      {/* Metadata row: studio, date, rating, scene count */}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.82rem] text-white/70">
                        {activeSeries.studioName && (
                          <span>{activeSeries.studioName}</span>
                        )}
                        {activeSeries.date && (
                          <span>{activeSeries.date}</span>
                        )}
                        {activeSeries.rating != null && (
                          <StarRatingPicker value={activeSeries.rating} readOnly />
                        )}
                        <span className="text-white/40">
                          {formatVideoCount(activeSeries.totalVideoCount)}
                        </span>
                        {activeSeries.childSeasonCount > 0 && (
                          <span className="text-white/40">
                            {activeSeries.childSeasonCount} child {activeSeries.childSeasonCount !== 1 ? terms.series.toLowerCase() : terms.seriesSingular.toLowerCase()}
                          </span>
                        )}
                        {activeSeries.isNsfw && <NsfwChip />}
                      </div>

                      {/* Identify (plugin-driven cascade review) */}
                      <div className="mt-3">
                        <IdentifyButton
                          entityKind="video_series"
                          entityId={activeSeries.id}
                          title={activeSeries.displayTitle}
                          label="Identify Series"
                        />
                      </div>

                      {/* Description */}
                      {activeSeries.details && (
                        <p className="mt-3 max-w-[700px] text-[0.82rem] leading-relaxed text-white/60 line-clamp-3">
                          {activeSeries.details}
                        </p>
                      )}

                      {/* Tags */}
                      {(() => {
                        const seriesTagsVisible = tagsVisibleInNsfwMode(
                          activeSeries.tags ?? [],
                          nsfwMode,
                        );
                        if (seriesTagsVisible.length === 0) return null;
                        return (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <span className="mr-1 self-center text-[0.72rem] text-white/40">Tags:</span>
                            {seriesTagsVisible.map((tag) => (
                              <Link
                                key={tag.id}
                                href={`/tags/${encodeURIComponent(tag.name)}`}
                                className="tag-chip tag-chip-default hover:tag-chip-accent cursor-pointer transition-colors"
                              >
                                <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
                              </Link>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Error banner ─────────────────────────────────── */}
            {seriesError && (
              <div className="surface-well border border-red-500/30 px-3 py-2 text-[0.78rem] text-red-200">
                {seriesError}
              </div>
            )}

            {/* ── Cast & Crew ─────────────────────────────────── */}
            {activeSeries.performers && activeSeries.performers.length > 0 && (
              <SeriesCastStrip performers={activeSeries.performers} />
            )}

            {/* ── Child series ──────────────────────────────────── */}
            {seriesCards.length > 0 && (
              <HierarchySection title={`Child ${terms.series.toLowerCase()}`}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {seriesCards.map((folder) => (
                    <SeriesCard
                      key={folder.id}
                      series={folder}
                      href={`/videos?series=${folder.id}`}
                      compact
                    />
                  ))}
                </div>
              </HierarchySection>
            )}

            {/* ── Seasons (Case B) ─────────────────────────────── */}
            {activeSeries.renderingMode === "seasons" &&
              activeSeries.seasons.length > 0 &&
              activeSeasonNumber === null && (
                <HierarchySection title="Seasons">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {activeSeries.seasons.map((season) => {
                      const label =
                        season.seasonNumber === 0
                          ? "Specials"
                          : `Season ${season.seasonNumber}`;
                      return (
                        <button
                          key={season.id}
                          type="button"
                          onClick={() =>
                            setActiveSeasonNumber(season.seasonNumber)
                          }
                          className="group surface-card overflow-hidden text-left transition-colors duration-fast hover:border-border-accent"
                        >
                          <div className="relative aspect-[2/3] bg-surface-2">
                            {season.posterPath || season.previewThumbnailPath ? (
                              <img
                                src={
                                  toApiUrl(
                                    season.posterPath ??
                                      season.previewThumbnailPath,
                                  ) ?? undefined
                                }
                                alt={label}
                                className="absolute inset-0 h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-text-disabled">
                                <FolderOpen className="h-8 w-8" />
                              </div>
                            )}
                          </div>
                          <div className="space-y-1 px-2.5 py-2">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-[0.82rem] font-medium text-text-primary">
                                {label}
                              </h3>
                            </div>
                            <div className="text-[0.68rem] text-text-muted">
                              {formatVideoCount(season.episodeCount)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </HierarchySection>
              )}

            {/* ── Videos ────────────────────────────────────────── */}
            {!showSeasonGrid && (
              <HierarchySection
                title={
                  activeSeasonNumber !== null
                    ? activeSeasonNumber === 0
                      ? "Specials"
                      : `Season ${activeSeasonNumber}`
                    : videoSectionTitle
                }
                action={
                  activeSeasonNumber !== null ? (
                    <button
                      type="button"
                      onClick={() => setActiveSeasonNumber(null)}
                      className="text-[0.68rem] text-text-accent hover:text-text-accent-bright"
                    >
                      ← All seasons
                    </button>
                  ) : null
                }
              >
                <VideoGrid
                  videos={videos}
                  viewMode="grid"
                  loading={loading}
                  hasMore={videos.length < total}
                  loadingMore={loadingMore}
                  onLoadMore={loadMore}
                  from={currentPath}
                />
              </HierarchySection>
            )}
          </div>
        ) : (
          <HierarchyShell
            title={
              <div>
                <h2 className="text-2xl font-semibold text-text-primary">
                  {terms.series}
                </h2>
                <p className="mt-1 text-[0.78rem] text-text-muted">
                  Browse {terms.series.toLowerCase()} and{" "}
                  {terms.movies.toLowerCase()} from disk, then
                  drill down into individual {terms.videos.toLowerCase()}.
                </p>
              </div>
            }
          >
            {seriesCards.length > 0 && (
              <HierarchySection title={seriesSectionTitle}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {seriesCards.map((folder) => (
                    <SeriesCard
                      key={folder.id}
                      series={folder}
                      href={`/videos?series=${folder.id}`}
                      compact
                    />
                  ))}
                </div>
              </HierarchySection>
            )}

            <HierarchySection title={videoSectionTitle}>
              <VideoGrid
                videos={videos}
                viewMode="grid"
                loading={loading}
                hasMore={videos.length < total}
                loadingMore={loadingMore}
                onLoadMore={loadMore}
                from={currentPath}
              />
            </HierarchySection>
          </HierarchyShell>
        )
      ) : (
        <>
          <VideoGrid
            videos={videos}
            viewMode={viewMode}
            loading={loading}
            hasMore={videos.length < total}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            selectedIds={viewMode === "list" ? selection.selectedIds : undefined}
            onToggleSelect={viewMode === "list" ? selection.toggle : undefined}
            from={currentPath}
          />

          <BulkActionToolbar
            selectedCount={selection.count}
            onDeselectAll={selection.deselectAll}
            onMarkNsfw={() => void handleBulkNsfw(true)}
            onUnmarkNsfw={() => void handleBulkNsfw(false)}
            onDelete={() => setDeleteDialogOpen(true)}
            loading={bulkLoading}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onClose={() => setDeleteDialogOpen(false)}
            entityType="video"
            count={selection.count}
            allowDeleteFromDisk
            onDeleteFromLibrary={() => void handleBulkDelete(false)}
            onDeleteFromDisk={() => void handleBulkDelete(true)}
            loading={bulkLoading}
          />
        </>
      )}
      </UploadDropZone>

      {stats ? (
        <footer className="mt-8 border-t border-border-subtle pt-6">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard
              icon={<Film className="h-4 w-4" />}
              label={`Total ${terms.videos}`}
              value={String(stats.totalScenes)}
              gradientClass={DASHBOARD_STAT_GRADIENTS[0]}
            />
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              label="Total Duration"
              value={stats.totalDurationFormatted}
              gradientClass={DASHBOARD_STAT_GRADIENTS[1]}
            />
            <StatCard
              icon={<HardDrive className="h-4 w-4" />}
              label="Storage"
              value={stats.totalSizeFormatted ?? "—"}
              gradientClass={DASHBOARD_STAT_GRADIENTS[2]}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="This Week"
              value={`+${stats.recentCount}`}
              accent
              gradientClass={DASHBOARD_STAT_GRADIENTS[3]}
            />
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function StatCard({
  accent,
  icon,
  label,
  value,
  gradientClass,
}: {
  accent?: boolean;
  icon: ReactNode;
  label: string;
  value: string;
  gradientClass: string;
}) {
  return (
    <div
      className={cn(
        "surface-panel relative overflow-hidden px-3 py-2.5 flex flex-col justify-between min-h-[72px]",
        accent && "border-border-accent shadow-[var(--shadow-glow-accent)]"
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] opacity-90",
          gradientClass
        )}
      />
      <div className="flex items-center justify-between ml-1.5">
        <span className="text-[0.6rem] font-semibold tracking-[0.15em] uppercase text-text-muted">
          {label}
        </span>
        <div className={cn("opacity-70", accent ? "text-text-accent" : "text-text-disabled")}>
          {icon}
        </div>
      </div>
      <div
        className={cn(
          "ml-1.5 mt-1 text-lg font-mono tracking-tight",
          accent ? "text-glow-accent" : "text-text-primary"
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Cast & Crew horizontal scroll strip ──────────────────── */

function SeriesCastStrip({
  performers,
}: {
  performers: {
    id: string;
    name: string;
    gender: string | null;
    imagePath: string | null;
    isNsfw: boolean;
  }[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -el.clientWidth * 0.6 : el.clientWidth * 0.6,
      behavior: "smooth",
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-kicker">Cast & Crew</h4>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll("left")}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
      >
        {performers.map((performer) => {
          const imgUrl = toApiUrl(performer.imagePath);
          return (
            <Link
              key={performer.id}
              href={`/performers/${performer.id}`}
              className="flex-shrink-0 w-[110px] group"
            >
              <div className="aspect-[3/4] w-full overflow-hidden border border-border-subtle bg-surface-2">
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={performer.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-disabled">
                    <User className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="mt-1.5 text-center">
                <div className="text-[0.72rem] text-text-primary truncate group-hover:text-text-accent transition-colors">
                  {performer.name}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
