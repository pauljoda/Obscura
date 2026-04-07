"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ScanSearch,
  Settings,
  Trash2,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  X,
  Check,
  AlertCircle,
  Wrench,
} from "lucide-react";
import { useNsfw } from "../nsfw/nsfw-context";
import {
  browseLibraryPath,
  createLibraryRoot,
  createStashBoxEndpoint,
  deleteLibraryRoot,
  deleteStashBoxEndpoint,
  fetchInstalledScrapers,
  fetchLibraryConfig,
  fetchStashBoxEndpoints,
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
] as const;

function normalizeSettings(s: LibrarySettings): LibrarySettings {
  return {
    ...s,
    thumbnailQuality: s.thumbnailQuality ?? 2,
    trickplayQuality: s.trickplayQuality ?? 2,
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
  const [newRootIsNsfw, setNewRootIsNsfw] = useState(false);
  const { mode: nsfwMode, setMode: setNsfwMode } = useNsfw();
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
        isNsfw: newRootIsNsfw,
      });

      setMessage("Library root added.");
      setNewRootPath("");
      setNewRootLabel("");
      setNewRootIsNsfw(false);
      setBrowserVisible(false);
      await loadConfig();
      await runQueue("library-scan");
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

  async function handleToggleMediaType(root: LibraryRoot, field: "scanVideos" | "scanImages") {
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
      const response = await runQueue("library-scan");
      setMessage(`Queued ${response.enqueued} library scan job${response.enqueued === 1 ? "" : "s"}.`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to queue scan");
    }
  }

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
          <div className="surface-card no-lift space-y-3 border-border-accent/30 p-4">
            <div className="bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="truncate text-mono-sm text-text-accent">
                  {browser?.path ?? "Loading..."}
                </span>
                <button
                  onClick={() => void openBrowser(browser?.parentPath ?? browser?.path)}
                  disabled={!browser?.parentPath}
                  className="flex-shrink-0 px-2.5 py-1 text-xs text-text-muted transition-all hover:bg-surface-3/60 hover:text-text-primary disabled:opacity-40"
                >
                  Up One Level
                </button>
              </div>
              <div className="scrollbar-hidden grid max-h-[260px] gap-1.5 overflow-y-auto md:grid-cols-2">
                {browser?.directories.map((directory) => (
                  <button
                    key={directory.path}
                    type="button"
                    className="surface-card px-3 py-2 text-left"
                    onClick={() => void openBrowser(directory.path)}
                  >
                    <p className="truncate text-[0.8rem] font-medium">{directory.name}</p>
                    <p className="truncate text-mono-sm text-text-disabled">{directory.path}</p>
                  </button>
                ))}
                {browser && browser.directories.length === 0 ? (
                  <p className="col-span-full py-3 text-center text-xs text-text-disabled">
                    No child directories found.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px] flex-1">
                <label className="control-label mb-1">Label (optional)</label>
                <input
                  className="control-input w-full py-1.5 text-sm"
                  value={newRootLabel}
                  onChange={(event) => setNewRootLabel(event.target.value)}
                  placeholder="Primary scenes"
                />
              </div>
              <label className="cursor-pointer pb-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  className="mr-2 accent-[#c79b5c]"
                  checked={newRootRecursive}
                  onChange={(event) => setNewRootRecursive(event.target.checked)}
                />
                Recursive
              </label>
              <label className="cursor-pointer pb-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  className="mr-2 accent-[#c79b5c]"
                  checked={newRootScanVideos}
                  onChange={(event) => setNewRootScanVideos(event.target.checked)}
                />
                Videos
              </label>
              <label className="cursor-pointer pb-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  className="mr-2 accent-[#c79b5c]"
                  checked={newRootScanImages}
                  onChange={(event) => setNewRootScanImages(event.target.checked)}
                />
                Images
              </label>
              <label className="cursor-pointer pb-2 text-xs text-text-secondary" title="Mark all content in this library as NSFW">
                <input
                  type="checkbox"
                  className="mr-2 accent-[#c79b5c]"
                  checked={newRootIsNsfw}
                  onChange={(event) => setNewRootIsNsfw(event.target.checked)}
                />
                NSFW
              </label>
              <button
                onClick={() => void handleAddRoot()}
                disabled={addingRoot || !newRootPath}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium transition-all duration-normal",
                  "border border-border-accent bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900 text-accent-200 shadow-[var(--shadow-glow-accent)]",
                  "hover:shadow-[var(--shadow-glow-accent-strong)] disabled:opacity-50",
                )}
              >
                {addingRoot ? "Adding..." : "Add Library"}
              </button>
              <button
                onClick={() => {
                  setBrowserVisible(false);
                  setNewRootPath("");
                  setNewRootLabel("");
                }}
                className="px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text-primary"
              >
                Cancel
              </button>
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
        ) : (
          <div className="space-y-1.5">
            {roots.map((root) => (
              <div
                key={root.id}
                className={cn(
                  "surface-card no-lift p-3.5 transition-opacity duration-fast",
                  !root.enabled && "opacity-50",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className={cn("led flex-shrink-0", root.enabled ? "led-active" : "led-idle")} />
                    <div className="min-w-0">
                      <p className="text-[0.8rem] font-semibold">{root.label}</p>
                      <p className="mt-0.5 truncate text-mono-sm text-text-disabled">{root.path}</p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="text-[0.62rem] text-text-disabled">
                      {formatTimestamp(root.lastScannedAt)}
                    </span>
                    {/* Media type toggles */}
                    <div className="flex items-center gap-1 border-l border-border-subtle pl-3">
                      <button
                        onClick={() => void handleToggleMediaType(root, "scanVideos")}
                        title={root.scanVideos ? "Videos: scanning" : "Videos: skipped"}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-1 text-[0.65rem] transition-colors",
                          root.scanVideos
                            ? "text-text-accent bg-accent-950/50"
                            : "text-text-disabled hover:text-text-muted"
                        )}
                      >
                        <Film className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Video</span>
                      </button>
                      <button
                        onClick={() => void handleToggleMediaType(root, "scanImages")}
                        title={root.scanImages ? "Images: scanning" : "Images: skipped"}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-1 text-[0.65rem] transition-colors",
                          root.scanImages
                            ? "text-text-accent bg-accent-950/50"
                            : "text-text-disabled hover:text-text-muted"
                        )}
                      >
                        <Image className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Image</span>
                      </button>
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
                          "flex items-center gap-1 px-1.5 py-1 text-[0.65rem] transition-colors",
                          root.isNsfw
                            ? "text-text-accent bg-accent-950/50"
                            : "text-text-disabled hover:text-text-muted"
                        )}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">NSFW</span>
                      </button>
                    </div>
                    <button
                      onClick={() => void handleToggleRoot(root)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-primary"
                    >
                      {root.enabled ? (
                        <ToggleRight className="h-4 w-4 text-text-accent" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                      {root.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => void handleDeleteRoot(root)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
                No Stash-Box endpoints configured. Add one to enable fingerprint-based scene identification.
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
          <div className="surface-card no-lift p-3.5">
            <label className="control-label mb-1.5">Scan Interval (min)</label>
            <input
              className="control-input w-full py-1.5 text-sm"
              type="number"
              min={5}
              step={5}
              value={settings.scanIntervalMinutes}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  scanIntervalMinutes: Number(event.target.value) || 5,
                }))
              }
            />
          </div>
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
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="surface-card no-lift p-3.5">
            <label className="control-label mb-1.5">Trickplay Interval (sec)</label>
            <input
              className="control-input w-full py-1.5 text-sm"
              type="number"
              min={3}
              step={1}
              value={settings.trickplayIntervalSeconds}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  trickplayIntervalSeconds: Number(event.target.value) || 3,
                }))
              }
            />
          </div>
          <div className="surface-card no-lift p-3.5">
            <label className="control-label mb-1.5">Preview Clip Length (sec)</label>
            <input
              className="control-input w-full py-1.5 text-sm"
              type="number"
              min={4}
              step={1}
              value={settings.previewClipDurationSeconds}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  previewClipDurationSeconds: Number(event.target.value) || 4,
                }))
              }
            />
          </div>
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
          <div className="surface-card no-lift p-3.5">
            <label className="control-label mb-1.5">NSFW Content Mode</label>
            <select
              className="control-input w-full py-1.5 text-sm"
              value={nsfwMode}
              onChange={(e) => setNsfwMode(e.target.value as "off" | "blur" | "show")}
            >
              <option value="off">Off — hide adult content (SFW)</option>
              <option value="blur">Blur — obscure thumbnails until hover</option>
              <option value="show">Show — display all content normally</option>
            </select>
            <p className="mt-1.5 text-[0.65rem] text-text-disabled">
              Stored per device. Does not affect stored data.
            </p>
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
    </div>
  );
}

function DiagnosticsSection() {
  const [rebuilding, setRebuilding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleRebuildPreviews = async () => {
    setRebuilding(true);
    setResult(null);
    try {
      const res = await rebuildPreviews();
      setResult(
        `Queued ${res.enqueued} scene${res.enqueued === 1 ? "" : "s"} for forced preview regeneration`
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
              Clear and regenerate thumbnails, preview clips, and trickplay sprites for every
              scene. This is a heavy maintenance job and is useful after quality setting changes
              or to fix corrupt sprites.
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
        "surface-card no-lift p-3.5 text-left transition-all duration-normal",
        checked && "border-border-accent/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">{label}</p>
          <p className="mt-1 text-[0.72rem] text-text-muted">{description}</p>
        </div>
        <div className={cn("led", checked ? "led-active" : "led-idle")} />
      </div>
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
    <div className="surface-card no-lift p-3.5">
      <div className="flex items-center justify-between mb-2">
        <label className="control-label">{label}</label>
        <span className="text-mono-sm text-text-accent">{qualityLabel(value)}</span>
      </div>
      <input
        type="range"
        min={1}
        max={31}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full h-1.5 appearance-none bg-surface-4 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:bg-accent-500 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(199,155,92,0.5)]"
      />
      <div className="flex justify-between mt-1.5">
        <span className="text-[0.58rem] text-text-disabled">Native (1)</span>
        <span className="text-[0.58rem] text-text-disabled">Smallest (31)</span>
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
