"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "@obscura/ui";
import { cn } from "@obscura/ui";
import {
  Check,
  X,
  Loader2,
  ScanSearch,
  Play,
  Square,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import {
  fetchScenes,
  fetchInstalledScrapers,
  scrapeScene,
  acceptScrapeResult,
  rejectScrapeResult,
  toApiUrl,
  type SceneListItem,
  type ScraperPackage,
  type ScrapeResult,
  type NormalizedScrapeResult,
} from "../lib/api";

interface SceneRow {
  scene: SceneListItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  error?: string;
  triedActions?: string[];
}

export function BulkScrape() {
  const [rows, setRows] = useState<SceneRow[]>([]);
  const [scrapers, setScrapers] = useState<ScraperPackage[]>([]);
  const [selectedScraperId, setSelectedScraperId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [aborted, setAborted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [totalScenes, setTotalScenes] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scenesRes, scrapersRes] = await Promise.all([
        fetchScenes({ sort: "created_at", limit: 500 }),
        fetchInstalledScrapers(),
      ]);

      const unorganized = scenesRes.scenes.filter((s) => !s.organized);
      setRows(unorganized.map((scene) => ({ scene, status: "pending" })));
      setTotalScenes(unorganized.length);

      const enabled = scrapersRes.packages.filter((s) => s.enabled);
      setScrapers(enabled);
      if (!selectedScraperId && enabled.length > 0) {
        setSelectedScraperId(enabled[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedScraperId]);

  useEffect(() => {
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runBulkScrape() {
    if (!selectedScraperId) return;

    setRunning(true);
    setAborted(false);

    // Reset all rows to pending
    setRows((prev) =>
      prev
        .filter((r) => r.status !== "accepted")
        .map((r) => ({ ...r, status: "pending" as const, result: undefined, normalized: undefined, error: undefined }))
    );

    // Use a ref-like approach with a local variable for abort
    let shouldStop = false;

    // Store the abort handler so the stop button can set it
    const stopHandler = () => {
      shouldStop = true;
      setAborted(true);
    };
    setStopFn(() => stopHandler);

    for (let i = 0; i < rows.length; i++) {
      if (shouldStop) break;

      const row = rows[i];
      if (row.status === "accepted") continue;

      // Mark as scraping
      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" as const } : r))
      );

      try {
        const res = await scrapeScene(selectedScraperId, row.scene.id, "auto", {
          url: row.scene.filePath ? undefined : undefined,
        });

        if (res.result && res.normalized) {
          setRows((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? {
                    ...r,
                    status: "found" as const,
                    result: res.result,
                    normalized: res.normalized,
                    triedActions: res.triedActions,
                  }
                : r
            )
          );
        } else {
          setRows((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? {
                    ...r,
                    status: "no-result" as const,
                    triedActions: res.triedActions,
                    error: res.message,
                  }
                : r
            )
          );
        }
      } catch (err) {
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: "error" as const,
                  error: err instanceof Error ? err.message : "Scrape failed",
                }
              : r
          )
        );
      }
    }

    setRunning(false);
    setStopFn(null);
  }

  const [stopFn, setStopFn] = useState<(() => void) | null>(null);

  async function handleAccept(idx: number) {
    const row = rows[idx];
    if (!row.result) return;

    try {
      await acceptScrapeResult(row.result.id);
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" as const } : r))
      );
    } catch (err) {
      // Keep as found so user can retry
    }
  }

  async function handleReject(idx: number) {
    const row = rows[idx];
    if (!row.result) return;

    try {
      await rejectScrapeResult(row.result.id);
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "rejected" as const, result: undefined, normalized: undefined } : r))
      );
    } catch {
      // ignore
    }
  }

  async function handleAcceptAll() {
    const foundRows = rows
      .map((r, i) => ({ row: r, idx: i }))
      .filter(({ row }) => row.status === "found" && row.result);

    for (const { row, idx } of foundRows) {
      try {
        await acceptScrapeResult(row.result!.id);
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, status: "accepted" as const } : r))
        );
      } catch {
        // skip failures
      }
    }
  }

  const foundCount = rows.filter((r) => r.status === "found").length;
  const acceptedCount = rows.filter((r) => r.status === "accepted").length;
  const errorCount = rows.filter((r) => r.status === "error" || r.status === "no-result").length;
  const scrapedCount = rows.filter((r) => r.status !== "pending" && r.status !== "scraping").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (scrapers.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1>Scrape</h1>
          <p className="mt-1 text-text-muted text-sm">
            Bulk scrape metadata for unorganized scenes
          </p>
        </div>
        <div className="surface-well flex flex-col items-center justify-center py-16">
          <ScanSearch className="h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted text-sm">No scrapers installed.</p>
          <p className="text-text-disabled text-xs mt-1">
            Install scrapers from Settings to begin matching.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Scrape</h1>
          <p className="mt-1 text-text-muted text-sm">
            Bulk scrape metadata for unorganized scenes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {foundCount > 0 && !running && (
            <Button variant="primary" size="sm" onClick={() => void handleAcceptAll()}>
              <Check className="h-3.5 w-3.5" />
              Accept All ({foundCount})
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="surface-panel p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Scraper</label>
            <select
              className="control-input text-sm"
              value={selectedScraperId ?? ""}
              onChange={(e) => setSelectedScraperId(e.target.value)}
              disabled={running}
            >
              {scrapers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {running ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => stopFn?.()}
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void runBulkScrape()}
              disabled={rows.length === 0 || !selectedScraperId}
            >
              <Play className="h-3.5 w-3.5" />
              Scrape All ({rows.filter((r) => r.status !== "accepted").length})
            </Button>
          )}

          {scrapedCount > 0 && (
            <div className="flex items-center gap-2 ml-auto text-xs text-text-muted">
              {running && (
                <span>
                  {scrapedCount}/{totalScenes} scraped
                </span>
              )}
              {foundCount > 0 && <Badge variant="accent">{foundCount} found</Badge>}
              {acceptedCount > 0 && <Badge variant="default">{acceptedCount} accepted</Badge>}
              {errorCount > 0 && <Badge variant="default">{errorCount} missed</Badge>}
            </div>
          )}
        </div>
        <p className="text-text-disabled text-xs mt-2">
          Tries URL → Title → Fragment in order, using the first match.
        </p>
      </div>

      {/* Scene list */}
      {rows.length === 0 ? (
        <div className="surface-well flex flex-col items-center justify-center py-16">
          <Check className="h-8 w-8 text-success-text mx-auto mb-2" />
          <p className="text-text-muted text-sm">All scenes are organized!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map((row, idx) => (
            <div key={row.scene.id}>
              <button
                onClick={() =>
                  setExpandedId(expandedId === row.scene.id ? null : row.scene.id)
                }
                className={cn(
                  "w-full text-left surface-card p-3 flex items-center gap-3 transition-colors duration-fast",
                  expandedId === row.scene.id && "border-border-accent bg-accent-950/30"
                )}
              >
                {/* Status indicator */}
                <div className="flex-shrink-0 w-5">
                  {row.status === "scraping" && (
                    <Loader2 className="h-4 w-4 animate-spin text-accent-500" />
                  )}
                  {row.status === "found" && (
                    <div className="h-4 w-4 rounded-full bg-success-muted/40 flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-success-text" />
                    </div>
                  )}
                  {row.status === "accepted" && (
                    <div className="h-4 w-4 rounded-full bg-accent-500/30 flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-accent-500" />
                    </div>
                  )}
                  {(row.status === "error" || row.status === "no-result") && (
                    <AlertTriangle className="h-4 w-4 text-text-disabled" />
                  )}
                  {row.status === "rejected" && (
                    <X className="h-4 w-4 text-text-disabled" />
                  )}
                  {row.status === "pending" && (
                    <div className="h-4 w-4 rounded-full bg-surface-3" />
                  )}
                </div>

                {/* Thumbnail */}
                {row.scene.thumbnailPath ? (
                  <img
                    src={toApiUrl(row.scene.thumbnailPath)}
                    alt=""
                    className="w-16 h-10 object-cover rounded-sm flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-10 bg-surface-3 rounded-sm flex-shrink-0" />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{row.scene.title}</p>
                  <p className="text-text-disabled text-xs mt-0.5">
                    {row.scene.durationFormatted ?? "—"}
                    {row.scene.resolution && (
                      <span className="ml-2 text-text-muted">{row.scene.resolution}</span>
                    )}
                    {row.normalized?.studioName && (
                      <span className="ml-2 text-accent-500">{row.normalized.studioName}</span>
                    )}
                  </p>
                </div>

                {/* Quick accept/reject for found results */}
                {row.status === "found" && (
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => void handleAccept(idx)}
                      className="p-1.5 rounded-md hover:bg-success-muted/20 text-success-text transition-colors"
                      title="Accept"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void handleReject(idx)}
                      className="p-1.5 rounded-md hover:bg-error/10 text-text-disabled hover:text-error-text transition-colors"
                      title="Reject"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {row.status === "accepted" && (
                  <Badge variant="accent" className="text-[0.6rem] flex-shrink-0">Applied</Badge>
                )}

                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-text-disabled flex-shrink-0 transition-transform duration-fast",
                    expandedId === row.scene.id && "rotate-90"
                  )}
                />
              </button>

              {/* Expanded detail */}
              {expandedId === row.scene.id && row.normalized && (
                <div className="surface-panel ml-8 mr-2 mb-2 p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    {row.normalized.title && (
                      <MetaRow label="Title" value={row.normalized.title} />
                    )}
                    {row.normalized.date && (
                      <MetaRow label="Date" value={row.normalized.date} />
                    )}
                    {row.normalized.studioName && (
                      <MetaRow label="Studio" value={row.normalized.studioName} />
                    )}
                    {row.normalized.url && (
                      <MetaRow label="URL" value={row.normalized.url} />
                    )}
                    {row.normalized.performerNames.length > 0 && (
                      <MetaRow
                        label="Performers"
                        value={row.normalized.performerNames.join(", ")}
                      />
                    )}
                    {row.normalized.tagNames.length > 0 && (
                      <MetaRow
                        label="Tags"
                        value={row.normalized.tagNames.join(", ")}
                      />
                    )}
                  </div>
                  {row.triedActions && (
                    <p className="text-text-disabled text-xs">
                      Matched via: {row.triedActions.join(" → ")}
                    </p>
                  )}
                </div>
              )}

              {/* Error detail */}
              {expandedId === row.scene.id && row.error && (
                <div className="surface-panel ml-8 mr-2 mb-2 p-3 border border-error/10">
                  <p className="text-xs text-error-text">{row.error}</p>
                  {row.triedActions && (
                    <p className="text-text-disabled text-xs mt-1">
                      Tried: {row.triedActions.join(" → ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-span-2 sm:col-span-1">
      <span className="text-text-disabled text-xs uppercase tracking-wider">{label}</span>
      <p className="text-text-primary truncate">{value}</p>
    </div>
  );
}
