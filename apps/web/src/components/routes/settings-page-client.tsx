"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import {
  Captions,
  Database,
  Eye,
  EyeOff,
  Film,
  FolderOpen,
  HardDrive,
  Image,
  Loader2,
  Package,
  Pencil,
  Plus,
  Minus,
  RefreshCw,
  Save,
  ScanSearch,
  Settings,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ToggleLeft,
  ToggleRight,
  X,
  Check,
  AlertCircle,
  Wrench,
  Shield,
  Droplet,
  Flame,
  Music,
  Clock,
} from "lucide-react";
import {
  BACKGROUND_WORKER_CONCURRENCY_MAX,
  BACKGROUND_WORKER_CONCURRENCY_MIN,
  defaultSubtitleAppearance,
  subtitleDisplayStyles,
  type SubtitleAppearance,
  type SubtitleDisplayStyle,
} from "@obscura/contracts";
import { SubtitleCaptionOverlay } from "../subtitle-caption-overlay";
import { useNsfw } from "../nsfw/nsfw-context";
import { entityTerms } from "../../lib/terminology";
import { NsfwGate } from "../nsfw/nsfw-gate";
import {
  browseLibraryPath,
  createLibraryRoot,
  createStashBoxEndpoint,
  deleteLibraryRoot,
  deleteStashBoxEndpoint,
  fetchInstalledScrapers,
  fetchLibraryConfig,
  fetchStashBoxEndpoints,
  migrateSceneAssetStorage,
  rebuildPreviews,
  runQueue,
  testStashBoxEndpoint,
  updateLibraryRoot,
  updateLibrarySettings,
  updateStashBoxEndpoint,
  type LibraryBrowse,
  type LibraryRoot,
  type LibrarySettings,
  type StashBoxEndpoint,
  type StorageStats,
} from "../../lib/api";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatTimestamp(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

const settingsKeys = [
  "autoScanEnabled",
  "scanIntervalMinutes",
  "autoGenerateMetadata",
  "autoGenerateFingerprints",
  "autoGeneratePreview",
  "generateTrickplay",
  "trickplayIntervalSeconds",
  "previewClipDurationSeconds",
  "thumbnailQuality",
  "trickplayQuality",
  "backgroundWorkerConcurrency",
] as const;

function normalizeSettings(s: LibrarySettings): LibrarySettings {
  return {
    ...s,
    thumbnailQuality: s.thumbnailQuality ?? 2,
    trickplayQuality: s.trickplayQuality ?? 2,
    backgroundWorkerConcurrency: s.backgroundWorkerConcurrency ?? 1,
    metadataStorageDedicated: s.metadataStorageDedicated ?? true,
    subtitlesAutoEnable: s.subtitlesAutoEnable ?? false,
    subtitlesPreferredLanguages:
      s.subtitlesPreferredLanguages ?? "en,eng",
    subtitleStyle: (s.subtitleStyle ?? "stylized") as SubtitleDisplayStyle,
    subtitleFontScale: s.subtitleFontScale ?? 1,
    subtitlePositionPercent: s.subtitlePositionPercent ?? 88,
  };
}

interface SettingsPageClientProps {
  initialRoots: LibraryRoot[];
  initialScraperCount: number;
  initialSettings: LibrarySettings;
  initialStorage: StorageStats | null;
  initialStashBoxEndpoints: StashBoxEndpoint[];
}

export function SettingsPageClient({
  initialRoots,
  initialScraperCount,
  initialSettings,
  initialStorage,
  initialStashBoxEndpoints,
}: SettingsPageClientProps) {
  const [settings, setSettings] = useState(() => normalizeSettings(initialSettings));
  const [roots, setRoots] = useState(initialRoots);
  const [storage, setStorage] = useState<StorageStats | null>(initialStorage);
  const [browser, setBrowser] = useState<LibraryBrowse | null>(null);
  const [browserVisible, setBrowserVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingRoot, setAddingRoot] = useState(false);
  const [newRootPath, setNewRootPath] = useState("");
  const [newRootLabel, setNewRootLabel] = useState("");
  const [newRootRecursive, setNewRootRecursive] = useState(true);
  const [newRootScanVideos, setNewRootScanVideos] = useState(true);
  const [newRootScanImages, setNewRootScanImages] = useState(true);
  const [newRootScanAudio, setNewRootScanAudio] = useState(true);
  const [newRootIsNsfw, setNewRootIsNsfw] = useState(false);
  const { mode: nsfwMode, setMode: setNsfwMode } = useNsfw();
  /** In SFW mode (Off), do not list NSFW-marked roots — same visibility as the rest of the app. */
  const rootsVisibleInSettings = useMemo(() => {
    if (nsfwMode === "off") return roots.filter((r) => !r.isNsfw);
    return roots;
  }, [roots, nsfwMode]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scraperCount, setScraperCount] = useState(initialScraperCount);

  // StashBox state
  const [stashBoxEndpoints, setStashBoxEndpoints] = useState<StashBoxEndpoint[]>(initialStashBoxEndpoints);
  const [showStashBoxForm, setShowStashBoxForm] = useState(false);
  const [editingStashBox, setEditingStashBox] = useState<StashBoxEndpoint | null>(null);
  const [sbName, setSbName] = useState("");
  const [sbEndpoint, setSbEndpoint] = useState("");
  const [sbApiKey, setSbApiKey] = useState("");
  const [sbSaving, setSbSaving] = useState(false);
  const [sbTesting, setSbTesting] = useState<string | null>(null);
  const [sbTestResult, setSbTestResult] = useState<{ id: string; valid: boolean; error?: string } | null>(null);
  const [metadataStorageDialogOpen, setMetadataStorageDialogOpen] = useState(false);
  const [metadataStorageBusy, setMetadataStorageBusy] = useState(false);

  const savedSettings = useRef(normalizeSettings(initialSettings));
  const isDirty = settingsKeys.some((key) => settings[key] !== savedSettings.current[key]);

  async function loadConfig() {
    setLoading(true);
    setError(null);

    try {
      const [response, scrapersResponse] = await Promise.all([
        fetchLibraryConfig(),
        fetchInstalledScrapers(),
      ]);

      const normalized = normalizeSettings(response.settings);
      setSettings(normalized);
      savedSettings.current = normalized;
      setRoots(response.roots);
      setStorage(response.storage);
      setScraperCount(scrapersResponse.packages.length);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function openBrowser(targetPath?: string) {
    try {
      const response = await browseLibraryPath(targetPath);
      setBrowser(response);
      setBrowserVisible(true);
      setNewRootPath(response.path);
    } catch (browseError) {
      setError(browseError instanceof Error ? browseError.message : "Failed to browse folders");
    }
  }

  /** Auto-save a single setting immediately (for toggles). */
  async function autoSaveSetting(patch: Partial<LibrarySettings>) {
    try {
      const updated = await updateLibrarySettings({ ...settings, ...patch });
      const normalized = normalizeSettings(updated);
      setSettings(normalized);
      savedSettings.current = normalized;
      setMessage("Setting saved.");
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save setting");
    }
  }

  async function handleSaveSettings() {
    setSaving(true);
    setError(null);

    try {
      const updated = await updateLibrarySettings({
        autoScanEnabled: settings.autoScanEnabled,
        scanIntervalMinutes: settings.scanIntervalMinutes,
        autoGenerateMetadata: settings.autoGenerateMetadata,
        autoGenerateFingerprints: settings.autoGenerateFingerprints,
        autoGeneratePreview: settings.autoGeneratePreview,
        generateTrickplay: settings.generateTrickplay,
        trickplayIntervalSeconds: settings.trickplayIntervalSeconds,
        previewClipDurationSeconds: settings.previewClipDurationSeconds,
        thumbnailQuality: settings.thumbnailQuality,
        trickplayQuality: settings.trickplayQuality,
        backgroundWorkerConcurrency: settings.backgroundWorkerConcurrency,
        metadataStorageDedicated: settings.metadataStorageDedicated,
      });

      const normalized = normalizeSettings(updated);
      setSettings(normalized);
      savedSettings.current = normalized;
      setMessage("Library settings saved.");
      await loadConfig();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRoot() {
    if (!newRootPath.trim()) {
      setError("Choose a folder before adding a library root.");
      return;
    }

    setAddingRoot(true);
    setError(null);

    try {
      await createLibraryRoot({
        path: newRootPath,
        label: newRootLabel || undefined,
        recursive: newRootRecursive,
        scanVideos: newRootScanVideos,
        scanImages: newRootScanImages,
        scanAudio: newRootScanAudio,
        isNsfw: newRootIsNsfw,
      });

      setMessage("Library root added.");
      setNewRootPath("");
      setNewRootLabel("");
      setNewRootIsNsfw(false);
      setBrowserVisible(false);
      await loadConfig();
      await runQueue("library-scan", nsfwMode);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Failed to add library root");
    } finally {
      setAddingRoot(false);
    }
  }

  async function handleToggleRoot(root: LibraryRoot) {
    const next = !root.enabled;
    setRoots((prev) => prev.map((r) => (r.id === root.id ? { ...r, enabled: next } : r)));
    try {
      await updateLibraryRoot(root.id, { enabled: next });
    } catch (toggleError) {
      setRoots((prev) => prev.map((r) => (r.id === root.id ? { ...r, enabled: !next } : r)));
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update root");
    }
  }

  async function handleToggleMediaType(root: LibraryRoot, field: "scanVideos" | "scanImages" | "scanAudio") {
    const next = !root[field];
    setRoots((prev) => prev.map((r) => (r.id === root.id ? { ...r, [field]: next } : r)));
    try {
      await updateLibraryRoot(root.id, { [field]: next });
    } catch (toggleError) {
      setRoots((prev) => prev.map((r) => (r.id === root.id ? { ...r, [field]: !next } : r)));
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update root");
    }
  }

  async function handleDeleteRoot(root: LibraryRoot) {
    try {
      await deleteLibraryRoot(root.id);
      setMessage(`Removed ${root.label}.`);
      await loadConfig();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to remove root");
    }
  }

  async function handleRunScan() {
    try {
      const response = await runQueue("library-scan", nsfwMode);
      if (response.enqueued === 0 && response.skipped === 0) {
        setMessage("Stale library references cleared. Add a watched folder to scan new files.");
      } else if (response.enqueued === 0 && response.skipped > 0) {
        setMessage("Stale references cleared; every library scan is already queued or running.");
      } else {
        setMessage(`Queued ${response.enqueued} library scan job${response.enqueued === 1 ? "" : "s"}.`);
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to queue scan");
    }
  }

  const revertMetadataStorageToggle = () => {
    setSettings((current) => ({
      ...current,
      metadataStorageDedicated: savedSettings.current.metadataStorageDedicated,
    }));
  };

  const handleMetadataStorageToggle = (checked: boolean) => {
    if (checked === savedSettings.current.metadataStorageDedicated) return;
    setSettings((current) => ({ ...current, metadataStorageDedicated: checked }));
    setMetadataStorageDialogOpen(true);
  };

  const closeMetadataStorageDialogCancel = () => {
    setMetadataStorageDialogOpen(false);
    revertMetadataStorageToggle();
  };

  async function confirmMetadataStorageLeaveInPlace() {
    setMetadataStorageBusy(true);
    setError(null);
    try {
      const updated = await updateLibrarySettings({
        ...settings,
        metadataStorageDedicated: settings.metadataStorageDedicated,
      });
      const normalized = normalizeSettings(updated);
      setSettings(normalized);
      savedSettings.current = normalized;
      setMetadataStorageDialogOpen(false);
      setMessage("Setting saved.");
      setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save setting");
      closeMetadataStorageDialogCancel();
    } finally {
      setMetadataStorageBusy(false);
    }
  }

  async function confirmMetadataStorageMoveFiles() {
    setMetadataStorageBusy(true);
    setError(null);
    const targetDedicated = settings.metadataStorageDedicated;
    try {
      const updated = await updateLibrarySettings({
        ...settings,
        metadataStorageDedicated: targetDedicated,
      });
      const normalized = normalizeSettings(updated);
      setSettings(normalized);
      savedSettings.current = normalized;
      await migrateSceneAssetStorage(targetDedicated, nsfwMode);
      setMetadataStorageDialogOpen(false);
      setMessage(
        "Setting saved. Moving files in the background — open Jobs to watch progress.",
      );
      setTimeout(() => setMessage(null), 6000);
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Failed to save or queue file move";
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        /* keep msg */
      }
      setError(msg);
      closeMetadataStorageDialogCancel();
    } finally {
      setMetadataStorageBusy(false);
    }
  }

  useEffect(() => {
    if (!metadataStorageDialogOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !metadataStorageBusy) {
        setMetadataStorageDialogOpen(false);
        setSettings((current) => ({
          ...current,
          metadataStorageDedicated: savedSettings.current.metadataStorageDedicated,
        }));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [metadataStorageDialogOpen, metadataStorageBusy]);

  const totalBytes = storage?.totalBytes ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Settings className="h-5 w-5 text-text-accent" />
            Settings
          </h1>
          <p className="mt-1 text-[0.78rem] text-text-muted">
            Configure libraries, generation pipeline, and scrapers
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void loadConfig()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted transition-all duration-fast hover:bg-surface-3/60 hover:text-text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <button
            onClick={() => void handleRunScan()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted transition-all duration-fast hover:bg-surface-3/60 hover:text-text-primary"
          >
            <ScanSearch className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Run Scan</span>
          </button>
          <button
            onClick={() => void handleSaveSettings()}
            disabled={saving || !isDirty}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium transition-all duration-normal",
              isDirty
                ? "border border-border-accent bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900 text-accent-200 shadow-[var(--shadow-glow-accent)] hover:border-border-accent-strong hover:shadow-[var(--shadow-glow-accent-strong)]"
                : "cursor-not-allowed border border-border-subtle bg-surface-3 text-text-disabled",
              "disabled:opacity-60",
            )}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="surface-card no-lift border-l-2 border-status-error px-3 py-2 text-sm text-status-error-text">
          {error}
        </div>
      ) : null}
      {message && !error ? (
        <div className="surface-card no-lift border-l-2 border-status-success px-3 py-2 text-sm text-status-success-text">
          {message}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="h-4 w-4 text-text-accent" />
            <div>
              <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Watched Libraries</h2>
              <p className="text-[0.68rem] text-text-muted">
                Add mounted folders to scan for media files
              </p>
            </div>
          </div>
          <button
            onClick={() => void openBrowser(browser?.path)}
            className={cn(
              "surface-card no-lift flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-muted transition-all duration-fast hover:border-border-accent hover:text-text-accent",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Browse Folder
          </button>
        </div>

        {browserVisible ? (
          <div className="surface-card no-lift space-y-4 border-border-accent/30 p-4">
            <div className="bg-black/20 p-3 rounded-sm border border-border-subtle">
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => void openBrowser(browser?.parentPath ?? browser?.path)}
                  disabled={!browser?.parentPath}
                  className="flex items-center gap-1 flex-shrink-0 px-2.5 py-1.5 text-xs font-medium text-text-muted transition-all hover:bg-surface-3 hover:text-text-primary disabled:opacity-40 rounded-sm border border-border-subtle"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Up
                </button>
                <div className="flex-1 overflow-x-auto scrollbar-hidden bg-surface-1 border border-border-subtle px-3 py-1.5 rounded-sm">
                  <span className="whitespace-nowrap text-mono-sm text-text-accent">
                    {browser?.path ?? "Loading..."}
                  </span>
                </div>
              </div>
              <div className="scrollbar-hidden grid max-h-[260px] gap-1.5 overflow-y-auto md:grid-cols-2">
                {browser?.directories.map((directory) => (
                  <button
                    key={directory.path}
                    type="button"
                    className="surface-card px-3 py-2 text-left flex items-center gap-3 group hover:border-border-accent/50 transition-colors"
                    onClick={() => void openBrowser(directory.path)}
                  >
                    <FolderOpen className="h-4 w-4 text-text-disabled group-hover:text-text-accent transition-colors flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8rem] font-medium group-hover:text-text-primary transition-colors">{directory.name}</p>
                    </div>
                  </button>
                ))}
                {browser && browser.directories.length === 0 ? (
                  <p className="col-span-full py-6 text-center text-xs text-text-disabled bg-surface-1/50 rounded-sm border border-border-subtle border-dashed">
                    No child directories found.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="control-label">Label (optional)</label>
                <input
                  className="control-input w-full max-w-md py-1.5 text-sm"
                  value={newRootLabel}
                  onChange={(event) => setNewRootLabel(event.target.value)}
                  placeholder={`Primary ${entityTerms.scenes.toLowerCase()}`}
                />
              </div>

              <div className="space-y-2">
                <label className="control-label">Library Options</label>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  <ToggleCard
                    label="Recursive"
                    description="Scan all subfolders"
                    checked={newRootRecursive}
                    onChange={setNewRootRecursive}
                  />
                  <ToggleCard
                    label="Videos"
                    description="Scan video files"
                    checked={newRootScanVideos}
                    onChange={setNewRootScanVideos}
                  />
                  <ToggleCard
                    label="Images"
                    description="Scan image files"
                    checked={newRootScanImages}
                    onChange={setNewRootScanImages}
                  />
                  <ToggleCard
                    label="Audio"
                    description="Scan audio files"
                    checked={newRootScanAudio}
                    onChange={setNewRootScanAudio}
                  />
                  <ToggleCard
                    label="NSFW"
                    description="Mark content as adult"
                    checked={newRootIsNsfw}
                    onChange={setNewRootIsNsfw}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => void handleAddRoot()}
                  disabled={addingRoot || !newRootPath}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all duration-normal",
                    "border border-border-accent bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900 text-accent-200 shadow-[var(--shadow-glow-accent)]",
                    "hover:shadow-[var(--shadow-glow-accent-strong)] disabled:opacity-50 rounded-sm",
                  )}
                >
                  {addingRoot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {addingRoot ? "Adding..." : "Add Library"}
                </button>
                <button
                  onClick={() => {
                    setBrowserVisible(false);
                    setNewRootPath("");
                    setNewRootLabel("");
                  }}
                  className="px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:text-text-primary hover:bg-surface-2 rounded-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="surface-card no-lift flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-text-disabled" />
          </div>
        ) : roots.length === 0 ? (
          <div className="surface-card no-lift p-8 text-center">
            <FolderOpen className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
            <p className="text-sm text-text-muted">
              No library roots configured. Browse to a mounted folder to begin.
            </p>
          </div>
        ) : rootsVisibleInSettings.length === 0 ? (
          <div className="surface-card no-lift p-8 text-center">
            <FolderOpen className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
            <p className="text-sm text-text-muted">No library roots to display.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rootsVisibleInSettings.map((root) => (
              <div
                key={root.id}
                className={cn(
                  "surface-card no-lift flex flex-col gap-3 p-4 transition-opacity duration-fast",
                  !root.enabled && "opacity-50",
                )}
              >
                {/* Top Row: Info & Primary Actions */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className={cn("led mt-1.5 flex-shrink-0", root.enabled ? "led-active" : "led-idle")} />
                    <div className="min-w-0">
                      <h3 className="text-[0.85rem] font-semibold text-text-primary truncate">{root.label}</h3>
                      <p className="mt-1.5 truncate text-mono-sm text-text-disabled bg-surface-1/50 border border-border-subtle px-2 py-0.5 inline-block max-w-full shadow-sm">
                        {root.path}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => void handleToggleRoot(root)}
                      className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
                      title={root.enabled ? "Disable Library" : "Enable Library"}
                    >
                      {root.enabled ? (
                        <ToggleRight className="h-4 w-4 text-text-accent" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => void handleDeleteRoot(root)}
                      className="p-1.5 text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors"
                      title="Remove Library"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Configuration Toggles & Meta */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-subtle/50">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.65rem] font-medium text-text-muted uppercase tracking-wider mr-1 hidden sm:inline-block">Scans:</span>
                    
                    <button
                      onClick={() => void handleToggleMediaType(root, "scanVideos")}
                      title={root.scanVideos ? "Videos: scanning" : "Videos: skipped"}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 text-[0.68rem] font-medium border transition-all duration-fast",
                        root.scanVideos
                          ? "bg-accent-950/30 border-border-accent text-text-accent shadow-[var(--shadow-glow-accent)]"
                          : "bg-surface-1 border-border-subtle text-text-disabled hover:text-text-muted hover:border-border-default"
                      )}
                    >
                      <Film className="h-3.5 w-3.5" />
                      Video
                    </button>
                    
                    <button
                      onClick={() => void handleToggleMediaType(root, "scanImages")}
                      title={root.scanImages ? "Images: scanning" : "Images: skipped"}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 text-[0.68rem] font-medium border transition-all duration-fast",
                        root.scanImages
                          ? "bg-accent-950/30 border-border-accent text-text-accent shadow-[var(--shadow-glow-accent)]"
                          : "bg-surface-1 border-border-subtle text-text-disabled hover:text-text-muted hover:border-border-default"
                      )}
                    >
                      <Image className="h-3.5 w-3.5" />
                      Image
                    </button>

                    <button
                      onClick={() => void handleToggleMediaType(root, "scanAudio")}
                      title={root.scanAudio ? "Audio: scanning" : "Audio: skipped"}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 text-[0.68rem] font-medium border transition-all duration-fast",
                        root.scanAudio
                          ? "bg-accent-950/30 border-border-accent text-text-accent shadow-[var(--shadow-glow-accent)]"
                          : "bg-surface-1 border-border-subtle text-text-disabled hover:text-text-muted hover:border-border-default"
                      )}
                    >
                      <Music className="h-3.5 w-3.5" />
                      Audio
                    </button>

                    <div className="w-px h-4 bg-border-subtle mx-1 hidden sm:block" />

                    <button
                      onClick={async () => {
                        const next = !root.isNsfw;
                        setRoots((prev) => prev.map((r) => (r.id === root.id ? { ...r, isNsfw: next } : r)));
                        try {
                          await updateLibraryRoot(root.id, { isNsfw: next });
                        } catch {
                          setRoots((prev) => prev.map((r) => (r.id === root.id ? { ...r, isNsfw: !next } : r)));
                        }
                      }}
                      title={root.isNsfw ? "NSFW library: on" : "NSFW library: off"}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 text-[0.68rem] font-medium border transition-all duration-fast",
                        root.isNsfw
                          ? "bg-accent-950/30 border-border-accent text-text-accent shadow-[var(--shadow-glow-accent)]"
                          : "bg-surface-1 border-border-subtle text-text-disabled hover:text-text-muted hover:border-border-default"
                      )}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      NSFW
                    </button>
                  </div>
                  
                  <div className="text-[0.65rem] text-text-disabled flex items-center gap-1.5 whitespace-nowrap ml-auto">
                    <Clock className="h-3 w-3" />
                    Last scan: {formatTimestamp(root.lastScannedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <NsfwGate>
      <div className="border-t border-border-subtle" />

      {/* ─── Metadata Providers ──────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <Database className="h-4 w-4 text-text-accent" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Metadata Providers</h2>
            <p className="text-[0.68rem] text-text-muted">
              Stash-Box endpoints and community scrapers for identifying media
            </p>
          </div>
        </div>

        {/* Stash-Box Endpoints */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[0.78rem] font-medium text-text-secondary">Stash-Box Endpoints</h3>
            <button
              onClick={() => {
                setEditingStashBox(null);
                setSbName("");
                setSbEndpoint("");
                setSbApiKey("");
                setSbTestResult(null);
                setShowStashBoxForm(true);
              }}
              className="flex items-center gap-1 px-2 py-1 text-[0.68rem] text-text-accent hover:bg-accent-950 rounded transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>

          {stashBoxEndpoints.length === 0 && !showStashBoxForm && (
            <div className="surface-card no-lift p-4 text-center">
              <p className="text-[0.75rem] text-text-disabled">
                No Stash-Box endpoints configured. Add one to enable fingerprint-based video identification.
              </p>
            </div>
          )}

          {stashBoxEndpoints.map((ep) => (
            <div key={ep.id} className="surface-card no-lift p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.82rem] font-medium truncate">{ep.name}</span>
                    {!ep.enabled && (
                      <span className="pill-muted px-1.5 py-0.5 text-[0.55rem]">Disabled</span>
                    )}
                    {sbTestResult?.id === ep.id && (
                      <span className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 text-[0.55rem] rounded",
                        sbTestResult.valid
                          ? "bg-emerald-950 text-emerald-400"
                          : "bg-red-950 text-red-400",
                      )}>
                        {sbTestResult.valid ? <Check className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                        {sbTestResult.valid ? "Connected" : sbTestResult.error ?? "Failed"}
                      </span>
                    )}
                  </div>
                  <p className="text-[0.65rem] text-text-disabled truncate mt-0.5">
                    {ep.endpoint} · Key: {ep.apiKeyPreview}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={async () => {
                      setSbTesting(ep.id);
                      setSbTestResult(null);
                      try {
                        const result = await testStashBoxEndpoint(ep.id);
                        setSbTestResult({ id: ep.id, ...result });
                      } catch {
                        setSbTestResult({ id: ep.id, valid: false, error: "Request failed" });
                      } finally {
                        setSbTesting(null);
                      }
                    }}
                    disabled={sbTesting === ep.id}
                    className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded transition-colors"
                    title="Test connection"
                  >
                    {sbTesting === ep.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingStashBox(ep);
                      setSbName(ep.name);
                      setSbEndpoint(ep.endpoint);
                      setSbApiKey("");
                      setSbTestResult(null);
                      setShowStashBoxForm(true);
                    }}
                    className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      await updateStashBoxEndpoint(ep.id, { enabled: !ep.enabled });
                      setStashBoxEndpoints((prev) =>
                        prev.map((e) => (e.id === ep.id ? { ...e, enabled: !e.enabled } : e))
                      );
                      setMessage(`${ep.name} ${ep.enabled ? "disabled" : "enabled"}.`);
                      setTimeout(() => setMessage(null), 2000);
                    }}
                    className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded transition-colors"
                    title={ep.enabled ? "Disable" : "Enable"}
                  >
                    {ep.enabled ? <ToggleRight className="h-3.5 w-3.5 text-text-accent" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={async () => {
                      await deleteStashBoxEndpoint(ep.id);
                      setStashBoxEndpoints((prev) => prev.filter((e) => e.id !== ep.id));
                    }}
                    className="p-1.5 text-text-muted hover:text-red-400 hover:bg-surface-2 rounded transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add/Edit form */}
          {showStashBoxForm && (
            <div className="surface-card no-lift p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[0.78rem] font-medium">
                  {editingStashBox ? "Edit Endpoint" : "Add Stash-Box Endpoint"}
                </h4>
                <button
                  onClick={() => setShowStashBoxForm(false)}
                  className="p-1 text-text-disabled hover:text-text-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid gap-2.5">
                <div>
                  <label className="text-[0.65rem] text-text-disabled block mb-1">Name</label>
                  <input
                    type="text"
                    value={sbName}
                    onChange={(e) => setSbName(e.target.value)}
                    placeholder="StashDB"
                    className="w-full bg-surface-1 border border-border-subtle px-2.5 py-1.5 text-[0.78rem] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[0.65rem] text-text-disabled block mb-1">GraphQL Endpoint</label>
                  <input
                    type="text"
                    value={sbEndpoint}
                    onChange={(e) => setSbEndpoint(e.target.value)}
                    placeholder="https://stashdb.org/graphql"
                    className="w-full bg-surface-1 border border-border-subtle px-2.5 py-1.5 text-[0.78rem] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-accent transition-colors"
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    {[
                      { label: "StashDB", url: "https://stashdb.org/graphql" },
                      { label: "FansDB", url: "https://fansdb.cc/graphql" },
                      { label: "PMVStash", url: "https://pmvstash.org/graphql" },
                      { label: "ThePornDB", url: "https://theporndb.net/graphql" },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setSbEndpoint(preset.url);
                          if (!sbName) setSbName(preset.label);
                        }}
                        className="px-1.5 py-0.5 text-[0.6rem] text-text-disabled border border-border-subtle hover:text-text-muted hover:border-border-default rounded transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[0.65rem] text-text-disabled block mb-1">
                    API Key {editingStashBox && <span className="text-text-disabled">(leave blank to keep current)</span>}
                  </label>
                  <input
                    type="password"
                    value={sbApiKey}
                    onChange={(e) => setSbApiKey(e.target.value)}
                    placeholder={editingStashBox ? "••••••••" : "Paste your API key"}
                    className="w-full bg-surface-1 border border-border-subtle px-2.5 py-1.5 text-[0.78rem] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-accent transition-colors font-mono"
                  />
                </div>
              </div>

              {error && (
                <p className="text-[0.68rem] text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowStashBoxForm(false)}
                  className="px-3 py-1.5 text-[0.72rem] text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setSbSaving(true);
                    setError(null);
                    try {
                      if (editingStashBox) {
                        const updates: Record<string, string> = {};
                        if (sbName !== editingStashBox.name) updates.name = sbName;
                        if (sbEndpoint !== editingStashBox.endpoint) updates.endpoint = sbEndpoint;
                        if (sbApiKey) updates.apiKey = sbApiKey;
                        const updated = await updateStashBoxEndpoint(editingStashBox.id, updates);
                        setStashBoxEndpoints((prev) =>
                          prev.map((e) => (e.id === updated.id ? updated : e))
                        );
                      } else {
                        if (!sbApiKey) {
                          setError("API key is required");
                          setSbSaving(false);
                          return;
                        }
                        const created = await createStashBoxEndpoint({
                          name: sbName,
                          endpoint: sbEndpoint,
                          apiKey: sbApiKey,
                        });
                        setStashBoxEndpoints((prev) => [...prev, created]);
                      }
                      setShowStashBoxForm(false);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to save");
                    } finally {
                      setSbSaving(false);
                    }
                  }}
                  disabled={sbSaving || !sbName || !sbEndpoint}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium rounded transition-colors",
                    "bg-accent-600 text-white hover:bg-accent-500 disabled:opacity-50",
                  )}
                >
                  {sbSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  {editingStashBox ? "Update" : "Save & Test"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Community Scrapers link */}
        <Link href="/scrapers" className="group block">
          <div
            className={cn(
              "surface-card no-lift p-3.5 transition-all duration-normal",
              "hover:border-border-accent hover:shadow-[var(--shadow-glow-accent)]",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-text-muted" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[0.82rem] font-medium transition-colors duration-fast group-hover:text-text-accent">
                      Community Scrapers
                    </span>
                    <span className="pill-accent px-1.5 py-0.5 text-[0.55rem]">{scraperCount}</span>
                  </div>
                  <p className="text-[0.65rem] text-text-disabled">
                    Install and manage community metadata scrapers
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-disabled transition-all duration-fast group-hover:translate-x-0.5 group-hover:text-text-accent" />
            </div>
          </div>
        </Link>
      </section>
      </NsfwGate>

      <div className="border-t border-border-subtle" />
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <ScanSearch className="h-4 w-4 text-text-accent" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Generation Pipeline</h2>
            <p className="text-[0.68rem] text-text-muted">
              Control automatic scanning and how new files are enriched
            </p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <ToggleCard
            label="Automatic library scans"
            description="Queue scans on a recurring interval."
            checked={settings.autoScanEnabled}
            onChange={(checked) => {
              setSettings((current) => ({ ...current, autoScanEnabled: checked }));
              void autoSaveSetting({ autoScanEnabled: checked });
            }}
          />
          <NumberStepper
            label="Scan Interval"
            description="Minutes between automatic scans."
            value={settings.scanIntervalMinutes}
            min={5}
            max={1440}
            step={5}
            onChange={(val) => setSettings((current) => ({ ...current, scanIntervalMinutes: val }))}
          />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <ToggleCard
            label="Technical metadata"
            description="ffprobe: runtime, resolution, codec, bitrate."
            checked={settings.autoGenerateMetadata}
            onChange={(checked) => {
              setSettings((current) => ({ ...current, autoGenerateMetadata: checked }));
              void autoSaveSetting({ autoGenerateMetadata: checked });
            }}
          />
          <ToggleCard
            label="Fingerprints"
            description="MD5 and OpenSubtitles hashes for matching."
            checked={settings.autoGenerateFingerprints}
            onChange={(checked) => {
              setSettings((current) => ({ ...current, autoGenerateFingerprints: checked }));
              void autoSaveSetting({ autoGenerateFingerprints: checked });
            }}
          />
          <ToggleCard
            label="Preview assets"
            description="Thumbnails and short preview clips."
            checked={settings.autoGeneratePreview}
            onChange={(checked) => {
              setSettings((current) => ({ ...current, autoGeneratePreview: checked }));
              void autoSaveSetting({ autoGeneratePreview: checked });
            }}
          />
          <ToggleCard
            label="Trickplay strips"
            description="Sprite sheets for player scrub previews."
            checked={settings.generateTrickplay}
            onChange={(checked) => {
              setSettings((current) => ({ ...current, generateTrickplay: checked }));
              void autoSaveSetting({ generateTrickplay: checked });
            }}
          />
          <div className="md:col-span-2">
            <ToggleCard
              label="Store video previews in dedicated cache directory"
              description="When on, thumbnails, preview clips, sprites, and trickplay data live under the app data volume (OBSCURA_CACHE_DIR, e.g. /data/cache). When off, those files are written next to each video. Scene .nfo files always stay beside the media file."
              checked={settings.metadataStorageDedicated}
              onChange={handleMetadataStorageToggle}
            />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="md:col-span-2">
            <NumberStepper
              label="Background job concurrency"
              description="Parallel jobs per queue in the worker. Higher uses more CPU, disk I/O, and RAM. Applies within about 15 seconds after save."
              value={settings.backgroundWorkerConcurrency}
              min={BACKGROUND_WORKER_CONCURRENCY_MIN}
              max={BACKGROUND_WORKER_CONCURRENCY_MAX}
              step={1}
              onChange={(val) =>
                setSettings((current) => ({ ...current, backgroundWorkerConcurrency: val }))
              }
            />
          </div>
          <NumberStepper
            label="Trickplay Interval"
            description="Seconds between sprite sheet frames."
            value={settings.trickplayIntervalSeconds}
            min={1}
            max={60}
            step={1}
            onChange={(val) => setSettings((current) => ({ ...current, trickplayIntervalSeconds: val }))}
          />
          <NumberStepper
            label="Preview Clip Length"
            description="Duration of the generated preview video."
            value={settings.previewClipDurationSeconds}
            min={2}
            max={60}
            step={1}
            onChange={(val) => setSettings((current) => ({ ...current, previewClipDurationSeconds: val }))}
          />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <QualitySlider
            label="Thumbnail Quality"
            value={settings.thumbnailQuality}
            onChange={(value) =>
              setSettings((current) => ({ ...current, thumbnailQuality: value }))
            }
          />
          <QualitySlider
            label="Trickplay Quality"
            value={settings.trickplayQuality}
            onChange={(value) =>
              setSettings((current) => ({ ...current, trickplayQuality: value }))
            }
          />
        </div>
      </section>

      <div className="border-t border-border-subtle" />

      {/* ─── Content Visibility ──────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <Eye className="h-4 w-4 text-text-accent" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Content Visibility</h2>
            <p className="text-[0.68rem] text-text-muted">
              Control how adult content is displayed across the application
            </p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="surface-card no-lift p-3.5 flex flex-col gap-3">
            <div>
              <label className="control-label">NSFW Content Mode</label>
              <p className="text-[0.68rem] text-text-muted">
                Stored per device. Does not affect stored data.
              </p>
            </div>
            
            <div className="flex bg-surface-1 p-1 border border-border-default shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]">
              <button
                type="button"
                onClick={() => setNsfwMode("off")}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 transition-all duration-fast",
                  nsfwMode === "off" 
                    ? "bg-surface-3 border border-border-subtle shadow-card text-text-primary" 
                    : "text-text-muted hover:text-text-primary hover:bg-surface-2/50 border border-transparent"
                )}
              >
                <Shield className={cn("h-4 w-4", nsfwMode === "off" && "text-info-text")} />
                <span className="text-[0.75rem] font-medium">Off (SFW)</span>
              </button>
              <button
                type="button"
                onClick={() => setNsfwMode("blur")}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 transition-all duration-fast",
                  nsfwMode === "blur" 
                    ? "bg-surface-3 border border-border-subtle shadow-card text-text-primary" 
                    : "text-text-muted hover:text-text-primary hover:bg-surface-2/50 border border-transparent"
                )}
              >
                <Droplet className={cn("h-4 w-4", nsfwMode === "blur" && "text-warning-text")} />
                <span className="text-[0.75rem] font-medium">Blur</span>
              </button>
              <button
                type="button"
                onClick={() => setNsfwMode("show")}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 transition-all duration-fast",
                  nsfwMode === "show" 
                    ? "bg-surface-3 border border-border-accent shadow-[var(--shadow-glow-accent)] text-accent-400" 
                    : "text-text-muted hover:text-text-primary hover:bg-surface-2/50 border border-transparent"
                )}
              >
                <Flame className={cn("h-4 w-4", nsfwMode === "show" && "text-accent-500")} />
                <span className="text-[0.75rem] font-medium">Show</span>
              </button>
            </div>
            
            <div className="text-[0.7rem] text-text-muted bg-surface-2/50 p-2.5 border border-border-subtle">
              {nsfwMode === "off" && "Adult content is completely hidden from the interface."}
              {nsfwMode === "blur" && "Adult content is shown but thumbnails and text are obscured until hovered."}
              {nsfwMode === "show" && "All content is displayed normally without any obscuring."}
            </div>
          </div>
          <ToggleCard
            label="Auto-enable on LAN"
            description="Automatically switch to Show mode when accessing from a local network."
            checked={settings.nsfwLanAutoEnable}
            onChange={(checked) => {
              setSettings((current) => ({ ...current, nsfwLanAutoEnable: checked }));
              void autoSaveSetting({ nsfwLanAutoEnable: checked });
            }}
          />
        </div>
        <div className="surface-card no-lift p-3.5 bg-surface-1/50 border-l-2 border-l-border-accent">
          <p className="text-[0.65rem] text-text-muted leading-relaxed">
            <strong className="text-text-accent font-mono uppercase tracking-wider mr-2">Power-user tip:</strong>
            Quick toggle between full SFW and full NSFW (skips blur) with no toolbar button:{" "}
            <kbd className="bg-surface-2 border border-border-subtle shadow-well px-1.5 py-0.5 rounded-sm font-mono text-[0.6rem] text-text-secondary mx-0.5">⌘⇧Z</kbd> on Mac or{" "}
            <kbd className="bg-surface-2 border border-border-subtle shadow-well px-1.5 py-0.5 rounded-sm font-mono text-[0.6rem] text-text-secondary mx-0.5">Ctrl+Shift+Z</kbd>{" "}
            elsewhere. Global search also opens with{" "}
            <kbd className="bg-surface-2 border border-border-subtle shadow-well px-1.5 py-0.5 rounded-sm font-mono text-[0.6rem] text-text-secondary mx-0.5">⌘K</kbd> /{" "}
            <kbd className="bg-surface-2 border border-border-subtle shadow-well px-1.5 py-0.5 rounded-sm font-mono text-[0.6rem] text-text-secondary mx-0.5">Ctrl+K</kbd>. 
            On mobile, press and hold the bottom bar <strong className="text-text-primary">More</strong> button for five seconds for the same SFW ↔ full NSFW toggle.
          </p>
        </div>
      </section>

      <div className="border-t border-border-subtle" />
      <SubtitlesSection
        settings={settings}
        onToggleAutoEnable={(checked) => {
          setSettings((current) => ({ ...current, subtitlesAutoEnable: checked }));
          void autoSaveSetting({ subtitlesAutoEnable: checked });
        }}
        onLanguagesCommit={(value) => {
          setSettings((current) => ({
            ...current,
            subtitlesPreferredLanguages: value,
          }));
          void autoSaveSetting({ subtitlesPreferredLanguages: value });
        }}
        onAppearanceCommit={(next) => {
          setSettings((current) => ({
            ...current,
            subtitleStyle: next.style,
            subtitleFontScale: next.fontScale,
            subtitlePositionPercent: next.positionPercent,
          }));
          void autoSaveSetting({
            subtitleStyle: next.style,
            subtitleFontScale: next.fontScale,
            subtitlePositionPercent: next.positionPercent,
          });
        }}
      />

      <div className="border-t border-border-subtle" />
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <HardDrive className="h-4 w-4 text-text-accent" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Generated Storage</h2>
            <p className="text-[0.68rem] text-text-muted">Disk usage for rendered assets</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StorageStat
            label="Thumbnails"
            value={formatBytes(storage?.thumbnailsBytes ?? 0)}
            gradientClass="gradient-thumb-1"
          />
          <StorageStat
            label="Preview clips"
            value={formatBytes(storage?.previewsBytes ?? 0)}
            gradientClass="gradient-thumb-2"
          />
          <StorageStat
            label="Trickplay sprites"
            value={formatBytes(storage?.trickplayBytes ?? 0)}
            gradientClass="gradient-thumb-3"
          />
          <StorageStat label="Total" value={formatBytes(totalBytes)} accent />
        </div>
      </section>

      <div className="border-t border-border-subtle" />
      <DiagnosticsSection />

      {metadataStorageDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={metadataStorageBusy ? undefined : closeMetadataStorageDialogCancel}
            aria-hidden
          />
          <div className="relative surface-elevated border border-border-subtle w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-base font-heading font-semibold text-text-primary">
              Relocate existing scene assets?
            </h3>
            <p className="text-[0.78rem] text-text-muted leading-relaxed">
              You changed where new thumbnails, preview clips, sprites, and trickplay files are stored. Move
              files that are already on disk to the new location, or leave them — the app will keep reading
              from either place until you rebuild previews or move later from Jobs.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={metadataStorageBusy}
                onClick={() => void confirmMetadataStorageMoveFiles()}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-[0.8rem] font-medium border border-border-accent/40 bg-accent-950/40 text-text-primary hover:bg-accent-950/55 transition-colors disabled:opacity-50"
              >
                {metadataStorageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Move existing files
              </button>
              <button
                type="button"
                disabled={metadataStorageBusy}
                onClick={() => void confirmMetadataStorageLeaveInPlace()}
                className="w-full px-3.5 py-2.5 text-[0.8rem] font-medium border border-border-subtle bg-surface-2/40 text-text-secondary hover:border-border-accent/25 transition-colors disabled:opacity-50"
              >
                Leave files in place
              </button>
              <button
                type="button"
                disabled={metadataStorageBusy}
                onClick={closeMetadataStorageDialogCancel}
                className="w-full px-3.5 py-2 text-[0.75rem] text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DiagnosticsSection() {
  const [rebuilding, setRebuilding] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { mode: nsfwMode } = useNsfw();

  const handleRebuildPreviews = async () => {
    setRebuilding(true);
    setResult(null);
    try {
      const res = await rebuildPreviews(nsfwMode);
      setResult(
        `Queued ${res.enqueued} ${res.enqueued === 1 ? "video" : "videos"} for forced preview regeneration (metadata re-probed from disk)`
      );
    } catch {
      setResult("Failed to queue rebuild");
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5 px-1">
        <Wrench className="h-4 w-4 text-text-accent" />
        <div>
          <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Diagnostics</h2>
          <p className="text-[0.68rem] text-text-muted">Maintenance actions for troubleshooting</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="surface-card p-3 space-y-2">
          <div>
            <p className="text-[0.78rem] font-medium text-status-error-text">
              Force rebuild all previews
            </p>
            <p className="text-[0.68rem] text-text-muted">
              Re-probe each file on disk (resolution, duration, codecs, size), then clear and regenerate thumbnails, preview
              clips, and trickplay sprites for every {entityTerms.scene.toLowerCase()}. Use this after replacing a source file
              with a different resolution, after quality setting changes, or to fix corrupt sprites. Heavy maintenance job.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRebuildPreviews}
              disabled={rebuilding}
              className="inline-flex items-center gap-1.5 border border-status-error/25 bg-status-error/[0.12] px-3 py-1.5 text-[0.72rem] font-medium text-status-error-text transition-colors hover:bg-status-error/[0.18] disabled:opacity-50"
            >
              {rebuilding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {rebuilding ? "Queuing..." : "Force rebuild previews"}
            </button>
            {result && (
              <p className="text-[0.68rem] text-text-muted">{result}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ToggleCard({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "surface-card no-lift p-3.5 text-left transition-all duration-normal group flex flex-col justify-between min-h-[100px]",
        checked ? "border-border-accent/40 bg-surface-2/30" : "opacity-85 hover:opacity-100",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2 w-full">
        <p className={cn("text-sm font-medium transition-colors", checked ? "text-text-primary" : "text-text-secondary")}>{label}</p>
        <div className={cn("relative w-9 h-5 border transition-colors duration-fast shrink-0", checked ? "border-border-accent bg-accent-950/30" : "border-border-default bg-surface-1 shadow-well")}>
          <div className={cn("absolute top-0.5 bottom-0.5 w-3.5 bg-surface-3 border border-border-subtle transition-all duration-fast flex items-center justify-center shadow-sm", checked ? "left-[1.1rem] border-border-accent" : "left-0.5")}>
            <div className={cn("led led-sm", checked ? "led-active" : "led-idle")} />
          </div>
        </div>
      </div>
      <p className="text-[0.72rem] text-text-muted leading-relaxed">{description}</p>
    </button>
  );
}

function qualityLabel(value: number): string {
  if (value <= 1) return "Native";
  if (value <= 2) return "High";
  if (value <= 5) return "Good";
  if (value <= 10) return "Medium";
  if (value <= 15) return "Low";
  if (value <= 20) return "Very Low";
  return "Minimum";
}

function QualitySlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="surface-card no-lift p-3.5 flex flex-col justify-between min-h-[100px]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <label className="control-label">{label}</label>
          <p className="text-[0.65rem] text-text-muted mt-1">1 is native, 31 is smallest</p>
        </div>
        <span className="text-mono-sm px-2 py-0.5 bg-surface-1 border border-border-subtle text-text-accent shadow-well">
          {qualityLabel(value)} ({value})
        </span>
      </div>
      <div className="relative pt-2 pb-1">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 bg-surface-4 border border-border-subtle shadow-well" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-accent-700 to-accent-500 shadow-[0_0_8px_rgba(199,155,92,0.3)]" style={{ width: `${((value - 1) / 30) * 100}%` }} />
        <input
          type="range"
          min={1}
          max={31}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="relative w-full h-1.5 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:bg-surface-2 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border-accent [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.8)] z-10"
        />
      </div>
    </div>
  );
}

function NumberStepper({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="surface-card no-lift p-3.5 flex flex-col justify-between min-h-[100px]">
      <div className="mb-3">
        <label className="control-label mb-1">{label}</label>
        <p className="text-[0.68rem] text-text-muted">{description}</p>
      </div>
      <div className="flex items-center bg-surface-1 border border-border-default shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="px-3 py-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors border-r border-border-subtle"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 text-center font-mono text-[0.85rem] text-text-primary py-1.5">
          {value}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="px-3 py-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors border-l border-border-subtle"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function StorageStat({
  accent,
  label,
  value,
  gradientClass,
}: {
  accent?: boolean;
  label: string;
  value: string;
  gradientClass?: string;
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
          gradientClass || (accent ? "bg-accent-500" : "bg-surface-4")
        )}
      />
      <div className="flex items-center justify-between ml-1.5">
        <span className="text-[0.6rem] font-semibold tracking-[0.15em] uppercase text-text-muted">
          {label}
        </span>
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

// ── Subtitles settings section with live dummy-frame preview ──────
const STYLE_LABELS: Record<SubtitleDisplayStyle, string> = {
  stylized: "Stylized",
  classic: "Classic",
  outline: "Outline",
};

const STYLE_DESCRIPTIONS: Record<SubtitleDisplayStyle, string> = {
  stylized: "Dark Room brass-edged plate",
  classic: "Flat black box, plain white text",
  outline: "White text with black stroke, no box",
};

function SubtitlesSection({
  settings,
  onToggleAutoEnable,
  onLanguagesCommit,
  onAppearanceCommit,
}: {
  settings: LibrarySettings;
  onToggleAutoEnable: (checked: boolean) => void;
  onLanguagesCommit: (value: string) => void;
  onAppearanceCommit: (next: SubtitleAppearance) => void;
}) {
  const appearance: SubtitleAppearance = {
    style: (settings.subtitleStyle ?? defaultSubtitleAppearance.style) as SubtitleDisplayStyle,
    fontScale: settings.subtitleFontScale ?? defaultSubtitleAppearance.fontScale,
    positionPercent:
      settings.subtitlePositionPercent ?? defaultSubtitleAppearance.positionPercent,
  };

  const [langDraft, setLangDraft] = useState(
    settings.subtitlesPreferredLanguages ?? "en,eng",
  );

  // Stay in sync when the server value changes (e.g. after reload).
  useEffect(() => {
    setLangDraft(settings.subtitlesPreferredLanguages ?? "en,eng");
  }, [settings.subtitlesPreferredLanguages]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5 px-1">
        <Captions className="h-4 w-4 text-text-accent" />
        <div>
          <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
            Subtitles
          </h2>
          <p className="text-[0.68rem] text-text-muted">
            Defaults applied to the video player when a scene has subtitle tracks
          </p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <ToggleCard
          label="Auto-enable on load"
          description="Turn on subtitles automatically when a scene has a track matching your preferred languages."
          checked={settings.subtitlesAutoEnable ?? false}
          onChange={onToggleAutoEnable}
        />
        <div className="surface-card no-lift p-3.5 flex flex-col justify-between min-h-[100px]">
          <div>
            <label className="control-label" htmlFor="subtitle-lang-input">
              Preferred languages
            </label>
            <p className="text-[0.68rem] text-text-muted mt-1">
              Comma-separated priority list (e.g. <code className="text-text-accent">en,eng,en-US</code>). First match wins.
            </p>
          </div>
          <input
            id="subtitle-lang-input"
            type="text"
            value={langDraft}
            onChange={(e) => setLangDraft(e.target.value)}
            onBlur={() => {
              const next = langDraft.trim();
              if (next !== (settings.subtitlesPreferredLanguages ?? "")) {
                onLanguagesCommit(next);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            className="mt-3 border border-border-default bg-surface-1 px-2.5 py-1.5 text-[0.82rem] text-text-primary focus:border-border-accent focus:outline-none"
            placeholder="en,eng"
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="surface-card no-lift p-3.5 space-y-3">
          <div>
            <label className="control-label">Display style</label>
            <p className="text-[0.68rem] text-text-muted mt-1">
              The preview on the right updates live as you change these.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            {subtitleDisplayStyles.map((style) => {
              const isActive = appearance.style === style;
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => onAppearanceCommit({ ...appearance, style })}
                  className={cn(
                    "flex w-full items-start justify-between gap-2 border px-2.5 py-2 text-left transition-colors duration-fast",
                    isActive
                      ? "border-border-accent bg-accent-950/30 text-text-primary"
                      : "border-border-default text-text-secondary hover:border-border-accent/60",
                  )}
                >
                  <div>
                    <div className="text-[0.8rem] font-medium">{STYLE_LABELS[style]}</div>
                    <div className="text-[0.65rem] text-text-muted">
                      {STYLE_DESCRIPTIONS[style]}
                    </div>
                  </div>
                  {isActive && (
                    <span className="text-[0.58rem] uppercase tracking-[0.16em] text-text-accent">
                      On
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] text-text-muted uppercase tracking-[0.14em]">
                Text size
              </span>
              <span className="text-mono-sm text-text-accent">
                {appearance.fontScale.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={appearance.fontScale}
              onChange={(e) =>
                onAppearanceCommit({
                  ...appearance,
                  fontScale: Number(e.target.value),
                })
              }
              className="w-full accent-accent-500"
              aria-label="Subtitle text size"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] text-text-muted uppercase tracking-[0.14em]">
                Vertical position
              </span>
              <span className="text-mono-sm text-text-accent">
                {Math.round(appearance.positionPercent)}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={98}
              step={1}
              value={appearance.positionPercent}
              onChange={(e) =>
                onAppearanceCommit({
                  ...appearance,
                  positionPercent: Number(e.target.value),
                })
              }
              className="w-full accent-accent-500"
              aria-label="Subtitle vertical position"
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="surface-card no-lift p-3.5 flex flex-col">
          <div>
            <label className="control-label">Preview</label>
            <p className="text-[0.68rem] text-text-muted mt-1">
              Shows how captions will render on top of a scene.
            </p>
          </div>
          <div className="relative mt-3 aspect-video w-full overflow-hidden border border-border-subtle bg-black">
            {/* Dummy frame: subtle gradient + grid so contrast is realistic. */}
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#1a1f2b_0%,#0e1118_45%,#2a1f14_100%)]" />
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 32px)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent" />
            <SubtitleCaptionOverlay
              text="This is how your subtitles will look."
              appearance={appearance}
              alwaysVisible
            />
          </div>
        </div>
      </div>
    </section>
  );
}
