"use client";

import { useEffect, useState } from "react";
import { Button } from "@obscura/ui";
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

  return (
    <div className="space-y-4">
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadConfig()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-text-muted hover:text-text-primary transition-colors duration-fast"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <button
            onClick={() => void handleRunScan()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-text-muted hover:text-text-primary transition-colors duration-fast"
          >
            <ScanSearch className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Run Scan</span>
          </button>
          <button
            onClick={() => void handleSaveSettings()}
            disabled={saving}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all duration-fast",
              "bg-accent-950 text-text-accent border border-border-accent",
              "hover:bg-accent-900 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="surface-well border-l-2 border-status-error px-3 py-2 text-sm text-status-error">
          {error}
        </div>
      )}
      {message && !error && (
        <div className="surface-well border-l-2 border-status-success px-3 py-2 text-sm text-status-success">
          {message}
        </div>
      )}

      {/* ─── Watched Libraries ────────────────────────────────── */}
      <section className="surface-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-text-accent" />
            <div>
              <h2 className="text-base font-heading font-semibold">Watched Libraries</h2>
              <p className="text-text-muted text-[0.72rem]">
                Add mounted folders to scan for media files
              </p>
            </div>
          </div>
          <button
            onClick={() => void openBrowser(browser?.path)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-text-muted hover:text-text-accent transition-colors duration-fast surface-well"
          >
            <Plus className="h-3.5 w-3.5" />
            Browse Folder
          </button>
        </div>

        {/* Folder browser */}
        {browserVisible && (
          <div className="surface-well p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
              <div>
                <label className="text-[0.68rem] text-text-muted font-medium mb-1 block uppercase tracking-wider">Selected Folder</label>
                <input
                  className="control-input w-full py-1.5 text-sm"
                  value={newRootPath}
                  onChange={(e) => setNewRootPath(e.target.value)}
                  placeholder="/mnt/library/scenes"
                />
              </div>
              <div>
                <label className="text-[0.68rem] text-text-muted font-medium mb-1 block uppercase tracking-wider">Label</label>
                <input
                  className="control-input w-full py-1.5 text-sm"
                  value={newRootLabel}
                  onChange={(e) => setNewRootLabel(e.target.value)}
                  placeholder="Primary scenes"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-[#c79b5c]"
                  checked={newRootRecursive}
                  onChange={(e) => setNewRootRecursive(e.target.checked)}
                />
                Scan subfolders recursively
              </label>
              <div className="flex-1" />
              <button
                onClick={() => void openBrowser(browser?.parentPath ?? browser?.path)}
                disabled={!browser?.parentPath}
                className="px-2.5 py-1.5 rounded text-xs text-text-muted hover:text-text-primary disabled:opacity-40 transition-colors"
              >
                Up One Level
              </button>
              <button
                onClick={() => { if (browser) setNewRootPath(browser.path); }}
                className="px-2.5 py-1.5 rounded text-xs text-text-muted hover:text-text-accent transition-colors"
              >
                Use Current Folder
              </button>
              <button
                onClick={() => void handleAddRoot()}
                disabled={addingRoot}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-fast",
                  "bg-accent-950 text-text-accent border border-border-accent",
                  "hover:bg-accent-900 disabled:opacity-50"
                )}
              >
                {addingRoot ? "Adding..." : "Add Library"}
              </button>
            </div>

            {/* Directory listing */}
            <div className="surface-panel p-3">
              <div className="mb-2">
                <span className="text-mono-sm text-text-secondary">{browser?.path ?? "Loading..."}</span>
              </div>
              <div className="grid gap-1.5 md:grid-cols-2">
                {browser?.directories.map((directory) => (
                  <button
                    key={directory.path}
                    type="button"
                    className="surface-card text-left px-3 py-2.5"
                    onClick={() => void openBrowser(directory.path)}
                  >
                    <p className="text-sm font-medium truncate">{directory.name}</p>
                    <p className="text-mono-sm text-text-disabled truncate">{directory.path}</p>
                  </button>
                ))}
                {browser && browser.directories.length === 0 && (
                  <p className="text-text-disabled text-xs col-span-full py-3 text-center">No child directories found.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Library roots */}
        {loading ? (
          <div className="surface-well p-8 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-text-disabled animate-spin" />
          </div>
        ) : roots.length === 0 ? (
          <div className="surface-well p-8 text-center">
            <FolderOpen className="h-8 w-8 text-text-disabled mx-auto mb-2" />
            <p className="text-text-muted text-sm">
              No library roots configured. Browse to a mounted folder to begin.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {roots.map((root) => (
              <div key={root.id} className={cn(
                "surface-well p-4 transition-opacity duration-fast",
                !root.enabled && "opacity-60"
              )}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{root.label}</p>
                    <p className="text-mono-sm text-text-disabled mt-0.5">{root.path}</p>
                    <p className="text-[0.65rem] text-text-disabled mt-1.5">
                      Last scanned: {formatTimestamp(root.lastScannedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => void handleToggleRoot(root)}
                      className="px-2.5 py-1.5 rounded text-xs text-text-muted hover:text-text-primary transition-colors"
                    >
                      {root.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => void handleDeleteRoot(root)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-text-muted hover:text-status-error transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Generation + Storage ─────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="surface-panel p-5 space-y-4">
          <div>
            <h2 className="text-base font-heading font-semibold">Generation Pipeline</h2>
            <p className="text-text-muted text-[0.72rem] mt-1">
              Control automatic scanning and how new files are enriched
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ToggleCard
              label="Automatic library scans"
              description="Queue scans on a recurring interval."
              checked={settings.autoScanEnabled}
              onChange={(checked) =>
                setSettings((c) => ({ ...c, autoScanEnabled: checked }))
              }
            />
            <div className="surface-well p-4">
              <label className="text-[0.68rem] text-text-muted font-medium mb-1.5 block uppercase tracking-wider">Scan Interval (min)</label>
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

          <div className="grid gap-3 md:grid-cols-2">
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

          <div className="grid gap-3 md:grid-cols-2">
            <div className="surface-well p-4">
              <label className="text-[0.68rem] text-text-muted font-medium mb-1.5 block uppercase tracking-wider">Trickplay Interval (sec)</label>
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
            <div className="surface-well p-4">
              <label className="text-[0.68rem] text-text-muted font-medium mb-1.5 block uppercase tracking-wider">Preview Clip Length (sec)</label>
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

        <section className="surface-panel p-5 space-y-4">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-text-accent" />
            <div>
              <h2 className="text-base font-heading font-semibold">Generated Storage</h2>
              <p className="text-text-muted text-[0.72rem]">
                Disk usage for rendered assets
              </p>
            </div>
          </div>
          <div className="surface-well p-4 space-y-3">
            <StorageRow label="Thumbnails" value={formatBytes(storage?.thumbnailsBytes ?? 0)} />
            <div className="separator" />
            <StorageRow label="Preview clips" value={formatBytes(storage?.previewsBytes ?? 0)} />
            <div className="separator" />
            <StorageRow label="Trickplay sprites" value={formatBytes(storage?.trickplayBytes ?? 0)} />
            <div className="separator" />
            <StorageRow label="Total" value={formatBytes(storage?.totalBytes ?? 0)} accent />
          </div>
        </section>
      </div>

      {/* ─── Scrapers Link ────────────────────────────────────── */}
      <Link href="/scrapers" className="block">
        <section className="surface-panel p-5 group cursor-pointer hover:border-border-accent transition-colors duration-fast">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-text-accent" />
              <div>
                <h2 className="text-base font-heading font-semibold group-hover:text-text-accent transition-colors duration-fast">Scrapers</h2>
                <p className="text-text-muted text-[0.72rem]">
                  {scraperCount} scraper{scraperCount !== 1 ? "s" : ""} installed — manage scrapers, browse community index, and configure capabilities
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-text-disabled group-hover:text-text-accent transition-colors duration-fast" />
          </div>
        </section>
      </Link>
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
    <div className="surface-well p-4">
      <label className="flex items-start justify-between gap-3 cursor-pointer">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-text-disabled text-[0.68rem] mt-0.5">{description}</p>
        </div>
        <input
          type="checkbox"
          className="accent-[#c79b5c] mt-0.5"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
    </div>
  );
}

function StorageRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={accent ? "text-text-secondary text-sm font-medium" : "text-text-muted text-sm"}>{label}</span>
      <span className={cn("text-mono-sm", accent ? "text-text-accent font-medium" : "text-text-secondary")}>{value}</span>
    </div>
  );
}
