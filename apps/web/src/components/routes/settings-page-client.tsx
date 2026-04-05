"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@obscura/ui/lib/utils";
import {
  FolderOpen,
  HardDrive,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  ScanSearch,
  Settings,
  Trash2,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  browseLibraryPath,
  createLibraryRoot,
  deleteLibraryRoot,
  fetchInstalledScrapers,
  fetchLibraryConfig,
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

const settingsKeys = [
  "autoScanEnabled",
  "scanIntervalMinutes",
  "autoGenerateMetadata",
  "autoGenerateFingerprints",
  "autoGeneratePreview",
  "generateTrickplay",
  "trickplayIntervalSeconds",
  "previewClipDurationSeconds",
] as const;

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
  const [settings, setSettings] = useState(initialSettings);
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scraperCount, setScraperCount] = useState(initialScraperCount);

  const savedSettings = useRef(initialSettings);
  const isDirty = settingsKeys.some((key) => settings[key] !== savedSettings.current[key]);

  async function loadConfig() {
    setLoading(true);
    setError(null);

    try {
      const [response, scrapersResponse] = await Promise.all([
        fetchLibraryConfig(),
        fetchInstalledScrapers(),
      ]);

      setSettings(response.settings);
      savedSettings.current = response.settings;
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
      });

      setSettings(updated);
      savedSettings.current = updated;
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
      });

      setMessage("Library root added.");
      setNewRootPath("");
      setNewRootLabel("");
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
    try {
      await updateLibraryRoot(root.id, { enabled: !root.enabled });
      await loadConfig();
    } catch (toggleError) {
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
            className="flex items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 text-xs text-text-muted transition-all duration-fast hover:bg-surface-3/60 hover:text-text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <button
            onClick={() => void handleRunScan()}
            className="flex items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 text-xs text-text-muted transition-all duration-fast hover:bg-surface-3/60 hover:text-text-primary"
          >
            <ScanSearch className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Run Scan</span>
          </button>
          <button
            onClick={() => void handleSaveSettings()}
            disabled={saving || !isDirty}
            className={cn(
              "flex items-center gap-1.5 rounded-[3px] px-4 py-1.5 text-xs font-medium transition-all duration-normal",
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
        <div className="surface-card-sharp no-lift border-l-2 border-status-error px-3 py-2 text-sm text-status-error-text">
          {error}
        </div>
      ) : null}
      {message && !error ? (
        <div className="surface-card-sharp no-lift border-l-2 border-status-success px-3 py-2 text-sm text-status-success-text">
          {message}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="h-4 w-4 text-text-accent" />
            <div>
              <h2 className="text-[0.9rem] font-heading font-semibold">Watched Libraries</h2>
              <p className="text-[0.68rem] text-text-muted">
                Add mounted folders to scan for media files
              </p>
            </div>
          </div>
          <button
            onClick={() => void openBrowser(browser?.path)}
            className={cn(
              "surface-card-sharp no-lift flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-xs font-medium text-text-muted transition-all duration-fast hover:border-border-accent hover:text-text-accent",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Browse Folder
          </button>
        </div>

        {browserVisible ? (
          <div className="surface-card-sharp no-lift space-y-3 border-border-accent/30 p-4">
            <div className="rounded-[3px] bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="truncate text-mono-sm text-text-accent">
                  {browser?.path ?? "Loading..."}
                </span>
                <button
                  onClick={() => void openBrowser(browser?.parentPath ?? browser?.path)}
                  disabled={!browser?.parentPath}
                  className="flex-shrink-0 rounded-[3px] px-2.5 py-1 text-xs text-text-muted transition-all hover:bg-surface-3/60 hover:text-text-primary disabled:opacity-40"
                >
                  Up One Level
                </button>
              </div>
              <div className="scrollbar-hidden grid max-h-[260px] gap-1.5 overflow-y-auto md:grid-cols-2">
                {browser?.directories.map((directory) => (
                  <button
                    key={directory.path}
                    type="button"
                    className="surface-card-sharp px-3 py-2 text-left"
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
              <button
                onClick={() => void handleAddRoot()}
                disabled={addingRoot || !newRootPath}
                className={cn(
                  "flex items-center gap-1.5 rounded-[3px] px-4 py-1.5 text-xs font-medium transition-all duration-normal",
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
                className="rounded-[3px] px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="surface-card-sharp no-lift flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-text-disabled" />
          </div>
        ) : roots.length === 0 ? (
          <div className="surface-card-sharp no-lift p-8 text-center">
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
                  "surface-card-sharp no-lift p-3.5 transition-opacity duration-fast",
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
                    <button
                      onClick={() => void handleToggleRoot(root)}
                      className="flex items-center gap-1 rounded-[3px] px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-primary"
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
                      className="flex items-center gap-1 rounded-[3px] px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error"
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
      <Link href="/scrapers" className="group block">
        <div
          className={cn(
            "surface-card-sharp no-lift p-4 transition-all duration-normal",
            "hover:border-border-accent hover:shadow-[var(--shadow-glow-accent)]",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-4.5 w-4.5 text-text-accent" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[0.9rem] font-heading font-semibold transition-colors duration-fast group-hover:text-text-accent">
                    Scrapers
                  </h2>
                  <span className="pill-accent px-1.5 py-0.5 text-[0.55rem]">{scraperCount}</span>
                </div>
                <p className="text-[0.68rem] text-text-muted">
                  Manage scrapers, browse community index, and configure capabilities
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-text-disabled transition-all duration-fast group-hover:translate-x-0.5 group-hover:text-text-accent" />
          </div>
        </div>
      </Link>

      <div className="border-t border-border-subtle" />
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <ScanSearch className="h-4 w-4 text-text-accent" />
          <div>
            <h2 className="text-[0.9rem] font-heading font-semibold">Generation Pipeline</h2>
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
            onChange={(checked) => setSettings((current) => ({ ...current, autoScanEnabled: checked }))}
          />
          <div className="surface-card-sharp no-lift p-3.5">
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
            onChange={(checked) =>
              setSettings((current) => ({ ...current, autoGenerateMetadata: checked }))
            }
          />
          <ToggleCard
            label="Fingerprints"
            description="MD5 and OpenSubtitles hashes for matching."
            checked={settings.autoGenerateFingerprints}
            onChange={(checked) =>
              setSettings((current) => ({ ...current, autoGenerateFingerprints: checked }))
            }
          />
          <ToggleCard
            label="Preview assets"
            description="Thumbnails and short preview clips."
            checked={settings.autoGeneratePreview}
            onChange={(checked) =>
              setSettings((current) => ({ ...current, autoGeneratePreview: checked }))
            }
          />
          <ToggleCard
            label="Trickplay strips"
            description="Sprite sheets for player scrub previews."
            checked={settings.generateTrickplay}
            onChange={(checked) =>
              setSettings((current) => ({ ...current, generateTrickplay: checked }))
            }
          />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="surface-card-sharp no-lift p-3.5">
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
          <div className="surface-card-sharp no-lift p-3.5">
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
      </section>

      <div className="border-t border-border-subtle" />
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <HardDrive className="h-4 w-4 text-text-accent" />
          <div>
            <h2 className="text-[0.9rem] font-heading font-semibold">Generated Storage</h2>
            <p className="text-[0.68rem] text-text-muted">Disk usage for rendered assets</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StorageStat
            label="Thumbnails"
            value={formatBytes(storage?.thumbnailsBytes ?? 0)}
            ratio={totalBytes > 0 ? (storage?.thumbnailsBytes ?? 0) / totalBytes : 0}
          />
          <StorageStat
            label="Preview clips"
            value={formatBytes(storage?.previewsBytes ?? 0)}
            ratio={totalBytes > 0 ? (storage?.previewsBytes ?? 0) / totalBytes : 0}
          />
          <StorageStat
            label="Trickplay sprites"
            value={formatBytes(storage?.trickplayBytes ?? 0)}
            ratio={totalBytes > 0 ? (storage?.trickplayBytes ?? 0) / totalBytes : 0}
          />
          <StorageStat label="Total" value={formatBytes(totalBytes)} accent />
        </div>
      </section>
    </div>
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
        "surface-card-sharp no-lift p-3.5 text-left transition-all duration-normal",
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

function StorageStat({
  accent,
  label,
  ratio,
  value,
}: {
  accent?: boolean;
  label: string;
  ratio?: number;
  value: string;
}) {
  return (
    <div className={accent ? "surface-stat-accent px-3 py-2.5" : "surface-stat px-3 py-2.5"}>
      <div className={`mb-1 ${accent ? "text-text-accent" : "text-text-disabled"}`}>
        <span className="text-kicker" style={{ color: "inherit" }}>
          {label}
        </span>
      </div>
      <div
        className={
          accent
            ? "text-lg font-semibold leading-tight text-text-accent"
            : "text-lg font-semibold leading-tight text-text-primary"
        }
      >
        {value}
      </div>
      {!accent ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-4">
          <div className="h-full bg-accent-500/70" style={{ width: `${Math.max((ratio ?? 0) * 100, 4)}%` }} />
        </div>
      ) : null}
    </div>
  );
}
