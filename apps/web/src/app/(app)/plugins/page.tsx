"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "@obscura/ui";
import { cn } from "@obscura/ui/lib/utils";
import {
  AlertCircle,
  Boxes,
  Check,
  Download,
  Film,
  Globe,
  KeyRound,
  Loader2,
  Package,
  Pencil,
  Plug,
  Plus,
  Puzzle,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  fetchCommunityIndex,
  fetchInstalledScrapers,
  fetchStashBoxEndpoints,
  fetchObscuraPluginIndex,
  fetchInstalledPlugins,
  installObscuraPlugin,
  installScraper,
  uninstallScraper,
  uninstallPlugin,
  toggleScraper,
  togglePlugin,
  savePluginAuthKey,
  createStashBoxEndpoint,
  updateStashBoxEndpoint,
  deleteStashBoxEndpoint,
  testStashBoxEndpoint,
  type CommunityIndexEntry,
  type ScraperPackage,
  type StashBoxEndpoint,
  type ObscuraPluginIndexEntry,
  type InstalledPlugin,
} from "../../../lib/api";
import { entityTerms } from "../../../lib/terminology";
import { useNsfw } from "../../../components/nsfw/nsfw-context";

/* ─── Constants ──────────────────────────────────────────────── */

const CAPABILITY_META: Record<string, { label: string; category: string }> = {
  sceneByURL: { label: "Video by URL", category: "scene" },
  sceneByFragment: { label: "Video by fragment", category: "scene" },
  sceneByName: { label: "Video by name", category: "scene" },
  sceneByQueryFragment: { label: "Video by query", category: "scene" },
  performerByURL: { label: "Actor by URL", category: "performer" },
  performerByName: { label: "Actor by name", category: "performer" },
  performerByFragment: { label: "Actor by fragment", category: "performer" },
  galleryByURL: { label: "Gallery by URL", category: "gallery" },
  galleryByFragment: { label: "Gallery by fragment", category: "gallery" },
  groupByURL: { label: "Group by URL", category: "group" },
  // Obscura-native capabilities
  videoByURL: { label: "Video by URL", category: "scene" },
  videoByName: { label: "Video by name", category: "scene" },
  folderByName: { label: "Series by name", category: "folder" },
  folderCascade: { label: "Episode cascade", category: "folder" },
  audioByURL: { label: "Audio by URL", category: "audio" },
  audioLibraryByName: { label: "Album by name", category: "audio" },
};

type PluginsTab = "installed" | "obscura-index" | "stash-index" | "stashbox";
type CapFilter = "all" | "scene" | "performer";

/* ─── Page component ─────────────────────────────────────────── */

export default function PluginsPage() {
  const { mode } = useNsfw();
  const isSfw = mode === "off";

  // Default tab: in SFW mode, default to installed (stash tabs hidden)
  const [tab, setTab] = useState<PluginsTab>("installed");

  // Installed state (stash scrapers + obscura plugins)
  const [installed, setInstalled] = useState<ScraperPackage[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [capFilter, setCapFilter] = useState<CapFilter>("all");
  const [installedSearch, setInstalledSearch] = useState("");

  // Stash community index state
  const [indexEntries, setIndexEntries] = useState<CommunityIndexEntry[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const [indexLoaded, setIndexLoaded] = useState(false);
  const [indexSearch, setIndexSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [bulkInstalling, setBulkInstalling] = useState(false);

  // Obscura plugin index state
  const [obscuraEntries, setObscuraEntries] = useState<ObscuraPluginIndexEntry[]>([]);
  const [obscuraLoading, setObscuraLoading] = useState(false);
  const [obscuraLoaded, setObscuraLoaded] = useState(false);
  const [obscuraSearch, setObscuraSearch] = useState("");
  const [obscuraInstallingId, setObscuraInstallingId] = useState<string | null>(null);

  // StashBox state
  const [stashBoxEndpoints, setStashBoxEndpoints] = useState<StashBoxEndpoint[]>([]);
  const [showStashBoxForm, setShowStashBoxForm] = useState(false);
  const [editingStashBox, setEditingStashBox] = useState<StashBoxEndpoint | null>(null);
  const [sbName, setSbName] = useState("");
  const [sbEndpoint, setSbEndpoint] = useState("");
  const [sbApiKey, setSbApiKey] = useState("");
  const [sbSaving, setSbSaving] = useState(false);
  const [sbTesting, setSbTesting] = useState<string | null>(null);
  const [sbTestResult, setSbTestResult] = useState<{ id: string; valid: boolean; error?: string } | null>(null);

  // Messages
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flashMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  // If in SFW mode and on a stash tab, redirect to installed
  useEffect(() => {
    if (isSfw && (tab === "stash-index" || tab === "stashbox")) {
      setTab("installed");
    }
  }, [isSfw, tab]);

  /* ─── Data loading ────────────────────────────────────────── */

  const loadInstalled = useCallback(async () => {
    try {
      const [scrapersRes, endpointsRes, pluginsRes] = await Promise.all([
        fetchInstalledScrapers(),
        fetchStashBoxEndpoints().catch(() => ({ endpoints: [] })),
        fetchInstalledPlugins().catch(() => [] as InstalledPlugin[]),
      ]);
      setInstalled(scrapersRes.packages);
      setStashBoxEndpoints(endpointsRes.endpoints);
      setInstalledPlugins(pluginsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plugins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInstalled();
  }, [loadInstalled]);

  async function loadStashIndex(force = false) {
    setIndexLoading(true);
    setError(null);
    try {
      const res = await fetchCommunityIndex(force);
      setIndexEntries(res.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch community index");
    } finally {
      setIndexLoaded(true); // Mark loaded even on error to prevent re-fetch loop
      setIndexLoading(false);
    }
  }

  async function loadObscuraIndex() {
    setObscuraLoading(true);
    setError(null);
    try {
      const entries = await fetchObscuraPluginIndex();
      setObscuraEntries(entries);
    } catch (err) {
      // Don't show error for 404 — just means the index isn't configured yet
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("404") && !msg.includes("not found") && !msg.includes("not configured")) {
        setError(msg);
      }
    } finally {
      setObscuraLoaded(true); // Mark loaded even on error to prevent re-fetch loop
      setObscuraLoading(false);
    }
  }

  // Auto-load indices when switching tabs
  useEffect(() => {
    if (tab === "stash-index" && !indexLoaded && !indexLoading) {
      void loadStashIndex();
    }
    if (tab === "obscura-index" && !obscuraLoaded && !obscuraLoading) {
      void loadObscuraIndex();
    }
  }, [tab, indexLoaded, indexLoading, obscuraLoaded, obscuraLoading]);

  /* ─── Installed scraper actions ────────────────────────────── */

  async function handleToggle(pkg: ScraperPackage) {
    try {
      const updated = await toggleScraper(pkg.id, !pkg.enabled);
      setInstalled((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle");
    }
  }

  async function handleUninstall(pkg: ScraperPackage) {
    setError(null);
    try {
      await uninstallScraper(pkg.id);
      flashMessage(`Removed ${pkg.name}`);
      await loadInstalled();
      setIndexEntries((prev) =>
        prev.map((e) => (e.id === pkg.packageId ? { ...e, installed: false } : e)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  /* ─── Stash community index actions ────────────────────────── */

  async function handleInstall(packageId: string) {
    setInstallingId(packageId);
    setError(null);
    try {
      await installScraper(packageId);
      flashMessage(`Installed ${packageId}`);
      await loadInstalled();
      setIndexEntries((prev) =>
        prev.map((e) => (e.id === packageId ? { ...e, installed: true } : e)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to install ${packageId}`);
    } finally {
      setInstallingId(null);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredIndex = indexSearch
    ? indexEntries.filter(
        (e) =>
          e.name.toLowerCase().includes(indexSearch.toLowerCase()) ||
          e.id.toLowerCase().includes(indexSearch.toLowerCase()),
      )
    : indexEntries;

  const selectableCount = filteredIndex.filter((e) => !e.installed).length;
  const selectedUninstalledCount = Array.from(selected).filter(
    (id) => !indexEntries.find((e) => e.id === id)?.installed,
  ).length;

  function selectAllUninstalled() {
    const uninstalled = filteredIndex.filter((e) => !e.installed).map((e) => e.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = uninstalled.every((id) => next.has(id));
      if (allSelected) {
        for (const id of uninstalled) next.delete(id);
      } else {
        for (const id of uninstalled) next.add(id);
      }
      return next;
    });
  }

  async function handleBulkInstall() {
    if (selected.size === 0) return;
    setBulkInstalling(true);
    setError(null);
    const toInstall = Array.from(selected).filter(
      (id) => !indexEntries.find((e) => e.id === id)?.installed,
    );
    let count = 0;
    for (const packageId of toInstall) {
      try {
        await installScraper(packageId);
        count++;
        setIndexEntries((prev) =>
          prev.map((e) => (e.id === packageId ? { ...e, installed: true } : e)),
        );
      } catch (err) {
        setError(`Failed to install ${packageId}: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
    }
    if (count > 0) {
      flashMessage(`Installed ${count} scraper${count !== 1 ? "s" : ""}`);
      await loadInstalled();
    }
    setSelected(new Set());
    setBulkInstalling(false);
  }

  /* ─── Obscura plugin install ────────────────────────────────── */

  async function handleObscuraInstall(entry: ObscuraPluginIndexEntry) {
    setObscuraInstallingId(entry.id);
    setError(null);
    try {
      await installObscuraPlugin(entry.id, {
        localPath: entry.localPath,
        zipUrl: entry.localPath ? undefined : entry.path,
        sha256: entry.sha256 || undefined,
      });
      flashMessage(`Installed ${entry.name}`);
      setObscuraEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, installed: true } : e)),
      );
      await loadInstalled();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to install ${entry.name}`);
    } finally {
      setObscuraInstallingId(null);
    }
  }

  /* ─── Installed filtering ──────────────────────────────────── */

  // In SFW mode, hide all NSFW (stash) scrapers from the installed list
  const visibleInstalled = isSfw ? installed.filter((p) => !p.isNsfw) : installed;
  const visiblePlugins = isSfw ? installedPlugins.filter((p) => !p.isNsfw) : installedPlugins;

  const filteredInstalled = visibleInstalled.filter((pkg) => {
    if (installedSearch) {
      const q = installedSearch.toLowerCase();
      if (!pkg.name.toLowerCase().includes(q) && !pkg.packageId.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (capFilter === "all") return true;
    const caps = pkg.capabilities as Record<string, boolean> | null;
    if (!caps) return false;
    if (capFilter === "scene")
      return caps.sceneByURL || caps.sceneByFragment || caps.sceneByName || caps.sceneByQueryFragment;
    if (capFilter === "performer")
      return caps.performerByURL || caps.performerByName || caps.performerByFragment;
    return true;
  });

  const videoCount = visibleInstalled.filter((pkg) => {
    const caps = pkg.capabilities as Record<string, boolean> | null;
    return caps && (caps.sceneByURL || caps.sceneByFragment || caps.sceneByName);
  }).length;
  const performerCount = visibleInstalled.filter((pkg) => {
    const caps = pkg.capabilities as Record<string, boolean> | null;
    return caps && (caps.performerByURL || caps.performerByName || caps.performerByFragment);
  }).length;

  /* ─── Obscura index filtering ──────────────────────────────── */

  const filteredObscura = obscuraSearch
    ? obscuraEntries.filter(
        (e) =>
          e.name.toLowerCase().includes(obscuraSearch.toLowerCase()) ||
          e.id.toLowerCase().includes(obscuraSearch.toLowerCase()),
      )
    : obscuraEntries;

  // In SFW mode, only show non-NSFW Obscura plugins
  const visibleObscura = isSfw ? filteredObscura.filter((e) => !e.isNsfw) : filteredObscura;

  /* ─── Tab definitions ──────────────────────────────────────── */

  const tabDefs: Array<{ key: PluginsTab; label: string; icon: typeof Boxes; count: number | null; nsfw: boolean }> = [
    { key: "installed", label: "Installed", icon: Boxes, count: visibleInstalled.length, nsfw: false },
    { key: "obscura-index", label: "Obscura Community", icon: Sparkles, count: obscuraEntries.length || null, nsfw: false },
    { key: "stash-index", label: "Stash Community", icon: Globe, count: indexEntries.length || null, nsfw: true },
    { key: "stashbox", label: "StashBox Endpoints", icon: Plug, count: stashBoxEndpoints.length, nsfw: true },
  ];

  // Filter tabs by NSFW mode
  const visibleTabs = isSfw ? tabDefs.filter((t) => !t.nsfw) : tabDefs;

  /* ─── Render ───────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2.5">
          <Puzzle className="h-5 w-5 text-text-accent" />
          Plugins
        </h1>
        <p className="mt-1 text-text-muted text-[0.78rem]">
          Install and manage identification plugins and metadata providers
        </p>
      </div>

      {/* Stats */}
      <div className={cn("grid gap-2", isSfw ? "grid-cols-2" : "grid-cols-4")}>
        <div className="surface-stat px-3 py-2">
          <span className="text-kicker !text-text-disabled">Installed</span>
          <div className="text-lg font-semibold text-text-primary leading-tight">{visibleInstalled.length + visiblePlugins.length}</div>
        </div>
        {!isSfw && (
          <>
            <div className="surface-stat px-3 py-2">
              <span className="text-kicker !text-text-disabled">{entityTerms.scene} Scrapers</span>
              <div className="text-lg font-semibold text-text-primary leading-tight">{videoCount}</div>
            </div>
            <div className="surface-stat px-3 py-2">
              <span className="text-kicker !text-text-disabled">{entityTerms.performer} Scrapers</span>
              <div className="text-lg font-semibold text-text-primary leading-tight">{performerCount}</div>
            </div>
            <div className="surface-stat px-3 py-2">
              <span className="text-kicker !text-text-disabled">StashBox</span>
              <div className="text-lg font-semibold text-text-primary leading-tight">{stashBoxEndpoints.length}</div>
            </div>
          </>
        )}
        {isSfw && (
          <div className="surface-stat px-3 py-2">
            <span className="text-kicker !text-text-disabled">Obscura Plugins</span>
            <div className="text-lg font-semibold text-text-primary leading-tight">{obscuraEntries.filter((e) => !e.isNsfw).length}</div>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="surface-well border-l-2 border-status-error px-3 py-2 text-sm text-status-error-text">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-text-disabled hover:text-text-muted">
            <X className="h-3 w-3 inline" />
          </button>
        </div>
      )}
      {message && !error && (
        <div className="surface-well border-l-2 border-status-success px-3 py-2 text-sm text-status-success-text">
          {message}
        </div>
      )}

      {/* Section tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hidden">
        {visibleTabs.map(({ key, label, icon: Icon, count, nsfw }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-fast whitespace-nowrap",
              tab === key
                ? "bg-accent-950 text-text-accent border border-border-accent shadow-[var(--shadow-glow-accent)]"
                : "text-text-muted border border-transparent hover:text-text-secondary hover:bg-surface-3/40",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {nsfw && (
              <span className="tag-chip text-[0.5rem] bg-status-error/10 text-status-error-text border border-status-error/20 px-1 py-0">
                NSFW
              </span>
            )}
            {count != null && count > 0 && (
              <span className="text-mono-sm text-text-disabled ml-1">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── INSTALLED TAB ──────────────────────────────────────── */}
      {tab === "installed" && (
        <section className="space-y-2">
          <div className="surface-well flex items-center gap-2 px-3 py-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
              <input className="control-input pl-8 w-56 py-1.5 text-sm" placeholder="Search installed..." value={installedSearch} onChange={(e) => setInstalledSearch(e.target.value)} />
              {installedSearch && (
                <button onClick={() => setInstalledSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"><X className="h-3 w-3" /></button>
              )}
            </div>
            {!isSfw && (
              <>
                <div className="w-px h-4 bg-border-subtle mx-1" />
                {(["all", "scene", "performer"] as CapFilter[]).map((filter) => (
                  <button key={filter} onClick={() => setCapFilter(filter)}
                    className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-all duration-fast",
                      capFilter === filter ? "bg-accent-950 text-text-accent border border-border-accent" : "text-text-muted hover:text-text-secondary border border-transparent")}>
                    {filter === "all" && <Package className="h-3 w-3" />}
                    {filter === "scene" && <Film className="h-3 w-3" />}
                    {filter === "performer" && <Users className="h-3 w-3" />}
                    {filter === "all" ? "All" : filter === "scene" ? entityTerms.scenes : entityTerms.performers}
                  </button>
                ))}
              </>
            )}
            <div className="flex-1" />
            <span className="text-mono-sm text-text-disabled">{filteredInstalled.length} shown</span>
          </div>

          {filteredInstalled.length === 0 && visiblePlugins.length === 0 ? (
            <div className="surface-card no-lift p-8 text-center">
              <Package className="h-8 w-8 text-text-disabled mx-auto mb-3" />
              <p className="text-text-muted text-sm">
                {visibleInstalled.length === 0 && installedPlugins.length === 0
                  ? isSfw
                    ? "No SFW plugins installed. Browse the Obscura Community tab to find plugins."
                    : "No plugins installed. Browse the community tabs to get started."
                  : "No plugins match your filters."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {visiblePlugins.map((plugin) => (
                <InstalledPluginCard
                  key={plugin.id}
                  plugin={plugin}
                  onToggle={async () => {
                    try {
                      await togglePlugin(plugin.id, !plugin.enabled);
                      setInstalledPlugins((prev) => prev.map((p) => (p.id === plugin.id ? { ...p, enabled: !p.enabled } : p)));
                    } catch (err) { setError(err instanceof Error ? err.message : "Failed to toggle"); }
                  }}
                  onRemove={async () => {
                    try {
                      await uninstallPlugin(plugin.id);
                      flashMessage(`Removed ${plugin.name}`);
                      setInstalledPlugins((prev) => prev.filter((p) => p.id !== plugin.id));
                      setObscuraEntries((prev) => prev.map((e) => (e.id === plugin.pluginId ? { ...e, installed: false } : e)));
                    } catch (err) { setError(err instanceof Error ? err.message : "Failed to remove"); }
                  }}
                  onAuthSaved={() => void loadInstalled()}
                  flashMessage={flashMessage}
                  setError={setError}
                />
              ))}
              {filteredInstalled.map((pkg) => (
                <InstalledScraperCard key={pkg.id} pkg={pkg} onToggle={() => void handleToggle(pkg)} onRemove={() => void handleUninstall(pkg)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── OBSCURA COMMUNITY INDEX TAB ────────────────────────── */}
      {tab === "obscura-index" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-text-muted text-[0.72rem]">
              {obscuraEntries.length} plugins available
              {isSfw && obscuraEntries.some((e) => e.isNsfw) && ` · ${obscuraEntries.filter((e) => e.isNsfw).length} NSFW plugins hidden`}
            </p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
                <input className="control-input pl-8 w-64 py-1.5 text-sm" placeholder="Filter by name or ID..." value={obscuraSearch} onChange={(e) => setObscuraSearch(e.target.value)} />
                {obscuraSearch && (
                  <button onClick={() => setObscuraSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"><X className="h-3 w-3" /></button>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={() => void loadObscuraIndex()} disabled={obscuraLoading}>
                {obscuraLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>
          </div>

          {obscuraLoading && !obscuraLoaded ? (
            <div className="surface-card no-lift p-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
            </div>
          ) : visibleObscura.length === 0 ? (
            <div className="surface-card no-lift p-8 text-center">
              <Sparkles className="h-8 w-8 text-text-disabled mx-auto mb-3" />
              <p className="text-text-muted text-sm">
                {obscuraSearch ? "No plugins match your search." : obscuraLoaded ? "No plugins available." : "Loading plugin index..."}
              </p>
              {!obscuraLoaded && !obscuraLoading && (
                <p className="text-text-disabled text-xs mt-2">
                  Set <code className="font-mono text-text-muted">OBSCURA_PLUGIN_INDEX_PATH</code> to point to the community plugins repo.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {visibleObscura.map((entry) => (
                <div key={entry.id} className="surface-card no-lift px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{entry.name}</p>
                      <span className="tag-chip tag-chip-accent text-[0.55rem]">Obscura</span>
                      {entry.isNsfw && (
                        <span className="tag-chip text-[0.55rem] bg-status-error/10 text-status-error-text border border-status-error/20">NSFW</span>
                      )}
                      <span className="text-mono-sm text-text-disabled">v{entry.version}</span>
                    </div>
                    {entry.description && (
                      <p className="text-text-muted text-[0.68rem] mt-0.5">{entry.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {Object.entries(entry.capabilities).filter(([, v]) => v).map(([key]) => {
                        const meta = CAPABILITY_META[key];
                        return (
                          <span key={key} className="tag-chip-default text-[0.55rem] px-1.5 py-0.5">
                            {meta?.label ?? key}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {entry.installed ? (
                    <Badge variant="accent" className="text-[0.6rem] flex-shrink-0">
                      <Check className="h-2.5 w-2.5 mr-1" />
                      Installed
                    </Badge>
                  ) : (
                    <button
                      onClick={() => void handleObscuraInstall(entry)}
                      disabled={obscuraInstallingId === entry.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-accent transition-colors duration-fast flex-shrink-0 disabled:opacity-40"
                    >
                      {obscuraInstallingId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Install
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── STASH COMMUNITY INDEX TAB (NSFW only) ──────────────── */}
      {tab === "stash-index" && !isSfw && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-text-muted text-[0.72rem]">
              {indexEntries.length} scrapers available · All Stash community scrapers are classified as NSFW
            </p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
                <input className="control-input pl-8 w-64 py-1.5 text-sm" placeholder="Filter by name or ID..." value={indexSearch} onChange={(e) => setIndexSearch(e.target.value)} />
                {indexSearch && (
                  <button onClick={() => setIndexSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"><X className="h-3 w-3" /></button>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={() => void loadStashIndex(true)} disabled={indexLoading}>
                {indexLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>
          </div>

          {/* Bulk action bar */}
          <div className="surface-well flex items-center gap-3 px-3 py-2">
            <button onClick={selectAllUninstalled} disabled={selectableCount === 0}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors disabled:opacity-40">
              <div className={cn("h-4 w-4 border flex items-center justify-center transition-colors",
                selectableCount > 0 && selectedUninstalledCount === selectableCount ? "bg-accent-800 border-border-accent"
                : selectedUninstalledCount > 0 ? "bg-accent-950 border-border-accent" : "border-border-subtle")}>
                {selectedUninstalledCount > 0 && <Check className="h-2.5 w-2.5 text-text-accent" />}
              </div>
              {selectedUninstalledCount > 0 ? `${selectedUninstalledCount} selected` : "Select all"}
            </button>
            <div className="flex-1" />
            {selectedUninstalledCount > 0 && (
              <button onClick={() => setSelected(new Set())} className="text-xs text-text-muted hover:text-text-primary transition-colors">Clear</button>
            )}
            <button onClick={() => void handleBulkInstall()} disabled={selectedUninstalledCount === 0 || bulkInstalling}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-fast",
                selectedUninstalledCount > 0 ? "bg-accent-950 text-text-accent border border-border-accent hover:bg-accent-900"
                : "text-text-disabled border border-transparent cursor-not-allowed")}>
              {bulkInstalling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              {bulkInstalling ? "Installing..." : selectedUninstalledCount > 0 ? `Install ${selectedUninstalledCount}` : "Install Selected"}
            </button>
          </div>

          {indexLoading && !indexLoaded ? (
            <div className="surface-card no-lift p-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
            </div>
          ) : (
            <div className="space-y-1 max-h-[600px] overflow-y-auto scrollbar-hidden">
              {filteredIndex.map((entry) => (
                <div key={entry.id} className={cn("surface-card no-lift px-4 py-3 flex items-center gap-3 transition-colors duration-fast",
                  !entry.installed && selected.has(entry.id) && "border-border-accent/40")}>
                  {!entry.installed ? (
                    <button onClick={() => toggleSelected(entry.id)} className="flex-shrink-0">
                      <div className={cn("h-4 w-4 border flex items-center justify-center transition-colors",
                        selected.has(entry.id) ? "bg-accent-800 border-border-accent" : "border-border-subtle hover:border-text-muted")}>
                        {selected.has(entry.id) && <Check className="h-2.5 w-2.5 text-text-accent" />}
                      </div>
                    </button>
                  ) : (<div className="w-4 flex-shrink-0" />)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{entry.name}</p>
                    <p className="text-text-disabled text-[0.65rem] mt-0.5 font-mono">
                      {entry.id}
                      <span className="text-text-disabled/60 ml-2">{entry.date}</span>
                      {entry.requires?.length ? <span className="text-text-disabled/60 ml-2">requires: {entry.requires.join(", ")}</span> : ""}
                    </p>
                  </div>
                  {entry.installed ? (
                    <Badge variant="accent" className="text-[0.6rem] flex-shrink-0"><Check className="h-2.5 w-2.5 mr-1" />Installed</Badge>
                  ) : (
                    <button onClick={() => void handleInstall(entry.id)} disabled={installingId === entry.id || bulkInstalling}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-accent transition-colors duration-fast flex-shrink-0 disabled:opacity-40">
                      {installingId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Install
                    </button>
                  )}
                </div>
              ))}
              {filteredIndex.length === 0 && (
                <div className="surface-card no-lift p-8 text-center">
                  <p className="text-text-muted text-sm">{indexSearch ? "No scrapers match your search." : "Index is empty."}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ─── STASHBOX ENDPOINTS TAB (NSFW only) ─────────────────── */}
      {tab === "stashbox" && !isSfw && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-text-muted text-[0.72rem]">
              Connect to StashDB, ThePornDB, FansDB, and other Stash-Box protocol servers
            </p>
            <Button type="button" variant="ghost" size="sm"
              onClick={() => { setEditingStashBox(null); setSbName(""); setSbEndpoint(""); setSbApiKey(""); setSbTestResult(null); setShowStashBoxForm(true); }}
              className="h-auto gap-1 px-2 py-1 text-[0.68rem] text-text-accent hover:bg-accent-950/60">
              <Plus className="h-3 w-3" />Add Endpoint
            </Button>
          </div>

          {stashBoxEndpoints.length === 0 && !showStashBoxForm && (
            <div className="empty-rack-slot p-6 text-center">
              <Plug className="h-8 w-8 text-text-disabled mx-auto mb-3" />
              <p className="text-[0.75rem] text-text-disabled">No endpoints configured. Add one to enable fingerprint-based identification.</p>
            </div>
          )}

          {stashBoxEndpoints.map((ep) => (
            <div key={ep.id} className="surface-card no-lift p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.82rem] font-medium truncate">{ep.name}</span>
                    <span className="tag-chip text-[0.55rem] bg-status-error/10 text-status-error-text border border-status-error/20">NSFW</span>
                    {!ep.enabled && (<Badge variant="default" className="text-[0.55rem] font-semibold uppercase tracking-wider">Disabled</Badge>)}
                    {sbTestResult?.id === ep.id && (
                      <Badge variant={sbTestResult.valid ? "success" : "error"} className="items-center gap-1 text-[0.55rem] font-medium normal-case tracking-normal">
                        {sbTestResult.valid ? <Check className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                        {sbTestResult.valid ? "Connected" : sbTestResult.error ?? "Failed"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[0.65rem] text-text-disabled truncate mt-0.5">{ep.endpoint} · Key: {ep.apiKeyPreview}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={async () => { setSbTesting(ep.id); setSbTestResult(null); try { const r = await testStashBoxEndpoint(ep.id); setSbTestResult({ id: ep.id, ...r }); } catch { setSbTestResult({ id: ep.id, valid: false, error: "Request failed" }); } finally { setSbTesting(null); } }}
                    disabled={sbTesting === ep.id} className="p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary" title="Test connection">
                    {sbTesting === ep.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-400" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => { setEditingStashBox(ep); setSbName(ep.name); setSbEndpoint(ep.endpoint); setSbApiKey(""); setSbTestResult(null); setShowStashBoxForm(true); }}
                    className="p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={async () => { await updateStashBoxEndpoint(ep.id, { enabled: !ep.enabled }); setStashBoxEndpoints((prev) => prev.map((e) => (e.id === ep.id ? { ...e, enabled: !e.enabled } : e))); flashMessage(`${ep.name} ${ep.enabled ? "disabled" : "enabled"}.`); }}
                    className="p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary" title={ep.enabled ? "Disable" : "Enable"}>
                    {ep.enabled ? <ToggleRight className="h-3.5 w-3.5 text-text-accent" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={async () => { await deleteStashBoxEndpoint(ep.id); setStashBoxEndpoints((prev) => prev.filter((e) => e.id !== ep.id)); flashMessage(`${ep.name} removed.`); }}
                    className="p-1.5 text-text-muted transition-colors hover:bg-status-error/10 hover:text-status-error-text" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}

          {showStashBoxForm && (
            <div className="surface-well space-y-3 border border-border-accent/30 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[0.78rem] font-medium">{editingStashBox ? "Edit Endpoint" : "Add Stash-Box Endpoint"}</h4>
                <button type="button" onClick={() => setShowStashBoxForm(false)} className="p-1 text-text-disabled transition-colors hover:text-text-muted"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="grid gap-2.5">
                <div>
                  <label className="text-[0.65rem] text-text-disabled block mb-1">Name</label>
                  <input type="text" value={sbName} onChange={(e) => setSbName(e.target.value)} placeholder="StashDB"
                    className="w-full bg-surface-1 border border-border-subtle px-2.5 py-1.5 text-[0.78rem] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-accent transition-colors" />
                </div>
                <div>
                  <label className="text-[0.65rem] text-text-disabled block mb-1">GraphQL Endpoint</label>
                  <input type="text" value={sbEndpoint} onChange={(e) => setSbEndpoint(e.target.value)} placeholder="https://stashdb.org/graphql"
                    className="w-full bg-surface-1 border border-border-subtle px-2.5 py-1.5 text-[0.78rem] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-accent transition-colors" />
                  <div className="flex gap-1.5 mt-1.5">
                    {[{ label: "StashDB", url: "https://stashdb.org/graphql" }, { label: "FansDB", url: "https://fansdb.cc/graphql" }, { label: "PMVStash", url: "https://pmvstash.org/graphql" }, { label: "ThePornDB", url: "https://theporndb.net/graphql" }].map((preset) => (
                      <button key={preset.label} onClick={() => { setSbEndpoint(preset.url); if (!sbName) setSbName(preset.label); }}
                        className="border border-border-subtle px-1.5 py-0.5 text-[0.6rem] text-text-disabled transition-colors hover:border-border-default hover:text-text-muted">{preset.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[0.65rem] text-text-disabled block mb-1">API Key {editingStashBox && <span className="text-text-disabled">(leave blank to keep current)</span>}</label>
                  <input type="password" value={sbApiKey} onChange={(e) => setSbApiKey(e.target.value)} placeholder={editingStashBox ? "••••••••" : "Paste your API key"}
                    className="w-full bg-surface-1 border border-border-subtle px-2.5 py-1.5 text-[0.78rem] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-accent transition-colors font-mono" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowStashBoxForm(false)} className="h-auto px-3 py-1.5 text-[0.72rem]">Cancel</Button>
                <Button type="button" variant="primary" size="sm" disabled={sbSaving || !sbName || !sbEndpoint}
                  onClick={async () => {
                    setSbSaving(true); setError(null);
                    try {
                      if (editingStashBox) {
                        const updates: Record<string, string> = {};
                        if (sbName !== editingStashBox.name) updates.name = sbName;
                        if (sbEndpoint !== editingStashBox.endpoint) updates.endpoint = sbEndpoint;
                        if (sbApiKey) updates.apiKey = sbApiKey;
                        const updated = await updateStashBoxEndpoint(editingStashBox.id, updates);
                        setStashBoxEndpoints((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
                      } else {
                        if (!sbApiKey) { setError("API key is required"); setSbSaving(false); return; }
                        const created = await createStashBoxEndpoint({ name: sbName, endpoint: sbEndpoint, apiKey: sbApiKey });
                        setStashBoxEndpoints((prev) => [...prev, created]);
                      }
                      setShowStashBoxForm(false); flashMessage(editingStashBox ? "Endpoint updated." : "Endpoint added.");
                    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save"); } finally { setSbSaving(false); }
                  }}
                  className="h-auto gap-1.5 px-3 py-1.5 text-[0.72rem]">
                  {sbSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  {editingStashBox ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ─── Installed Plugin Card (Obscura-native with auth) ───────── */

function InstalledPluginCard({
  plugin,
  onToggle,
  onRemove,
  onAuthSaved,
  flashMessage: flash,
  setError: setErr,
}: {
  plugin: InstalledPlugin;
  onToggle: () => void;
  onRemove: () => void;
  onAuthSaved: () => void;
  flashMessage: (msg: string) => void;
  setError: (err: string | null) => void;
}) {
  const [authExpanded, setAuthExpanded] = useState(false);
  const [authValues, setAuthValues] = useState<Record<string, string>>({});
  const [authSaving, setAuthSaving] = useState(false);

  const caps = plugin.capabilities ?? {};
  const enabledCaps = Object.entries(caps).filter(([, v]) => v).map(([k]) => k);
  const hasAuth = plugin.authFields && plugin.authFields.length > 0;

  async function handleSaveAuth() {
    if (!plugin.authFields) return;
    setAuthSaving(true);
    setErr(null);
    try {
      for (const field of plugin.authFields) {
        const val = authValues[field.key];
        if (val && val.trim()) {
          await savePluginAuthKey(plugin.id, field.key, val.trim());
        }
      }
      flash("Credentials saved.");
      setAuthValues({});
      setAuthExpanded(false);
      onAuthSaved();
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Failed to save credentials");
    } finally {
      setAuthSaving(false);
    }
  }

  return (
    <div className={cn("surface-card no-lift transition-opacity duration-fast", !plugin.enabled && "opacity-60")}>
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <p className="text-sm font-semibold">{plugin.name}</p>
              <span className="tag-chip tag-chip-accent text-[0.55rem]">Obscura</span>
              {plugin.isNsfw && <span className="tag-chip text-[0.55rem] bg-status-error/10 text-status-error-text border border-status-error/20">NSFW</span>}
              <Badge variant={plugin.enabled ? "accent" : "default"} className="text-[0.55rem]">{plugin.enabled ? "Enabled" : "Disabled"}</Badge>
              {hasAuth && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[0.55rem] px-1.5 py-0.5",
                  plugin.authStatus === "ok"
                    ? "bg-status-success/10 text-status-success-text border border-status-success/20"
                    : "bg-status-warning/10 text-status-warning-text border border-status-warning/20",
                )}>
                  {plugin.authStatus === "ok" ? <Check className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                  {plugin.authStatus === "ok" ? "Auth OK" : "Auth Required"}
                </span>
              )}
            </div>
            <p className="text-mono-sm text-text-disabled mt-0.5">{plugin.pluginId} · v{plugin.version} · {plugin.runtime}</p>
            {enabledCaps.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {enabledCaps.map((key) => {
                  const meta = CAPABILITY_META[key];
                  return (<span key={key} className="tag-chip-default text-[0.6rem] px-1.5 py-0.5">{meta?.label ?? key}</span>);
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasAuth && (
              <button onClick={() => setAuthExpanded((v) => !v)}
                className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors duration-fast",
                  plugin.authStatus === "missing" ? "text-status-warning-text" : "text-text-muted hover:text-text-primary")}>
                <KeyRound className="h-3.5 w-3.5" />
                {authExpanded ? "Close" : "Configure"}
              </button>
            )}
            <button onClick={onToggle} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors duration-fast text-text-muted hover:text-text-primary">
              {plugin.enabled ? <ToggleRight className="h-4 w-4 text-text-accent" /> : <ToggleLeft className="h-4 w-4" />}
              {plugin.enabled ? "Disable" : "Enable"}
            </button>
            <button onClick={onRemove} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-status-error-text transition-colors duration-fast">
              <Trash2 className="h-3.5 w-3.5" />Remove
            </button>
          </div>
        </div>
      </div>

      {/* Auth configuration panel */}
      {authExpanded && plugin.authFields && (
        <div className="border-t border-border-subtle px-4 py-3 space-y-3 bg-surface-1/50">
          <h4 className="text-[0.72rem] font-medium text-text-secondary">Authentication</h4>
          {plugin.authFields.map((field) => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[0.65rem] text-text-disabled">
                  {field.label}
                  {field.required && <span className="text-status-error-text ml-0.5">*</span>}
                </label>
                {field.url && (
                  <a href={field.url} target="_blank" rel="noopener noreferrer"
                    className="text-[0.6rem] text-text-accent hover:underline">
                    Get key →
                  </a>
                )}
              </div>
              <input
                type="password"
                value={authValues[field.key] ?? ""}
                onChange={(e) => setAuthValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={plugin.authStatus === "ok" ? "••••••••  (configured — enter new value to replace)" : "Paste your API key"}
                className="w-full bg-surface-1 border border-border-subtle px-2.5 py-1.5 text-[0.78rem] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-accent transition-colors font-mono"
              />
            </div>
          ))}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAuthExpanded(false); setAuthValues({}); }}
              className="h-auto px-3 py-1.5 text-[0.72rem]">Cancel</Button>
            <Button type="button" variant="primary" size="sm"
              disabled={authSaving || !plugin.authFields.some((f) => authValues[f.key]?.trim())}
              onClick={() => void handleSaveAuth()}
              className="h-auto gap-1.5 px-3 py-1.5 text-[0.72rem]">
              {authSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save Credentials
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Installed Scraper Card (Stash-compat) ──────────────────── */

function InstalledScraperCard({ pkg, onToggle, onRemove }: { pkg: ScraperPackage; onToggle: () => void; onRemove: () => void }) {
  const caps = pkg.capabilities as Record<string, boolean> | null;
  const enabledCaps = caps ? Object.entries(caps).filter(([, v]) => v).map(([k]) => k) : [];
  const hasScene = enabledCaps.some((c) => c.startsWith("scene"));
  const hasPerformer = enabledCaps.some((c) => c.startsWith("performer"));
  const isNsfw = pkg.isNsfw;

  return (
    <div className={cn("surface-card no-lift p-4 transition-opacity duration-fast", !pkg.enabled && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <p className="text-sm font-semibold">{pkg.name}</p>
            <span className={cn("tag-chip text-[0.55rem]", isNsfw ? "tag-chip-default" : "tag-chip-accent")}>{isNsfw ? "Stash" : "Obscura"}</span>
            {isNsfw && <span className="tag-chip text-[0.55rem] bg-status-error/10 text-status-error-text border border-status-error/20">NSFW</span>}
            <Badge variant={pkg.enabled ? "accent" : "default"} className="text-[0.55rem]">{pkg.enabled ? "Enabled" : "Disabled"}</Badge>
          </div>
          <p className="text-mono-sm text-text-disabled mt-0.5">{pkg.packageId}</p>
          {enabledCaps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {hasScene && <span className="inline-flex items-center gap-1 text-[0.6rem] text-text-muted mr-0.5"><Film className="h-2.5 w-2.5" /></span>}
              {hasPerformer && <span className="inline-flex items-center gap-1 text-[0.6rem] text-text-accent mr-0.5"><Users className="h-2.5 w-2.5" /></span>}
              {enabledCaps.map((key) => {
                const meta = CAPABILITY_META[key];
                return (<span key={key} className={cn("text-[0.6rem] px-1.5 py-0.5", meta?.category === "performer" ? "bg-accent-950/80 text-text-accent border border-border-accent/30" : "tag-chip-default")}>{meta?.label ?? key}</span>);
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onToggle} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors duration-fast text-text-muted hover:text-text-primary">
            {pkg.enabled ? <ToggleRight className="h-4 w-4 text-text-accent" /> : <ToggleLeft className="h-4 w-4" />}
            {pkg.enabled ? "Disable" : "Enable"}
          </button>
          <button onClick={onRemove} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-status-error-text transition-colors duration-fast">
            <Trash2 className="h-3.5 w-3.5" />Remove
          </button>
        </div>
      </div>
    </div>
  );
}
