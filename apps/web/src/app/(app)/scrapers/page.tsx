"use client";

import { useEffect, useState } from "react";
import { Button, Badge } from "@obscura/ui";
import { cn } from "@obscura/ui";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Trash2,
  RefreshCw,
  Loader2,
  Search,
  Package,
  Check,
  ToggleLeft,
  ToggleRight,
  Film,
  Users,
  Image,
  X,
  Globe,
} from "lucide-react";
import {
  fetchCommunityIndex,
  fetchInstalledScrapers,
  installScraper,
  uninstallScraper,
  toggleScraper,
  type CommunityIndexEntry,
  type ScraperPackage,
} from "../../../lib/api";

import { DashboardStatTile } from "../../../components/dashboard/dashboard-stat-tile";
import { DASHBOARD_STAT_GRADIENTS } from "../../../components/dashboard/dashboard-utils";
import { entityTerms } from "../../../lib/terminology";

/** Human-readable capability names and their category */
const CAPABILITY_META: Record<string, { label: string; category: "scene" | "performer" | "gallery" | "group" }> = {
  sceneByURL: { label: "Video by URL", category: "scene" },
  sceneByFragment: { label: "Video by fragment", category: "scene" },
  sceneByName: { label: "Video by name", category: "scene" },
  sceneByQueryFragment: { label: "Video by query", category: "scene" },
  performerByURL: { label: "Actor by URL", category: "performer" },
  performerByName: { label: "Actor by name", category: "performer" },
  performerByFragment: { label: "Actor by fragment", category: "performer" },
  galleryByURL: { label: "Gallery by URL", category: "gallery" },
  galleryByFragment: { label: "Gallery by Fragment", category: "gallery" },
  groupByURL: { label: "Group by URL", category: "group" },
};

const CATEGORY_STYLE: Record<string, string> = {
  scene: "tag-chip-default",
  performer: "tag-chip-info",
  gallery: "tag-chip-default",
  group: "tag-chip-default",
};

const CATEGORY_ICON: Record<string, typeof Film> = {
  scene: Film,
  performer: Users,
  gallery: Image,
};

type CapFilter = "all" | "scene" | "performer";

export default function ScrapersPage() {
  const [installed, setInstalled] = useState<ScraperPackage[]>([]);
  const [indexEntries, setIndexEntries] = useState<CommunityIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexLoading, setIndexLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIndex, setShowIndex] = useState(false);
  const [capFilter, setCapFilter] = useState<CapFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkInstalling, setBulkInstalling] = useState(false);
  const [installedCollapsed, setInstalledCollapsed] = useState(false);

  async function loadInstalled() {
    try {
      const res = await fetchInstalledScrapers();
      setInstalled(res.packages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scrapers");
    } finally {
      setLoading(false);
    }
  }

  async function loadIndex(force = false) {
    setIndexLoading(true);
    setError(null);
    try {
      const res = await fetchCommunityIndex(force);
      setIndexEntries(res.entries);
      setShowIndex(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch community index");
    } finally {
      setIndexLoading(false);
    }
  }

  useEffect(() => {
    void loadInstalled();
  }, []);

  async function handleInstall(packageId: string) {
    setInstallingId(packageId);
    setError(null);
    try {
      await installScraper(packageId);
      setMessage(`Installed ${packageId}`);
      await loadInstalled();
      setIndexEntries((prev) =>
        prev.map((e) => (e.id === packageId ? { ...e, installed: true } : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to install ${packageId}`);
    } finally {
      setInstallingId(null);
    }
  }

  async function handleUninstall(pkg: ScraperPackage) {
    setError(null);
    try {
      await uninstallScraper(pkg.id);
      setMessage(`Removed ${pkg.name}`);
      await loadInstalled();
      setIndexEntries((prev) =>
        prev.map((e) => (e.id === pkg.packageId ? { ...e, installed: false } : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove scraper");
    }
  }

  async function handleToggle(pkg: ScraperPackage) {
    try {
      const updated = await toggleScraper(pkg.id, !pkg.enabled);
      setInstalled((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle scraper");
    }
  }

  // Filter installed scrapers by capability
  const filteredInstalled = capFilter === "all"
    ? installed
    : installed.filter((pkg) => {
        const caps = pkg.capabilities as Record<string, boolean> | null;
        if (!caps) return false;
        if (capFilter === "scene") return caps.sceneByURL || caps.sceneByFragment || caps.sceneByName || caps.sceneByQueryFragment;
        if (capFilter === "performer") return caps.performerByURL || caps.performerByName || caps.performerByFragment;
        return true;
      });

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllUninstalled() {
    const uninstalled = filteredIndex.filter((e) => !e.installed).map((e) => e.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = uninstalled.every((id) => next.has(id));
      if (allSelected) {
        // Deselect all
        for (const id of uninstalled) next.delete(id);
      } else {
        // Select all
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
      (id) => !indexEntries.find((e) => e.id === id)?.installed
    );

    let installedCount = 0;
    for (const packageId of toInstall) {
      try {
        await installScraper(packageId);
        installedCount++;
        setIndexEntries((prev) =>
          prev.map((e) => (e.id === packageId ? { ...e, installed: true } : e))
        );
      } catch (err) {
        setError(`Failed to install ${packageId}: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
    }

    if (installedCount > 0) {
      setMessage(`Installed ${installedCount} scraper${installedCount !== 1 ? "s" : ""}`);
      await loadInstalled();
    }

    setSelected(new Set());
    setBulkInstalling(false);
  }

  const filteredIndex = search
    ? indexEntries.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.id.toLowerCase().includes(search.toLowerCase())
      )
    : indexEntries;

  const selectableCount = filteredIndex.filter((e) => !e.installed).length;
  const selectedUninstalledCount = Array.from(selected).filter(
    (id) => !indexEntries.find((e) => e.id === id)?.installed
  ).length;

  // Count scrapers by capability type
  const sceneCount = installed.filter((pkg) => {
    const caps = pkg.capabilities as Record<string, boolean> | null;
    return caps && (caps.sceneByURL || caps.sceneByFragment || caps.sceneByName);
  }).length;
  const performerCount = installed.filter((pkg) => {
    const caps = pkg.capabilities as Record<string, boolean> | null;
    return caps && (caps.performerByURL || caps.performerByName || caps.performerByFragment);
  }).length;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Package className="h-5 w-5 text-text-accent" />
            Community Scrapers
          </h1>
          <p className="text-text-muted text-[0.78rem] mt-1">
            Install and manage community metadata scrapers
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadIndex(true)}
          disabled={indexLoading}
        >
          {indexLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : showIndex ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Globe className="h-3.5 w-3.5" />
          )}
          {showIndex ? "Refresh Index" : "Browse Community Index"}
        </Button>
      </div>

      {/* Stats strip */}
      {!loading && installed.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          <DashboardStatTile
            icon={<Package className="h-4 w-4" />}
            label="Installed"
            value={String(installed.length)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[0]}
          />
          <DashboardStatTile
            icon={<Film className="h-4 w-4" />}
            label={`${entityTerms.scene} scrapers`}
            value={String(sceneCount)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[1]}
          />
          <DashboardStatTile
            icon={<Users className="h-4 w-4" />}
            label={`${entityTerms.performer} scrapers`}
            value={String(performerCount)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[2]}
          />
        </div>
      )}

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

      {/* Installed scrapers (collapsible) */}
      {loading ? (
        <div className="surface-well p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-text-disabled animate-spin" />
        </div>
      ) : installed.length === 0 ? (
        <div className="surface-well p-12 text-center">
          <Package className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            No scrapers installed yet. Browse the community index to get started.
          </p>
        </div>
      ) : (
        <section className="space-y-2">
          {/* Collapsible header with filter toolbar */}
          <div className="surface-well flex items-center gap-2 px-3 py-2">
            <button
              onClick={() => setInstalledCollapsed((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors font-medium"
            >
              {installedCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Installed
            </button>
            <span className="text-mono-sm text-text-disabled">
              {installed.length}
            </span>

            {!installedCollapsed && (
              <>
                <div className="w-px h-4 bg-border-subtle mx-1" />
                <span className="text-[0.68rem] text-text-disabled uppercase tracking-wider font-bold mr-1">Show:</span>
                {(["all", "scene", "performer"] as CapFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setCapFilter(filter)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-all duration-fast",
                      capFilter === filter
                        ? "bg-accent-950 text-text-accent border border-border-accent"
                        : "text-text-muted hover:text-text-secondary border border-transparent"
                    )}
                  >
                    {filter === "all" && <Package className="h-3 w-3" />}
                    {filter === "scene" && <Film className="h-3 w-3" />}
                    {filter === "performer" && <Users className="h-3 w-3" />}
                    {filter === "all" ? "All" : filter === "scene" ? entityTerms.scenes : entityTerms.performers}
                  </button>
                ))}
              </>
            )}

            <div className="flex-1" />
            {!installedCollapsed && (
              <span className="text-mono-sm text-text-disabled">
                {filteredInstalled.length} shown
              </span>
            )}
          </div>

          {/* Scraper cards */}
          {!installedCollapsed && (
            <div className="space-y-2">
              {filteredInstalled.map((pkg) => (
                <ScraperCard
                  key={pkg.id}
                  pkg={pkg}
                  onToggle={() => void handleToggle(pkg)}
                  onRemove={() => void handleUninstall(pkg)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Community index browser */}
      {showIndex && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-heading font-semibold">Community Index</h2>
              <p className="text-text-muted text-[0.72rem]">
                {indexEntries.length} scrapers available
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
              <input
                className="control-input pl-8 w-64 py-1.5 text-sm"
                placeholder="Filter by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Bulk action bar */}
          <div className="surface-well flex items-center gap-3 px-3 py-2">
            <button
              onClick={selectAllUninstalled}
              disabled={selectableCount === 0}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
            >
              <div className={cn(
                "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                selectableCount > 0 && selectedUninstalledCount === selectableCount
                  ? "bg-accent-800 border-border-accent"
                  : selectedUninstalledCount > 0
                    ? "bg-accent-950 border-border-accent"
                    : "border-border-subtle"
              )}>
                {selectedUninstalledCount > 0 && (
                  <Check className="h-2.5 w-2.5 text-text-accent" />
                )}
              </div>
              {selectedUninstalledCount > 0
                ? `${selectedUninstalledCount} selected`
                : "Select all"}
            </button>

            <div className="flex-1" />

            {selectedUninstalledCount > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Clear
              </button>
            )}

            <button
              onClick={() => void handleBulkInstall()}
              disabled={selectedUninstalledCount === 0 || bulkInstalling}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-fast",
                selectedUninstalledCount > 0
                  ? "bg-accent-950 text-text-accent border border-border-accent hover:bg-accent-900"
                  : "text-text-disabled border border-transparent cursor-not-allowed"
              )}
            >
              {bulkInstalling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {bulkInstalling
                ? "Installing..."
                : selectedUninstalledCount > 0
                  ? `Install ${selectedUninstalledCount} Scraper${selectedUninstalledCount !== 1 ? "s" : ""}`
                  : "Install Selected"}
            </button>
          </div>

          <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-hidden">
            {filteredIndex.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "surface-card no-lift px-4 py-3 flex items-center gap-3 transition-colors duration-fast",
                  !entry.installed && selected.has(entry.id) && "border-border-accent/40"
                )}
              >
                {/* Checkbox */}
                {!entry.installed ? (
                  <button
                    onClick={() => toggleSelected(entry.id)}
                    className="flex-shrink-0"
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                      selected.has(entry.id)
                        ? "bg-accent-800 border-border-accent"
                        : "border-border-subtle hover:border-text-muted"
                    )}>
                      {selected.has(entry.id) && (
                        <Check className="h-2.5 w-2.5 text-text-accent" />
                      )}
                    </div>
                  </button>
                ) : (
                  <div className="w-4 flex-shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{entry.name}</p>
                  <p className="text-text-disabled text-[0.65rem] mt-0.5 font-mono">
                    {entry.id}
                    <span className="text-text-disabled/60 ml-2">{entry.date}</span>
                    {entry.requires?.length
                      ? <span className="text-text-disabled/60 ml-2">requires: {entry.requires.join(", ")}</span>
                      : ""}
                  </p>
                </div>

                {entry.installed ? (
                  <Badge variant="accent" className="text-[0.6rem] flex-shrink-0">
                    <Check className="h-2.5 w-2.5 mr-1" />
                    Installed
                  </Badge>
                ) : (
                  <button
                    onClick={() => void handleInstall(entry.id)}
                    disabled={installingId === entry.id || bulkInstalling}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-text-muted hover:text-text-accent transition-colors duration-fast flex-shrink-0 disabled:opacity-40"
                  >
                    {installingId === entry.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Install
                  </button>
                )}
              </div>
            ))}
            {filteredIndex.length === 0 && (
              <div className="surface-well p-8 text-center">
                <p className="text-text-muted text-sm">
                  {search ? "No scrapers match your search." : "Index is empty."}
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ScraperCard({
  pkg,
  onToggle,
  onRemove,
}: {
  pkg: ScraperPackage;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const caps = pkg.capabilities as Record<string, boolean> | null;
  const enabledCaps = caps
    ? Object.entries(caps).filter(([, v]) => v).map(([k]) => k)
    : [];

  // Group capabilities by category
  const hasScene = enabledCaps.some((c) => c.startsWith("scene"));
  const hasPerformer = enabledCaps.some((c) => c.startsWith("performer"));

  return (
    <div className={cn(
      "surface-card no-lift p-4 transition-opacity duration-fast",
      !pkg.enabled && "opacity-60"
    )}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <p className="text-sm font-semibold">{pkg.name}</p>
            <Badge
              variant={pkg.enabled ? "accent" : "default"}
              className="text-[0.55rem]"
            >
              {pkg.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <p className="text-mono-sm text-text-disabled mt-0.5">{pkg.packageId}</p>

          {/* Capability badges with categories */}
          {enabledCaps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {/* Category indicators */}
              {hasScene && (
                <span className="inline-flex items-center gap-1 text-[0.6rem] text-text-muted mr-0.5">
                  <Film className="h-2.5 w-2.5" />
                </span>
              )}
              {hasPerformer && (
                <span className="inline-flex items-center gap-1 text-[0.6rem] text-text-accent mr-0.5">
                  <Users className="h-2.5 w-2.5" />
                </span>
              )}

              {enabledCaps.map((key) => {
                const meta = CAPABILITY_META[key];
                const label = meta?.label ?? key;
                const category = meta?.category ?? "scene";
                const isPerformer = category === "performer";
                return (
                  <span
                    key={key}
                    className={cn(
                      "text-[0.6rem] px-1.5 py-0.5 rounded",
                      isPerformer
                        ? "bg-accent-950/80 text-text-accent border border-border-accent/30"
                        : "tag-chip-default"
                    )}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onToggle}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors duration-fast",
              "text-text-muted hover:text-text-primary"
            )}
          >
            {pkg.enabled ? (
              <ToggleRight className="h-4 w-4 text-text-accent" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
            {pkg.enabled ? "Disable" : "Enable"}
          </button>
          <button
            onClick={onRemove}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-text-muted hover:text-status-error transition-colors duration-fast"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
