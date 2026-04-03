"use client";

import { useEffect, useState } from "react";
import { Button } from "@obscura/ui";
import {
  FolderOpen,
  HardDrive,
  Plus,
  RefreshCw,
  Save,
  ScanSearch,
  Trash2,
} from "lucide-react";
import {
  browseLibraryPath,
  createLibraryRoot,
  deleteLibraryRoot,
  fetchLibraryConfig,
  runQueue,
  updateLibraryRoot,
  updateLibrarySettings,
  type LibraryBrowse,
  type LibraryRoot,
  type LibrarySettings,
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

  async function loadConfig() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchLibraryConfig();
      setSettings(response.settings);
      setRoots(response.roots);
      setStorage(response.storage);
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
