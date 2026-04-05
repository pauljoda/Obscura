"use client";

import { useEffect, useState } from "react";
import { cn } from "@obscura/ui";
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
import Link from "next/link";
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
  type ScraperPackage,
  type StorageStats,
} from "../../../lib/api";

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

const defaultSettings: LibrarySettings = {
  id: "pending",
  autoScanEnabled: false,
  scanIntervalMinutes: 60,
  autoGenerateMetadata: true,
  autoGenerateFingerprints: true,
  autoGeneratePreview: true,
  generateTrickplay: true,
  trickplayIntervalSeconds: 10,
  previewClipDurationSeconds: 8,
  createdAt: "",
  updatedAt: "",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<LibrarySettings>(defaultSettings);
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [browser, setBrowser] = useState<LibraryBrowse | null>(null);
  const [browserVisible, setBrowserVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingRoot, setAddingRoot] = useState(false);
  const [newRootPath, setNewRootPath] = useState("");
  const [newRootLabel, setNewRootLabel] = useState("");
  const [newRootRecursive, setNewRootRecursive] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Scrapers summary
  const [scraperCount, setScraperCount] = useState(0);

  async function loadConfig() {
    setLoading(true);
    setError(null);

    try {
      const [response, scrapersRes] = await Promise.all([
        fetchLibraryConfig(),
        fetchInstalledScrapers(),
      ]);
      setSettings(response.settings);
      setRoots(response.roots);
      setStorage(response.storage);
      setScraperCount(scrapersRes.packages.length);
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

  useEffect(() => {
    void loadConfig();
  }, []);

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
    <div className="space-y-3">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Settings className="h-5 w-5 text-text-accent" />
            Settings
          </h1>
          <p className="text-text-muted text-[0.78rem] mt-1">
            Configure libraries, generation pipeline, and scrapers
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void loadConfig()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-xs text-text-muted hover:text-text-primary hover:bg-surface-3/60 transition-all duration-fast"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <button
            onClick={() => void handleRunScan()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-xs text-text-muted hover:text-text-primary hover:bg-surface-3/60 transition-all duration-fast"
          >
            <ScanSearch className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Run Scan</span>
          </button>
          <button
            onClick={() => void handleSaveSettings()}
            disabled={saving}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-[3px] text-xs font-medium transition-all duration-normal",
              "bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900",
              "text-accent-200 border border-border-accent shadow-[var(--shadow-glow-accent)]",
              "hover:shadow-[var(--shadow-glow-accent-strong)] hover:border-border-accent-strong",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="surface-card-sharp no-lift border-l-2 border-status-error px-3 py-2 text-sm text-status-error-text">
          {error}
        </div>
      )}
      {message && !error && (
        <div className="surface-card-sharp no-lift border-l-2 border-status-success px-3 py-2 text-sm text-status-success-text">
          {message}
        </div>
      )}

      {/* ─── Watched Libraries ────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="h-4 w-4 text-text-accent" />
            <div>
              <h2 className="text-[0.9rem] font-heading font-semibold">Watched Libraries</h2>
              <p className="text-text-muted text-[0.68rem]">
                Add mounted folders to scan for media files
              </p>
            </div>
          </div>
          <button
            onClick={() => void openBrowser(browser?.path)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-medium transition-all duration-fast",
              "surface-card-sharp no-lift text-text-muted hover:text-text-accent hover:border-border-accent"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Browse Folder
          </button>
        </div>

        {/* Folder browser */}
        {browserVisible && (
          <div className="surface-card-sharp no-lift p-4 space-y-3 border-border-accent/30">
            {/* Directory listing */}
            <div className="rounded-[3px] bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-mono-sm text-text-accent truncate">{browser?.path ?? "Loading..."}</span>
                <button
                  onClick={() => void openBrowser(browser?.parentPath ?? browser?.path)}
                  disabled={!browser?.parentPath}
                  className="px-2.5 py-1 rounded-[3px] text-xs text-text-muted hover:text-text-primary hover:bg-surface-3/60 disabled:opacity-40 transition-all flex-shrink-0"
                >
                  Up One Level
                </button>
              </div>
              <div className="grid gap-1.5 md:grid-cols-2 max-h-[260px] overflow-y-auto scrollbar-hidden">
                {browser?.directories.map((directory) => (
                  <button
                    key={directory.path}
                    type="button"
                    className="surface-card-sharp text-left px-3 py-2"
                    onClick={() => void openBrowser(directory.path)}
                  >
                    <p className="text-[0.8rem] font-medium truncate">{directory.name}</p>
                    <p className="text-mono-sm text-text-disabled truncate">{directory.path}</p>
                  </button>
                ))}
                {browser && browser.directories.length === 0 && (
                  <p className="text-text-disabled text-xs col-span-full py-3 text-center">No child directories found.</p>
                )}
              </div>
            </div>

            {/* Add controls */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className="control-label mb-1">Label (optional)</label>
                <input
                  className="control-input w-full py-1.5 text-sm"
                  value={newRootLabel}
                  onChange={(e) => setNewRootLabel(e.target.value)}
                  placeholder="Primary scenes"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer pb-2">
                <input
                  type="checkbox"
                  className="accent-[#c79b5c]"
                  checked={newRootRecursive}
                  onChange={(e) => setNewRootRecursive(e.target.checked)}
                />
                Recursive
              </label>
              <button
                onClick={() => void handleAddRoot()}
                disabled={addingRoot || !newRootPath}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-[3px] text-xs font-medium transition-all duration-normal",
                  "bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900",
                  "text-accent-200 border border-border-accent shadow-[var(--shadow-glow-accent)]",
                  "hover:shadow-[var(--shadow-glow-accent-strong)] disabled:opacity-50"
                )}
              >
                {addingRoot ? "Adding..." : "Add Library"}
              </button>
              <button
                onClick={() => { setBrowserVisible(false); setNewRootPath(""); setNewRootLabel(""); }}
                className="px-2.5 py-1.5 rounded-[3px] text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Library roots */}
        {loading ? (
          <div className="surface-card-sharp no-lift p-8 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-text-disabled animate-spin" />
          </div>
        ) : roots.length === 0 ? (
          <div className="surface-card-sharp no-lift p-8 text-center">
            <FolderOpen className="h-8 w-8 text-text-disabled mx-auto mb-2" />
            <p className="text-text-muted text-sm">
              No library roots configured. Browse to a mounted folder to begin.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {roots.map((root) => (
              <div key={root.id} className={cn(
                "surface-card-sharp no-lift p-3.5 transition-opacity duration-fast",
                !root.enabled && "opacity-50"
              )}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className={cn(
                      "led flex-shrink-0",
                      root.enabled ? "led-active" : "led-idle"
                    )} />
                    <div className="min-w-0">
                      <p className="text-[0.8rem] font-semibold">{root.label}</p>
                      <p className="text-mono-sm text-text-disabled mt-0.5 truncate">{root.path}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[0.62rem] text-text-disabled">
                      {formatTimestamp(root.lastScannedAt)}
                    </span>
                    <button
                      onClick={() => void handleToggleRoot(root)}
                      className="flex items-center gap-1 px-2 py-1 rounded-[3px] text-xs text-text-muted hover:text-text-primary transition-colors"
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
                      className="flex items-center gap-1 px-2 py-1 rounded-[3px] text-xs text-text-muted hover:text-status-error transition-colors"
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

      {/* ─── Scrapers Link ────────────────────────────────────── */}
      <Link href="/scrapers" className="block group">
        <div className={cn(
          "surface-card-sharp no-lift p-4 transition-all duration-normal",
          "hover:border-border-accent hover:shadow-[var(--shadow-glow-accent)]"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-4.5 w-4.5 text-text-accent" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[0.9rem] font-heading font-semibold group-hover:text-text-accent transition-colors duration-fast">Scrapers</h2>
                  <span className="pill-accent px-1.5 py-0.5 text-[0.55rem]">{scraperCount}</span>
                </div>
                <p className="text-text-muted text-[0.68rem]">
                  Manage scrapers, browse community index, and configure capabilities
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-text-disabled group-hover:text-text-accent group-hover:translate-x-0.5 transition-all duration-fast" />
          </div>
        </div>
      </Link>

      {/* ─── Generation Pipeline ──────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center gap-2.5 px-1">
          <ScanSearch className="h-4 w-4 text-text-accent" />
          <div>
            <h2 className="text-[0.9rem] font-heading font-semibold">Generation Pipeline</h2>
            <p className="text-text-muted text-[0.68rem]">
              Control automatic scanning and how new files are enriched
            </p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <ToggleCard
            label="Automatic library scans"
            description="Queue scans on a recurring interval."
            checked={settings.autoScanEnabled}
            onChange={(checked) =>
              setSettings((c) => ({ ...c, autoScanEnabled: checked }))
            }
          />
          <div className="surface-card-sharp no-lift p-3.5">
            <label className="control-label mb-1.5">Scan Interval (min)</label>
            <input
              className="control-input w-full py-1.5 text-sm"
              type="number"
              min={5}
              step={5}
              value={settings.scanIntervalMinutes}
              onChange={(e) =>
                setSettings((c) => ({ ...c, scanIntervalMinutes: Number(e.target.value) || 5 }))
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
              setSettings((c) => ({ ...c, autoGenerateMetadata: checked }))
            }
          />
          <ToggleCard
            label="Fingerprints"
            description="MD5 and OpenSubtitles hashes for matching."
            checked={settings.autoGenerateFingerprints}
            onChange={(checked) =>
              setSettings((c) => ({ ...c, autoGenerateFingerprints: checked }))
            }
          />
          <ToggleCard
            label="Preview assets"
            description="Thumbnails and short preview clips."
            checked={settings.autoGeneratePreview}
            onChange={(checked) =>
              setSettings((c) => ({ ...c, autoGeneratePreview: checked }))
            }
          />
          <ToggleCard
            label="Trickplay strips"
            description="Sprite sheets for player scrub previews."
            checked={settings.generateTrickplay}
            onChange={(checked) =>
              setSettings((c) => ({ ...c, generateTrickplay: checked }))
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
              onChange={(e) =>
                setSettings((c) => ({ ...c, trickplayIntervalSeconds: Number(e.target.value) || 3 }))
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
              onChange={(e) =>
                setSettings((c) => ({ ...c, previewClipDurationSeconds: Number(e.target.value) || 4 }))
              }
            />
          </div>
        </div>
      </section>

      {/* ─── Generated Storage ────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center gap-2.5 px-1">
          <HardDrive className="h-4 w-4 text-text-accent" />
          <div>
            <h2 className="text-[0.9rem] font-heading font-semibold">Generated Storage</h2>
            <p className="text-text-muted text-[0.68rem]">
              Disk usage for rendered assets
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
          <StorageStat
            label="Total"
            value={formatBytes(totalBytes)}
            accent
          />
        </div>
      </section>
    </div>
  );
}

function ToggleCard({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "surface-card-sharp no-lift p-3.5 text-left transition-all duration-normal",
        checked && "border-border-accent/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.8rem] font-medium">{label}</p>
          <p className="text-text-disabled text-[0.65rem] mt-0.5">{description}</p>
        </div>
        <div className={cn(
          "led mt-0.5 flex-shrink-0",
          checked ? "led-active" : "led-idle"
        )} />
      </div>
    </button>
  );
}

function StorageStat({
  label,
  value,
  ratio,
  accent,
}: {
  label: string;
  value: string;
  ratio?: number;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      accent ? "surface-stat-accent" : "surface-stat",
      "px-3 py-2.5"
    )}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn(
          "text-kicker",
          !accent && "!text-text-disabled"
        )}>{label}</span>
      </div>
      <div className={cn(
        "text-lg font-semibold leading-tight",
        accent ? "text-text-accent" : "text-text-primary"
      )}>
        {value}
      </div>
      {ratio !== undefined && (
        <div className="meter-track mt-2">
          <div
            className="meter-fill"
            style={{ width: `${Math.max(ratio * 100, 2)}%` }}
          />
        </div>
      )}
    </div>
  );
}
