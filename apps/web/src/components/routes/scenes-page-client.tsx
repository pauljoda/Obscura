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
import { SceneGrid } from "../scene-grid";
import { ImportButton, UploadDropZone } from "../upload";
import { FilterBar } from "../filter-bar";
import type { SortDir, SortOption, ViewMode } from "../filter-bar";
import {
  fetchScenes,
  fetchSceneStats,
  fetchSceneFolders,
  fetchSceneFolderDetail,
  fetchPerformers,
  fetchStudios,
  fetchTags,
  updateScene,
  deleteScene,
  toApiUrl,
  updateSceneFolder,
  uploadSceneFolderCover,
  deleteSceneFolderCover,
  uploadSceneFolderBackdrop,
  deleteSceneFolderBackdrop,
  type PerformerItem,
  type SceneFolderDetail,
  type SceneFolderListItem,
  type SceneListItem,
  type SceneStats,
  type StudioItem,
  type TagItem,
} from "../../lib/api";
import { revalidateSceneFolderCache } from "../../app/actions/revalidate-scene-folder";
import { InfoRow } from "../shared/metadata-panel";
import { NsfwChip, NsfwEditToggle, tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { ChipInput } from "../shared/chip-input";
import { StarRatingPicker } from "../shared/star-rating-picker";
import { EntityPreviewMedia } from "../shared/entity-preview-media";
import { SCENE_CARD_GRADIENTS } from "../scenes/scene-card-gradients";
import { useNsfw } from "../nsfw/nsfw-context";
import { useTerms } from "../../lib/terminology";
import { cn } from "@obscura/ui/lib/utils";
import { DASHBOARD_STAT_GRADIENTS } from "../dashboard/dashboard-utils";
import { useSelection } from "../../hooks/use-selection";
import { SelectAllHeader } from "../select-all-header";
import { BulkActionToolbar } from "../bulk-action-toolbar";
import { ConfirmDeleteDialog } from "../confirm-delete-dialog";
import type { ScenesListPrefs, ScenesListPrefsActiveFilter } from "../../lib/scenes-list-prefs";
import {
  defaultScenesListPrefs,
  isDefaultScenesListPrefs,
  scenesListPrefsToFetchParams,
  writeScenesListPrefsCookie,
  clearScenesListPrefsCookie,
} from "../../lib/scenes-list-prefs";
import {
  type FilterPreset,
  loadPresets,
  savePresets,
} from "../../lib/filter-presets";
import { SceneFolderCard } from "../scene-folders/scene-folder-card";
import { HierarchyBreadcrumbs } from "../shared/hierarchy-breadcrumbs";
import { HierarchySection } from "../shared/hierarchy-section";
import { HierarchyShell } from "../shared/hierarchy-shell";

interface ScenesPageClientProps {
  initialScenes: SceneListItem[];
  initialStats: SceneStats | null;
  initialStudios: StudioItem[];
  initialTags: TagItem[];
  initialPerformers: PerformerItem[];
  initialTotal: number;
  initialListPrefs: ScenesListPrefs;
  initialRootFolders: SceneFolderListItem[];
  initialActiveFolder: SceneFolderDetail | null;
}

export function ScenesPageClient({
  initialScenes,
  initialStats,
  initialStudios,
  initialTags,
  initialPerformers,
  initialTotal,
  initialListPrefs,
  initialRootFolders,
  initialActiveFolder,
}: ScenesPageClientProps) {
  const { mode: nsfwMode } = useNsfw();
  const terms = useTerms();
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    void fetchSceneStats(nsfwMode)
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
  const [sortBy, setSortBy] = useState<SortOption>(initialListPrefs.sortBy);
  const [sortDir, setSortDir] = useState<SortDir>(initialListPrefs.sortDir);
  const [searchQuery, setSearchQuery] = useState(initialListPrefs.search);
  const [activeFilters, setActiveFilters] = useState<ScenesListPrefsActiveFilter[]>(
    initialListPrefs.activeFilters,
  );
  const [scenes, setScenes] = useState(initialScenes);
  const [total, setTotal] = useState(initialTotal);
  const [filterStudios, setFilterStudios] = useState(initialStudios);
  const [filterTags, setFilterTags] = useState(initialTags);
  const [filterPerformers, setFilterPerformers] = useState(initialPerformers);
  const [rootFolders, setRootFolders] = useState(initialRootFolders);
  const [activeFolder, setActiveFolder] = useState<SceneFolderDetail | null>(initialActiveFolder);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [backdropBusy, setBackdropBusy] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderEditMode, setFolderEditMode] = useState(false);
  const [editCustomName, setEditCustomName] = useState("");
  const [editIsNsfw, setEditIsNsfw] = useState(false);
  const [editDetails, setEditDetails] = useState("");
  const [editStudioName, setEditStudioName] = useState("");
  const [editStudioFocused, setEditStudioFocused] = useState(false);
  const [editPerformerNames, setEditPerformerNames] = useState<string[]>([]);
  const [editTagNames, setEditTagNames] = useState<string[]>([]);
  const [editRating, setEditRating] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderEditStudios, setFolderEditStudios] = useState<StudioItem[]>([]);
  const [folderEditPerformers, setFolderEditPerformers] = useState<PerformerItem[]>([]);
  const [folderEditTags, setFolderEditTags] = useState<TagItem[]>([]);
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
    setRootFolders(initialRootFolders);
    setActiveFolder(initialActiveFolder);
  }, [initialRootFolders, initialActiveFolder]);

  useEffect(() => {
    const prefs: ScenesListPrefs = {
      viewMode,
      sortBy,
      sortDir,
      search: searchQuery,
      activeFilters,
      activePresetId: activePresetId ?? undefined,
    };
    if (isDefaultScenesListPrefs(prefs)) {
      clearScenesListPrefsCookie();
    } else {
      writeScenesListPrefsCookie(prefs);
    }
  }, [viewMode, sortBy, sortDir, searchQuery, activeFilters, activePresetId]);

  const handleClearFiltersAndSort = useCallback(() => {
    const d = defaultScenesListPrefs();
    setViewMode(d.viewMode);
    setSortBy(d.sortBy);
    setSortDir(d.sortDir);
    setSearchQuery(d.search);
    setActiveFilters(d.activeFilters);
  }, []);

  const buildParams = useCallback(() => {
    return scenesListPrefsToFetchParams(
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

  const folderSearch = deferredSearchQuery.trim() || undefined;
  const hasFolderScopedSceneQuery =
    Boolean(folderSearch) || activeFilters.length > 0;

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

  const loadScenes = useCallback(async () => {
    setLoading(true);

    try {
      const result = await fetchScenes(
        viewMode === "folders"
          ? {
              ...buildParams(),
              limit: 50,
              sceneFolderId: activeFolder?.id ?? undefined,
              folderScope:
                activeFolder?.id && hasFolderScopedSceneQuery ? "subtree" : "direct",
              uncategorized: !activeFolder?.id,
            }
          : {
              ...buildParams(),
              limit: 50,
            },
      );

      setScenes(result.scenes);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load scenes:", error);
    } finally {
      setLoading(false);
    }
  }, [activeFolder?.id, buildParams, hasFolderScopedSceneQuery, viewMode]);

  const loadMore = useCallback(async () => {
    if (loadingMore || scenes.length >= total) return;
    setLoadingMore(true);

    try {
      const result = await fetchScenes(
        viewMode === "folders"
          ? {
              ...buildParams(),
              limit: 50,
              offset: scenes.length,
              sceneFolderId: activeFolder?.id ?? undefined,
              folderScope:
                activeFolder?.id && hasFolderScopedSceneQuery ? "subtree" : "direct",
              uncategorized: !activeFolder?.id,
            }
          : {
              ...buildParams(),
              limit: 50,
              offset: scenes.length,
            },
      );

      setScenes((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const newItems = result.scenes.filter((s) => !existingIds.has(s.id));
        return [...prev, ...newItems];
      });
    } catch (error) {
      console.error("Failed to load more scenes:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [
    activeFolder?.id,
    buildParams,
    hasFolderScopedSceneQuery,
    loadingMore,
    scenes.length,
    total,
    viewMode,
  ]);

  const loadFolderContext = useCallback(async () => {
    if (viewMode !== "folders") return;

    if (activeFolder?.id) {
      try {
        const detail = await fetchSceneFolderDetail(activeFolder.id, {
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
      const result = await fetchSceneFolders({
        search: folderSearch,
        root: folderSearch ? "all" : undefined,
        limit: 200,
        nsfw: nsfwMode,
      });
      setRootFolders(result.items);
    } catch (error) {
      console.error("Failed to load scene folders:", error);
      setRootFolders([]);
    }
  }, [activeFolder?.id, folderSearch, nsfwMode, viewMode]);

  const reloadFolder = useCallback(async () => {
    if (!activeFolder?.id) return;
    const detail = await fetchSceneFolderDetail(activeFolder.id, { nsfw: nsfwMode });
    setActiveFolder(detail);
  }, [activeFolder?.id, nsfwMode]);

  const handleFolderSave = useCallback(
    async (patch: { customName?: string | null; isNsfw?: boolean }) => {
      if (!activeFolder) return;
      setFolderError(null);
      try {
        await updateSceneFolder(activeFolder.id, patch);
        await revalidateSceneFolderCache(activeFolder.id);
        await reloadFolder();
      } catch (err) {
        setFolderError(err instanceof Error ? err.message : "Failed to update folder");
        throw err;
      }
    },
    [activeFolder, reloadFolder],
  );

  const handleFolderUploadCover = useCallback(
    async (file: File | undefined) => {
      if (!file || !activeFolder) return;
      setFolderError(null);
      setCoverBusy(true);
      try {
        await uploadSceneFolderCover(activeFolder.id, file);
        await revalidateSceneFolderCache(activeFolder.id);
        await reloadFolder();
      } catch (err) {
        setFolderError(err instanceof Error ? err.message : "Failed to upload cover");
      } finally {
        setCoverBusy(false);
      }
    },
    [activeFolder, reloadFolder],
  );

  const handleFolderDeleteCover = useCallback(async () => {
    if (!activeFolder) return;
    setFolderError(null);
    setCoverBusy(true);
    try {
      await deleteSceneFolderCover(activeFolder.id);
      await revalidateSceneFolderCache(activeFolder.id);
      await reloadFolder();
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Failed to delete cover");
    } finally {
      setCoverBusy(false);
    }
  }, [activeFolder, reloadFolder]);

  const beginFolderEdit = useCallback(() => {
    if (!activeFolder) return;
    setEditCustomName(activeFolder.customName ?? "");
    setEditIsNsfw(activeFolder.isNsfw);
    setEditDetails(activeFolder.details ?? "");
    setEditStudioName(activeFolder.studio?.name ?? activeFolder.studioName ?? "");
    setEditPerformerNames(
      activeFolder.performers ? activeFolder.performers.map((p) => p.name) : [],
    );
    setEditTagNames(
      activeFolder.tags ? activeFolder.tags.map((t) => t.name) : [],
    );
    setEditRating(activeFolder.rating);
    setEditDate(activeFolder.date ?? "");
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
  }, [activeFolder, nsfwMode]);

  const cancelFolderEdit = useCallback(() => {
    setFolderEditMode(false);
  }, []);

  const saveFolderEdit = useCallback(async () => {
    if (!activeFolder) return;
    setFolderSaving(true);
    setFolderError(null);
    try {
      await updateSceneFolder(activeFolder.id, {
        customName: editCustomName.trim() || null,
        isNsfw: editIsNsfw,
        details: editDetails.trim() || null,
        studioName: editStudioName.trim() || null,
        performerNames: editPerformerNames,
        tagNames: editTagNames,
        rating: editRating,
        date: editDate.trim() || null,
      });
      await revalidateSceneFolderCache(activeFolder.id);
      await reloadFolder();
      setFolderEditMode(false);
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Failed to update folder");
    } finally {
      setFolderSaving(false);
    }
  }, [activeFolder, editCustomName, editIsNsfw, editDetails, editStudioName, editPerformerNames, editTagNames, editRating, editDate, reloadFolder]);

  const handleFolderUploadBackdrop = useCallback(
    async (file: File | undefined) => {
      if (!file || !activeFolder) return;
      setFolderError(null);
      setBackdropBusy(true);
      try {
        await uploadSceneFolderBackdrop(activeFolder.id, file);
        await revalidateSceneFolderCache(activeFolder.id);
        await reloadFolder();
      } catch (err) {
        setFolderError(err instanceof Error ? err.message : "Failed to upload backdrop");
      } finally {
        setBackdropBusy(false);
      }
    },
    [activeFolder, reloadFolder],
  );

  const handleFolderDeleteBackdrop = useCallback(async () => {
    if (!activeFolder) return;
    setFolderError(null);
    setBackdropBusy(true);
    try {
      await deleteSceneFolderBackdrop(activeFolder.id);
      await revalidateSceneFolderCache(activeFolder.id);
      await reloadFolder();
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Failed to delete backdrop");
    } finally {
      setBackdropBusy(false);
    }
  }, [activeFolder, reloadFolder]);

  const filteredFolderStudios = editStudioFocused
    ? (editStudioName.trim()
        ? folderEditStudios.filter(
            (s) =>
              s.name.toLowerCase().includes(editStudioName.toLowerCase()) &&
              s.name.toLowerCase() !== editStudioName.toLowerCase()
          )
        : folderEditStudios)
    : [];

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      void Promise.all([loadScenes(), loadFolderContext()]);
    }, deferredSearchQuery ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [deferredSearchQuery, loadFolderContext, loadScenes]);

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
        const d = defaultScenesListPrefs();
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
        Array.from(selection.selectedIds).map((id) => updateScene(id, { isNsfw })),
      );
      selection.deselectAll();
      await loadScenes();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkDelete(deleteFile?: boolean) {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selection.selectedIds).map((id) => deleteScene(id, deleteFile)),
      );
      selection.deselectAll();
      setDeleteDialogOpen(false);
      await loadScenes();
    } finally {
      setBulkLoading(false);
    }
  }

  const visibleIds = scenes.map((s) => s.id);
  const router = useRouter();
  const folderCards = useMemo(() => {
    if (!activeFolder) return rootFolders;
    if (!folderSearch) return activeFolder.children;
    const lowered = folderSearch.toLowerCase();
    return activeFolder.children.filter(
      (folder) =>
        folder.displayTitle.toLowerCase().includes(lowered) ||
        folder.title.toLowerCase().includes(lowered) ||
        folder.relativePath.toLowerCase().includes(lowered),
    );
  }, [activeFolder, folderSearch, rootFolders]);

  const folderSectionTitle = activeFolder
    ? "Child folders"
    : folderSearch
      ? "Matching folders"
      : "Folders";
  const sceneSectionTitle = activeFolder
    ? hasFolderScopedSceneQuery
      ? "Matching scenes in this folder tree"
      : "Scenes in this folder"
    : "Uncategorized scenes";

  return (
    <UploadDropZone
      target={{ kind: "scene" }}
      onUploaded={() => router.refresh()}
      className="relative space-y-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Film className="h-5 w-5 text-text-accent" />
            {terms.scenes}
          </h1>
          <p className="mt-1 text-[0.78rem] text-text-muted">
            Browse and manage your media library
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="mt-1 text-mono-sm text-text-disabled">
            {total}{" "}
            {total === 1
              ? terms.scene.toLowerCase()
              : terms.scenes.toLowerCase()}
          </span>
          <ImportButton
            target={{ kind: "scene" }}
            onUploaded={() => router.refresh()}
          />
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatCard
            icon={<Film className="h-4 w-4" />}
            label={`Total ${terms.scenes}`}
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
      ) : null}

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
          !isDefaultScenesListPrefs({
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

      {viewMode === "list" && !loading && scenes.length > 0 && (
        <SelectAllHeader
          allSelected={selection.isAllSelected(visibleIds)}
          onToggle={() =>
            selection.isAllSelected(visibleIds)
              ? selection.deselectAll()
              : selection.selectAll(visibleIds)
          }
          selectedCount={selection.count}
          totalVisible={scenes.length}
        />
      )}
      {viewMode === "folders" ? (
        activeFolder ? (
          <div className="space-y-5">
            {/* ── Breadcrumbs ──────────────────────────────────── */}
            <HierarchyBreadcrumbs
              items={[
                { id: "root", title: terms.scenes, href: "/scenes" },
                ...activeFolder.breadcrumbs.map((crumb) => ({
                  id: crumb.id,
                  title: crumb.displayTitle,
                  href: `/scenes?folder=${crumb.id}`,
                })),
              ]}
            />

            {/* ── Jellyfin-style Hero Header ─────────────────── */}
            <div className="relative min-h-[280px] overflow-hidden border border-border-subtle">
              {/* Backdrop image or blurred poster fallback */}
              {toApiUrl(activeFolder.backdropImagePath, activeFolder.updatedAt) ? (
                <img
                  src={toApiUrl(activeFolder.backdropImagePath, activeFolder.updatedAt)!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : toApiUrl(activeFolder.coverImagePath, activeFolder.updatedAt) ? (
                <img
                  src={toApiUrl(activeFolder.coverImagePath, activeFolder.updatedAt)!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-40"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-black/60 to-black/30" />

              {/* Content overlay: poster + metadata */}
              <div className="relative flex min-h-[280px] items-end gap-6 p-6">
                {/* Poster */}
                {toApiUrl(activeFolder.coverImagePath, activeFolder.updatedAt) && (
                  <div className="hidden sm:block flex-shrink-0 w-[160px]">
                    <img
                      src={toApiUrl(activeFolder.coverImagePath, activeFolder.updatedAt)!}
                      alt={activeFolder.displayTitle}
                      className="aspect-[2/3] w-full object-cover border border-white/10 shadow-lg"
                    />
                  </div>
                )}

                {/* Metadata */}
                <div className="flex-1 min-w-0">
                  {activeFolder.libraryRootLabel && (
                    <div className="flex items-center gap-1.5 text-[0.68rem] text-white/50 mb-1">
                      <HardDrive className="h-3 w-3" />
                      {activeFolder.libraryRootLabel}
                    </div>
                  )}
                  <div className="text-[0.72rem] uppercase tracking-[0.16em] text-white/60">
                    Scene folder
                  </div>

                  <div className="flex items-start justify-between gap-3 mt-1.5">
                    {folderEditMode ? (
                      <div className="flex-1 min-w-0 space-y-2.5">
                        {/* Hidden file inputs for image uploads */}
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            void handleFolderUploadCover(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                        <input
                          ref={backdropInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            void handleFolderUploadBackdrop(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />

                        {/* Display name */}
                        <div>
                          <input
                            value={editCustomName}
                            onChange={(e) => setEditCustomName(e.target.value)}
                            placeholder={activeFolder.title}
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
                            {filteredFolderStudios.length > 0 && (
                              <div className="autocomplete-dropdown">
                                {filteredFolderStudios.slice(0, 8).map((s) => (
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
                              !folderEditStudios.some(
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
                            suggestions={tagsVisibleInNsfwMode(folderEditPerformers, nsfwMode).map((p) => ({
                              name: p.name,
                              count: p.sceneCount,
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
                            suggestions={tagsVisibleInNsfwMode(folderEditTags, nsfwMode).map((t) => ({
                              name: t.name,
                              count: t.sceneCount,
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
                            {activeFolder.coverImagePath && (
                              <button
                                type="button"
                                disabled={coverBusy}
                                onClick={() => void handleFolderDeleteCover()}
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
                            {activeFolder.backdropImagePath && (
                              <button
                                type="button"
                                disabled={backdropBusy}
                                onClick={() => void handleFolderDeleteBackdrop()}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[0.68rem] text-text-muted border border-border-subtle hover:border-red-400/50 hover:text-red-200 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <h1 className="flex-1 min-w-0 text-3xl font-heading font-semibold text-white leading-tight">
                        {activeFolder.displayTitle}
                      </h1>
                    )}
                    <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                      {folderEditMode ? (
                        <>
                          <button
                            type="button"
                            onClick={cancelFolderEdit}
                            disabled={folderSaving}
                            className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveFolderEdit()}
                            disabled={folderSaving}
                            className="p-1.5 text-accent-400 hover:text-accent-300 hover:bg-white/10 transition-colors disabled:opacity-50"
                          >
                            {folderSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={beginFolderEdit}
                          className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {!folderEditMode && (
                    <>
                      {activeFolder.customName && (
                        <p className="mt-0.5 text-[0.78rem] text-white/40">{activeFolder.title}</p>
                      )}
                      {/* Metadata row: studio, date, rating, scene count */}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.82rem] text-white/70">
                        {activeFolder.studioName && (
                          <span>{activeFolder.studioName}</span>
                        )}
                        {activeFolder.date && (
                          <span>{activeFolder.date}</span>
                        )}
                        {activeFolder.rating != null && (
                          <StarRatingPicker value={activeFolder.rating} readOnly />
                        )}
                        <span className="text-white/40">
                          {activeFolder.totalSceneCount} scene{activeFolder.totalSceneCount !== 1 ? "s" : ""}
                        </span>
                        {activeFolder.childFolderCount > 0 && (
                          <span className="text-white/40">
                            {activeFolder.childFolderCount} subfolder{activeFolder.childFolderCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {activeFolder.isNsfw && <NsfwChip />}
                      </div>

                      {/* Description */}
                      {activeFolder.details && (
                        <p className="mt-3 max-w-[700px] text-[0.82rem] leading-relaxed text-white/60 line-clamp-3">
                          {activeFolder.details}
                        </p>
                      )}

                      {/* Tags */}
                      {activeFolder.tags && activeFolder.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="text-[0.72rem] text-white/40 mr-1 self-center">Tags:</span>
                          {activeFolder.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="text-[0.72rem] text-white/60"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Error banner ─────────────────────────────────── */}
            {folderError && (
              <div className="surface-well border border-red-500/30 px-3 py-2 text-[0.78rem] text-red-200">
                {folderError}
              </div>
            )}

            {/* ── Cast & Crew ─────────────────────────────────── */}
            {activeFolder.performers && activeFolder.performers.length > 0 && (
              <FolderCastStrip performers={activeFolder.performers} />
            )}

            {/* ── Subfolders ───────────────────────────────────── */}
            {folderCards.length > 0 && (
              <HierarchySection title="Subfolders">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {folderCards.map((folder) => (
                    <SceneFolderCard
                      key={folder.id}
                      folder={folder}
                      href={`/scenes?folder=${folder.id}`}
                      compact
                    />
                  ))}
                </div>
              </HierarchySection>
            )}

            {/* ── Scenes ───────────────────────────────────────── */}
            <HierarchySection title={sceneSectionTitle}>
              <SceneGrid
                scenes={scenes}
                viewMode="grid"
                loading={loading}
                hasMore={scenes.length < total}
                loadingMore={loadingMore}
                onLoadMore={loadMore}
              />
            </HierarchySection>
          </div>
        ) : (
          <HierarchyShell
            title={
              <div>
                <h2 className="text-2xl font-semibold text-text-primary">Scene folders</h2>
                <p className="mt-1 text-[0.78rem] text-text-muted">
                  Browse folders from disk, then drill down into scenes.
                </p>
              </div>
            }
          >
            {folderCards.length > 0 && (
              <HierarchySection title={folderSectionTitle}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {folderCards.map((folder) => (
                    <SceneFolderCard
                      key={folder.id}
                      folder={folder}
                      href={`/scenes?folder=${folder.id}`}
                      compact
                    />
                  ))}
                </div>
              </HierarchySection>
            )}

            <HierarchySection title={sceneSectionTitle}>
              <SceneGrid
                scenes={scenes}
                viewMode="grid"
                loading={loading}
                hasMore={scenes.length < total}
                loadingMore={loadingMore}
                onLoadMore={loadMore}
              />
            </HierarchySection>
          </HierarchyShell>
        )
      ) : (
        <>
          <SceneGrid
            scenes={scenes}
            viewMode={viewMode}
            loading={loading}
            hasMore={scenes.length < total}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            selectedIds={viewMode === "list" ? selection.selectedIds : undefined}
            onToggleSelect={viewMode === "list" ? selection.toggle : undefined}
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
            entityType="scene"
            count={selection.count}
            allowDeleteFromDisk
            onDeleteFromLibrary={() => void handleBulkDelete(false)}
            onDeleteFromDisk={() => void handleBulkDelete(true)}
            loading={bulkLoading}
          />
        </>
      )}
    </UploadDropZone>
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

function FolderCastStrip({
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
