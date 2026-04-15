"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, StatusLed } from "@obscura/ui";
import { cn } from "@obscura/ui/lib/utils";
import {
  Database,
  Eye,
  Film,
  FolderOpen,
  HardDrive,
  Image,
  Loader2,
  Package,
  Plus,
  ScanSearch,
  Settings,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ToggleLeft,
  ToggleRight,
  X,
  Check,
  Shield,
  Droplet,
  Flame,
  Music,
  Clock,
} from "lucide-react";
import {
  BACKGROUND_WORKER_CONCURRENCY_MAX,
  BACKGROUND_WORKER_CONCURRENCY_MIN,
  playbackModes,
  type PlaybackMode,
  type SubtitleAppearance,
  type SubtitleDisplayStyle,
} from "@obscura/contracts";
import { useNsfw } from "../nsfw/nsfw-context";
import { entityTerms } from "../../lib/terminology";
import { ToggleCard, QualitySlider, NumberStepper, StorageStat } from "../settings/settings-controls";
import { SubtitlesSection } from "../settings/subtitles-section";
import { DiagnosticsSection } from "../settings/diagnostics-section";
import {
  browseLibraryPath,
  createLibraryRoot,
  deleteLibraryRoot,
  fetchInstalledScrapers,
  fetchLibraryConfig,
  migrateSceneAssetStorage,
  backfillPhashes,
  rebuildPreviews,
  runQueue,
  updateLibraryRoot,
  updateLibrarySettings,
  type LibraryBrowse,
  type LibraryRoot,
  type LibrarySettings,
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

function normalizeSettings(s: LibrarySettings): LibrarySettings {
  return {
    ...s,
    thumbnailQuality: s.thumbnailQuality ?? 2,
    trickplayQuality: s.trickplayQuality ?? 2,
    backgroundWorkerConcurrency: s.backgroundWorkerConcurrency ?? 1,
    useLibraryRootAsFolder: s.useLibraryRootAsFolder ?? false,
    metadataStorageDedicated: s.metadataStorageDedicated ?? true,
    subtitlesAutoEnable: s.subtitlesAutoEnable ?? false,
    subtitlesPreferredLanguages:
      s.subtitlesPreferredLanguages ?? "en,eng",
    subtitleStyle: (s.subtitleStyle ?? "stylized") as SubtitleDisplayStyle,
    subtitleFontScale: s.subtitleFontScale ?? 1,
    subtitlePositionPercent: s.subtitlePositionPercent ?? 88,
    subtitleOpacity: s.subtitleOpacity ?? 1,
    defaultPlaybackMode: ((s.defaultPlaybackMode ?? "direct") as PlaybackMode),
  };
}

interface SettingsPageClientProps {
  initialRoots: LibraryRoot[];
  initialScraperCount: number;
  initialSettings: LibrarySettings;
  initialStorage: StorageStats | null;
}

export function SettingsPageClient({
  initialRoots,
  initialScraperCount,
  initialSettings,
  initialStorage,
}: SettingsPageClientProps) {
  const [settings, setSettings] = useState(() => normalizeSettings(initialSettings));
  const [roots, setRoots] = useState(initialRoots);
  const [storage, setStorage] = useState<StorageStats | null>(initialStorage);
  const [browser, setBrowser] = useState<LibraryBrowse | null>(null);
  const [browserVisible, setBrowserVisible] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const [metadataStorageDialogOpen, setMetadataStorageDialogOpen] = useState(false);
  const [metadataStorageBusy, setMetadataStorageBusy] = useState(false);

  const savedSettings = useRef(normalizeSettings(initialSettings));

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
      <div>
        <h1 className="flex items-center gap-2.5">
          <Settings className="h-5 w-5 text-text-accent" />
          Settings
        </h1>
        <p className="mt-1 text-[0.78rem] text-text-muted">
          Configure libraries, generation pipeline, and scrapers
        </p>
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void openBrowser(browser?.path)}
            className="no-lift gap-1.5 px-3 py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Browse Folder
          </Button>
        </div>

        {browserVisible ? (
          <div className="surface-card no-lift space-y-4 border-border-accent/30 p-4">
            <div className="surface-well p-3 border border-border-subtle">
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void openBrowser(browser?.parentPath ?? browser?.path)}
                  disabled={!browser?.parentPath}
                  className="flex items-center gap-1 flex-shrink-0 border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-text-muted transition-all hover:bg-surface-3 hover:text-text-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Up
                </button>
                <div className="flex-1 overflow-x-auto scrollbar-hidden border border-border-subtle bg-surface-1 px-3 py-1.5 shadow-well">
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
                  <p className="empty-rack-slot col-span-full py-6 text-center text-xs text-text-disabled">
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
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void handleAddRoot()}
                  disabled={addingRoot || !newRootPath}
                  className="gap-1.5 px-4 py-2 text-xs"
                >
                  {addingRoot ? (
                    <>
                      <StatusLed status="accent" size="sm" pulse className="shrink-0" />
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent-300 drop-shadow-[0_0_6px_rgba(199,155,92,0.35)]" />
                    </>
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {addingRoot ? "Adding..." : "Add Library"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBrowserVisible(false);
                    setNewRootPath("");
                    setNewRootLabel("");
                  }}
                  className="px-3 py-2 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="surface-card no-lift flex flex-col items-center justify-center gap-3 p-8">
            <div className="flex items-center gap-2">
              <StatusLed status="accent" pulse />
              <Loader2 className="h-5 w-5 animate-spin text-accent-400 drop-shadow-[0_0_8px_rgba(199,155,92,0.3)]" />
            </div>
            <span className="text-mono-sm text-text-muted">Loading library configuration…</span>
          </div>
        ) : roots.length === 0 ? (
          <div className="empty-rack-slot flex flex-col items-center p-8 text-center">
            <FolderOpen className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
            <p className="text-sm text-text-muted">
              No library roots configured. Browse to a mounted folder to begin.
            </p>
          </div>
        ) : rootsVisibleInSettings.length === 0 ? (
          <div className="empty-rack-slot flex flex-col items-center p-8 text-center">
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
                      type="button"
                      onClick={() => void handleDeleteRoot(root)}
                      className="p-1.5 text-text-muted transition-colors hover:bg-error-muted/30 hover:text-error-text"
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

        <div className="grid gap-2 md:grid-cols-2 md:items-stretch">
          <div className="surface-card no-lift flex h-full flex-col gap-3 p-3.5">
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
            className="h-full"
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
            <kbd className="kbd mx-0.5">⌘⇧Z</kbd> on Mac or <kbd className="kbd mx-0.5">Ctrl+Shift+Z</kbd> elsewhere.
            Global search also opens with <kbd className="kbd mx-0.5">⌘K</kbd> / <kbd className="kbd mx-0.5">Ctrl+K</kbd>.
            On mobile, press and hold the bottom bar <strong className="text-text-primary">More</strong> button for five seconds for the same SFW ↔ full NSFW toggle.
          </p>
        </div>
      </section>

      <div className="border-t border-border-subtle" />
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <Film className="h-4 w-4 text-text-accent" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
              Playback
            </h2>
            <p className="text-[0.68rem] text-text-muted">
              Defaults applied to the video player when a scene loads
            </p>
          </div>
        </div>

        <div className="surface-card no-lift p-3.5 flex flex-col gap-3">
          <div>
            <label className="control-label">Default playback mode</label>
            <p className="text-[0.68rem] text-text-muted">
              Direct streams the source file (fastest seek, no transcode). Adaptive HLS
              uses the on-demand ffmpeg pipeline (supports bitrate switching and renditions).
              You can still override per-video in the quality menu.
            </p>
          </div>

          <div className="flex bg-surface-1 p-1 border border-border-default shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]">
            {playbackModes.map((mode) => {
              const active = settings.defaultPlaybackMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setSettings((current) => ({ ...current, defaultPlaybackMode: mode }));
                    void autoSaveSetting({ defaultPlaybackMode: mode });
                  }}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 transition-all duration-fast",
                    active
                      ? "bg-surface-3 border border-border-accent shadow-[var(--shadow-glow-accent)] text-accent-400"
                      : "text-text-muted hover:text-text-primary hover:bg-surface-2/50 border border-transparent",
                  )}
                >
                  <span className="text-[0.75rem] font-medium uppercase tracking-wider">
                    {mode === "direct" ? "Direct" : "Adaptive HLS"}
                  </span>
                </button>
              );
            })}
          </div>
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
            subtitleOpacity: next.opacity,
          }));
          void autoSaveSetting({
            subtitleStyle: next.style,
            subtitleFontScale: next.fontScale,
            subtitlePositionPercent: next.positionPercent,
            subtitleOpacity: next.opacity,
          });
        }}
      />

      <div className="border-t border-border-subtle" />

      {/* ─── Metadata Providers → Plugins link ──────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <Database className="h-4 w-4 text-text-accent" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Metadata Providers</h2>
            <p className="text-[0.68rem] text-text-muted">
              Manage identification plugins, scrapers, and StashBox endpoints
            </p>
          </div>
        </div>

        <Link href="/plugins" className="group block">
          <div className={cn(
            "surface-card no-lift p-3.5 transition-all duration-normal",
            "hover:border-border-accent hover:shadow-[var(--shadow-glow-accent)]",
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-text-muted" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[0.82rem] font-medium transition-colors duration-fast group-hover:text-text-accent">
                      Plugins
                    </span>
                    <span className="pill-accent px-1.5 py-0.5 text-[0.55rem]">{scraperCount}</span>
                  </div>
                  <p className="text-[0.65rem] text-text-disabled">
                    Manage scrapers, StashBox endpoints, and identification plugins
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-disabled transition-all duration-fast group-hover:translate-x-0.5 group-hover:text-text-accent" />
            </div>
          </div>
        </Link>
      </section>


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

        {/* One 2-column rhythm on md+: equal cells, full-width rows only when content is policy-wide */}
        <div className="grid gap-2 md:grid-cols-2 md:items-stretch">
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
            onChange={(val) => {
              setSettings((current) => ({ ...current, scanIntervalMinutes: val }));
              void autoSaveSetting({ scanIntervalMinutes: val });
            }}
          />

          <div className="md:col-span-2">
            <ToggleCard
              label="Library name as top folder"
              description="When enabled, scans place each library’s display name above its subfolders (e.g. Shows → Series → Season). When disabled, the tree starts at the first folder inside the library path. Run a library scan after changing this."
              checked={settings.useLibraryRootAsFolder}
              onChange={(checked) => {
                setSettings((current) => ({ ...current, useLibraryRootAsFolder: checked }));
                void autoSaveSetting({ useLibraryRootAsFolder: checked });
              }}
            />
          </div>

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
            label="Perceptual hash (pHash)"
            description="Stash-compatible video phash via the bundled helper. CPU-heavy (25 ffmpeg frame extractions per scene) but required to contribute fingerprints back to StashDB / ThePornDB."
            checked={settings.generatePhash}
            onChange={(checked) => {
              setSettings((current) => ({ ...current, generatePhash: checked }));
              void autoSaveSetting({ generatePhash: checked });
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
          <ToggleCard
            label="Store video previews in dedicated cache directory"
            description="When on, thumbnails, preview clips, sprites, and trickplay data live under the app data volume (OBSCURA_CACHE_DIR, e.g. /data/cache). When off, those files are written next to each video. Video .nfo files always stay beside the media file."
            checked={settings.metadataStorageDedicated}
            onChange={handleMetadataStorageToggle}
          />

          <div className="md:col-span-2">
            <NumberStepper
              label="Background job concurrency"
              description="Parallel jobs per queue in the worker. Higher uses more CPU, disk I/O, and RAM. Applies within about 15 seconds after save."
              value={settings.backgroundWorkerConcurrency}
              min={BACKGROUND_WORKER_CONCURRENCY_MIN}
              max={BACKGROUND_WORKER_CONCURRENCY_MAX}
              step={1}
              onChange={(val) => {
                setSettings((current) => ({ ...current, backgroundWorkerConcurrency: val }));
                void autoSaveSetting({ backgroundWorkerConcurrency: val });
              }}
            />
          </div>
          <NumberStepper
            label="Trickplay Interval"
            description="Seconds between sprite sheet frames."
            value={settings.trickplayIntervalSeconds}
            min={1}
            max={60}
            step={1}
            onChange={(val) => {
              setSettings((current) => ({ ...current, trickplayIntervalSeconds: val }));
              void autoSaveSetting({ trickplayIntervalSeconds: val });
            }}
          />
          <NumberStepper
            label="Preview Clip Length"
            description="Duration of the generated preview video."
            value={settings.previewClipDurationSeconds}
            min={2}
            max={60}
            step={1}
            onChange={(val) => {
              setSettings((current) => ({ ...current, previewClipDurationSeconds: val }));
              void autoSaveSetting({ previewClipDurationSeconds: val });
            }}
          />

          <QualitySlider
            label="Thumbnail Quality"
            value={settings.thumbnailQuality}
            onCommit={(value) => {
              setSettings((current) => ({ ...current, thumbnailQuality: value }));
              void autoSaveSetting({ thumbnailQuality: value });
            }}
          />
          <QualitySlider
            label="Trickplay Quality"
            value={settings.trickplayQuality}
            onCommit={(value) => {
              setSettings((current) => ({ ...current, trickplayQuality: value }));
              void autoSaveSetting({ trickplayQuality: value });
            }}
          />
        </div>
      </section>

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
              <Button
                type="button"
                variant="primary"
                disabled={metadataStorageBusy}
                onClick={() => void confirmMetadataStorageMoveFiles()}
                className="w-full gap-2 px-3.5 py-2.5 text-[0.8rem]"
              >
                {metadataStorageBusy ? (
                  <>
                    <StatusLed status="accent" size="sm" pulse />
                    <Loader2 className="h-4 w-4 animate-spin text-accent-300 drop-shadow-[0_0_6px_rgba(199,155,92,0.35)]" />
                  </>
                ) : null}
                Move existing files
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={metadataStorageBusy}
                onClick={() => void confirmMetadataStorageLeaveInPlace()}
                className="no-lift w-full border-border-subtle bg-surface-2/40 px-3.5 py-2.5 text-[0.8rem] text-text-secondary hover:border-border-accent/25"
              >
                Leave files in place
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={metadataStorageBusy}
                onClick={closeMetadataStorageDialogCancel}
                className="h-auto w-full px-3.5 py-2 text-[0.75rem]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Helper components and sections extracted to settings/ folder:
// - ToggleCard, QualitySlider, NumberStepper, StorageStat → settings/settings-controls.tsx
// - SubtitlesSection → settings/subtitles-section.tsx
// - DiagnosticsSection → settings/diagnostics-section.tsx
