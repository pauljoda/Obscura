"use client";

import { useEffect, useState } from "react";
import { Button, Badge } from "@obscura/ui";
import {
  Check,
  Download,
  FolderOpen,
  HardDrive,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  ScanSearch,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import {
  browseLibraryPath,
  createLibraryRoot,
  deleteLibraryRoot,
  fetchCommunityIndex,
  fetchInstalledScrapers,
  fetchLibraryConfig,
  installScraper,
  runQueue,
  toggleScraper,
  uninstallScraper,
  updateLibraryRoot,
  updateLibrarySettings,
  type CommunityIndexEntry,
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

  // Scrapers state
  const [scraperPkgs, setScraperPkgs] = useState<ScraperPackage[]>([]);
  const [indexEntries, setIndexEntries] = useState<CommunityIndexEntry[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [showIndex, setShowIndex] = useState(false);
  const [scraperSearch, setScraperSearch] = useState("");

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
      setScraperPkgs(scrapersRes.packages);
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

  async function loadScraperIndex(force = false) {
    setIndexLoading(true);
    setError(null);
    try {
      const res = await fetchCommunityIndex(force);
      // Mark already-installed entries
      const installedIds = new Set(scraperPkgs.map((p) => p.packageId));
      setIndexEntries(
        res.entries.map((e) => ({ ...e, installed: installedIds.has(e.id) }))
      );
      setShowIndex(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch community index");
    } finally {
      setIndexLoading(false);
    }
  }

  async function handleInstallScraper(packageId: string) {
    setInstallingId(packageId);
    setError(null);
    try {
      await installScraper(packageId);
      setMessage(`Installed ${packageId}`);
      const res = await fetchInstalledScrapers();
      setScraperPkgs(res.packages);
      setIndexEntries((prev) =>
        prev.map((e) => (e.id === packageId ? { ...e, installed: true } : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to install ${packageId}`);
    } finally {
      setInstallingId(null);
    }
  }

  async function handleUninstallScraper(pkg: ScraperPackage) {
    setError(null);
    try {
      await uninstallScraper(pkg.id);
      setMessage(`Removed ${pkg.name}`);
      const res = await fetchInstalledScrapers();
      setScraperPkgs(res.packages);
      setIndexEntries((prev) =>
        prev.map((e) => (e.id === pkg.packageId ? { ...e, installed: false } : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove scraper");
    }
  }

  async function handleToggleScraper(pkg: ScraperPackage) {
    try {
      const updated = await toggleScraper(pkg.id, !pkg.enabled);
      setScraperPkgs((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle scraper");
    }
  }

  const filteredIndex = scraperSearch
    ? indexEntries.filter(
        (e) =>
          e.name.toLowerCase().includes(scraperSearch.toLowerCase()) ||
          e.id.toLowerCase().includes(scraperSearch.toLowerCase())
      )
    : indexEntries;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Settings</h1>
          <p className="mt-1 text-text-muted text-sm">
            Configure watched libraries and the background generation pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void loadConfig()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleRunScan()}>
            <ScanSearch className="h-3.5 w-3.5" />
            Run Scan
          </Button>
          <Button size="sm" onClick={() => void handleSaveSettings()} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {(message || error) && (
        <div className={error ? "surface-panel border border-error/20 p-3 text-error-text text-sm" : "surface-panel border border-border-accent p-3 text-text-secondary text-sm"}>
          {error ?? message}
        </div>
      )}

      <section className="surface-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-accent-500" />
            <div>
              <h2 className="text-base">Watched Libraries</h2>
              <p className="text-text-muted text-sm">
                Add mounted folders that should be scanned for media files.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void openBrowser(browser?.path)}>
            <Plus className="h-3.5 w-3.5" />
            Browse Folder
          </Button>
        </div>

        {browserVisible && (
          <div className="surface-well p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
              <div>
                <label className="control-label">Selected Folder</label>
                <input
                  className="control-input"
                  value={newRootPath}
                  onChange={(event) => setNewRootPath(event.target.value)}
                  placeholder="/mnt/library/scenes"
                />
              </div>
              <div>
                <label className="control-label">Label</label>
                <input
                  className="control-input"
                  value={newRootLabel}
                  onChange={(event) => setNewRootLabel(event.target.value)}
                  placeholder="Primary scenes"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  className="control-checkbox"
                  type="checkbox"
                  checked={newRootRecursive}
                  onChange={(event) => setNewRootRecursive(event.target.checked)}
                />
                Scan subfolders recursively
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void openBrowser(browser?.parentPath ?? browser?.path)}
                disabled={!browser?.parentPath}
              >
                Up One Level
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (browser) setNewRootPath(browser.path);
                }}
              >
                Use Current Folder
              </Button>
              <Button size="sm" onClick={() => void handleAddRoot()} disabled={addingRoot}>
                {addingRoot ? "Adding..." : "Add Library"}
              </Button>
            </div>

            <div className="surface-panel p-3">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-label text-text-muted">Folder Browser</p>
                  <p className="text-mono text-text-secondary">{browser?.path ?? "Loading..."}</p>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {browser?.directories.map((directory) => (
                  <button
                    key={directory.path}
                    type="button"
                    className="surface-card text-left px-3 py-2.5"
                    onClick={() => void openBrowser(directory.path)}
                  >
                    <p className="text-sm font-medium truncate">{directory.name}</p>
                    <p className="text-mono-sm text-text-muted truncate">{directory.path}</p>
                  </button>
                ))}
                {browser && browser.directories.length === 0 && (
                  <p className="text-text-muted text-sm">No child directories found in this folder.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="surface-well p-4 text-text-muted text-sm">Loading library roots...</div>
        ) : roots.length === 0 ? (
          <div className="surface-well p-4 text-center">
            <p className="text-text-muted text-sm">
              No library roots configured. Browse to a mounted folder to begin scanning.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {roots.map((root) => (
              <div key={root.id} className="surface-well p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{root.label}</p>
                    <p className="text-mono-sm text-text-muted mt-1">{root.path}</p>
                    <p className="text-text-disabled text-xs mt-2">
                      Last scanned: {formatTimestamp(root.lastScannedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void handleToggleRoot(root)}>
                      {root.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => void handleDeleteRoot(root)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="surface-panel p-5 space-y-4">
          <div>
            <h2 className="text-base">Generation Schedule</h2>
            <p className="text-text-muted text-sm mt-1">
              Control automatic scanning and how newly discovered files are enriched.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="surface-well p-4">
              <label className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Automatic library scans</p>
                  <p className="text-text-muted text-xs mt-1">
                    Queue scans on a recurring interval without manual intervention.
                  </p>
                </div>
                <input
                  className="control-checkbox"
                  type="checkbox"
                  checked={settings.autoScanEnabled}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      autoScanEnabled: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>

            <div>
              <label className="control-label">Scan Interval (minutes)</label>
              <input
                className="control-input"
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

          <div className="grid gap-4 md:grid-cols-2">
            <ToggleCard
              label="Generate technical metadata"
              description="Use ffprobe to fill runtime, resolution, codec, and bitrate fields."
              checked={settings.autoGenerateMetadata}
              onChange={(checked) =>
                setSettings((current) => ({ ...current, autoGenerateMetadata: checked }))
              }
            />
            <ToggleCard
              label="Generate fingerprints"
              description="Calculate md5 and OpenSubtitles hashes for duplicate and match workflows."
              checked={settings.autoGenerateFingerprints}
              onChange={(checked) =>
                setSettings((current) => ({ ...current, autoGenerateFingerprints: checked }))
              }
            />
            <ToggleCard
              label="Generate preview assets"
              description="Render thumbnail posters and short preview clips for the library."
              checked={settings.autoGeneratePreview}
              onChange={(checked) =>
                setSettings((current) => ({ ...current, autoGeneratePreview: checked }))
              }
            />
            <ToggleCard
              label="Generate trickplay strips"
              description="Build sprite sheets and VTT maps so the player can support scrub previews."
              checked={settings.generateTrickplay}
              onChange={(checked) =>
                setSettings((current) => ({ ...current, generateTrickplay: checked }))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="control-label">Trickplay Interval (seconds)</label>
              <input
                className="control-input"
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

            <div>
              <label className="control-label">Preview Clip Length (seconds)</label>
              <input
                className="control-input"
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

        <section className="surface-panel p-5 space-y-4">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-accent-500" />
            <div>
              <h2 className="text-base">Generated Storage</h2>
              <p className="text-text-muted text-sm">
                Disk usage for rendered assets managed by the worker.
              </p>
            </div>
          </div>
          <div className="surface-well p-4 space-y-3 text-mono-sm">
            <StorageRow label="Thumbnails" value={formatBytes(storage?.thumbnailsBytes ?? 0)} />
            <div className="separator" />
            <StorageRow label="Preview clips" value={formatBytes(storage?.previewsBytes ?? 0)} />
            <div className="separator" />
            <StorageRow label="Trickplay sprites" value={formatBytes(storage?.trickplayBytes ?? 0)} />
            <div className="separator" />
            <StorageRow label="Total" value={formatBytes(storage?.totalBytes ?? 0)} />
          </div>
        </section>
      </div>

      {/* ─── Scrapers Section ─────────────────────────────────── */}
      <section className="surface-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-accent-500" />
            <div>
              <h2 className="text-base">Scrapers</h2>
              <p className="text-text-muted text-sm">
                {scraperPkgs.length} scraper{scraperPkgs.length !== 1 ? "s" : ""} installed
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadScraperIndex(true)}
            disabled={indexLoading}
          >
            {indexLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {showIndex ? "Refresh Index" : "Browse Community Index"}
          </Button>
        </div>

        {scraperPkgs.length === 0 ? (
          <div className="surface-well p-6 text-center">
            <p className="text-text-muted text-sm">
              No scrapers installed yet. Browse the community index to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {scraperPkgs.map((pkg) => (
              <div key={pkg.id} className="surface-well p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{pkg.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-mono-sm text-text-muted">{pkg.packageId}</span>
                      <Badge
                        variant={pkg.enabled ? "accent" : "default"}
                        className="text-[0.6rem]"
                      >
                        {pkg.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    {pkg.capabilities && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(pkg.capabilities)
                          .filter(([, v]) => v)
                          .map(([key]) => (
                            <span
                              key={key}
                              className="tag-chip-default text-[0.6rem] px-1.5 py-0.5"
                            >
                              {key}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleToggleScraper(pkg)}
                    >
                      {pkg.enabled ? (
                        <ToggleRight className="h-3.5 w-3.5" />
                      ) : (
                        <ToggleLeft className="h-3.5 w-3.5" />
                      )}
                      {pkg.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void handleUninstallScraper(pkg)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showIndex && (
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Community Index</h3>
                <p className="text-text-muted text-xs">
                  {indexEntries.length} scrapers available
                </p>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
                <input
                  className="control-input pl-8 w-64"
                  placeholder="Filter scrapers..."
                  value={scraperSearch}
                  onChange={(e) => setScraperSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2 max-h-[400px] overflow-y-auto scrollbar-hidden">
              {filteredIndex.map((entry) => (
                <div
                  key={entry.id}
                  className="surface-well px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entry.name}</p>
                    <p className="text-text-disabled text-xs mt-0.5">
                      {entry.date}
                      {entry.requires?.length
                        ? ` · requires: ${entry.requires.join(", ")}`
                        : ""}
                    </p>
                  </div>
                  {entry.installed ? (
                    <Badge variant="accent" className="text-[0.6rem] flex-shrink-0">
                      <Check className="h-2.5 w-2.5 mr-1" />
                      Installed
                    </Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleInstallScraper(entry.id)}
                      disabled={installingId === entry.id}
                    >
                      {installingId === entry.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Install
                    </Button>
                  )}
                </div>
              ))}
              {filteredIndex.length === 0 && (
                <div className="text-text-muted text-sm text-center py-6">
                  {scraperSearch ? "No scrapers match your search." : "Index is empty."}
                </div>
              )}
            </div>
          </div>
        )}
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
    <div className="surface-well p-4">
      <label className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-text-muted text-xs mt-1">{description}</p>
        </div>
        <input
          className="control-checkbox mt-1"
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
    </div>
  );
}

function StorageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
