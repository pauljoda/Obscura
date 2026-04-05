"use client";

import { useEffect, useState } from "react";
import { Button, Badge } from "@obscura/ui";
import { cn } from "@obscura/ui";
import {
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

/** Human-readable capability names and their category */
const CAPABILITY_META: Record<string, { label: string; category: "scene" | "performer" | "gallery" | "group" }> = {
  sceneByURL: { label: "Scene by URL", category: "scene" },
  sceneByFragment: { label: "Scene by Fragment", category: "scene" },
  sceneByName: { label: "Scene by Name", category: "scene" },
  sceneByQueryFragment: { label: "Scene by Query", category: "scene" },
  performerByURL: { label: "Performer by URL", category: "performer" },
  performerByName: { label: "Performer by Name", category: "performer" },
  performerByFragment: { label: "Performer by Fragment", category: "performer" },
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

  const filteredIndex = search
    ? indexEntries.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.id.toLowerCase().includes(search.toLowerCase())
      )
    : indexEntries;

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
            Scrapers
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
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {showIndex ? "Refresh Index" : "Browse Community Index"}
        </Button>
      </div>

      {/* Stats strip */}
      {!loading && installed.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="surface-stat px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1 text-text-disabled">
              <Package className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Installed</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {installed.length}
            </div>
          </div>
          <div className="surface-stat px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1 text-text-disabled">
              <Film className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Scene Scrapers</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {sceneCount}
            </div>
          </div>
          <div className="surface-stat px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1 text-text-disabled">
              <Users className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Performer Scrapers</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {performerCount}
            </div>
          </div>
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

      {/* Capability filter toolbar */}
      {!loading && installed.length > 0 && (
        <div className="surface-well flex items-center gap-2 px-3 py-2">
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
              {filter === "all" ? "All" : filter === "scene" ? "Scenes" : "Performers"}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-mono-sm text-text-disabled">
            {filteredInstalled.length} scraper{filteredInstalled.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Installed scrapers */}
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

          <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-hidden">
            {filteredIndex.map((entry) => (
              <div
                key={entry.id}
                className="surface-well px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleInstall(entry.id)}
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
      "surface-well p-4 transition-opacity duration-fast",
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
