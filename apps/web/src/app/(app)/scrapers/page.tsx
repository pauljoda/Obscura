"use client";

import { useEffect, useState } from "react";
import { Button, Badge } from "@obscura/ui";
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
      // Update index entry installed status
      setIndexEntries((prev) =>
        prev.map((e) =>
          e.id === packageId ? { ...e, installed: true } : e
        )
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
        prev.map((e) =>
          e.id === pkg.packageId ? { ...e, installed: false } : e
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove scraper");
    }
  }

  async function handleToggle(pkg: ScraperPackage) {
    try {
      const updated = await toggleScraper(pkg.id, !pkg.enabled);
      setInstalled((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle scraper");
    }
  }

  const filteredIndex = search
    ? indexEntries.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.id.toLowerCase().includes(search.toLowerCase())
      )
    : indexEntries;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Scrapers</h1>
          <p className="mt-1 text-text-muted text-sm">
            Install and manage community metadata scrapers.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {(message || error) && (
        <div
          className={
            error
              ? "surface-panel border border-error/20 p-3 text-error-text text-sm"
              : "surface-panel border border-border-accent p-3 text-text-secondary text-sm"
          }
        >
          {error ?? message}
        </div>
      )}

      {/* Installed scrapers */}
      <section className="surface-panel p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-accent-500" />
          <div>
            <h2 className="text-base">Installed Scrapers</h2>
            <p className="text-text-muted text-sm">
              {installed.length} scraper{installed.length !== 1 ? "s" : ""} installed
            </p>
          </div>
        </div>

        {loading ? (
          <div className="surface-well p-4 text-text-muted text-sm">
            Loading scrapers...
          </div>
        ) : installed.length === 0 ? (
          <div className="surface-well p-6 text-center">
            <p className="text-text-muted text-sm">
              No scrapers installed yet. Browse the community index to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {installed.map((pkg) => (
              <div key={pkg.id} className="surface-well p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold">{pkg.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-mono-sm text-text-muted">
                          {pkg.packageId}
                        </span>
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
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleToggle(pkg)}
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
                      onClick={() => void handleUninstall(pkg)}
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
      </section>

      {/* Community index browser */}
      {showIndex && (
        <section className="surface-panel p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base">Community Index</h2>
              <p className="text-text-muted text-sm">
                {indexEntries.length} scrapers available
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
              <input
                className="control-input pl-8 w-64"
                placeholder="Filter scrapers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2 max-h-[500px] overflow-y-auto scrollbar-hidden">
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
              <div className="text-text-muted text-sm text-center py-6">
                {search ? "No scrapers match your search." : "Index is empty."}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
