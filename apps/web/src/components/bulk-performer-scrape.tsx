"use client";

import { useCallback, useEffect, useState } from "react";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import {
  Check,
  X,
  Loader2,
  ScanSearch,
  Play,
  Square,
  Users,
  Image as ImageIcon,
} from "lucide-react";
import {
  fetchPerformers,
  fetchInstalledScrapers,
  scrapePerformerApi,
  applyPerformerScrape,
  toApiUrl,
  type PerformerItem,
  type ScraperPackage,
  type NormalizedPerformerScrapeResult,
} from "../lib/api";
import { entityTerms } from "../lib/terminology";

interface PerformerRow {
  performer: PerformerItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: NormalizedPerformerScrapeResult;
  error?: string;
}

export function BulkPerformerScrape() {
  const [rows, setRows] = useState<PerformerRow[]>([]);
  const [scrapers, setScrapers] = useState<ScraperPackage[]>([]);
  const [selectedScraperId, setSelectedScraperId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [aborted, setAborted] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [perfRes, scrapersRes] = await Promise.all([
        fetchPerformers({ sort: "name", order: "asc", limit: 100 }),
        fetchInstalledScrapers(),
      ]);

      // Filter to performers missing images or with sparse metadata
      const sparse = perfRes.performers.filter(
        (p) => !p.imagePath || !p.gender
      );
      setRows(sparse.map((performer) => ({ performer, status: "pending" })));

      const perfScrapers = scrapersRes.packages.filter((pkg) => {
        const caps = pkg.capabilities as Record<string, boolean> | null;
        return pkg.enabled && caps && (caps.performerByURL || caps.performerByName || caps.performerByFragment);
      });
      setScrapers(perfScrapers);
      if (!selectedScraperId && perfScrapers.length > 0) {
        setSelectedScraperId(perfScrapers[0].id);
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

    // Reset pending
    setRows((prev) =>
      prev.map((r) =>
        r.status === "accepted" || r.status === "rejected" ? r : { ...r, status: "pending" }
      )
    );

    for (let i = 0; i < rows.length; i++) {
      if (aborted) break;
      const row = rows[i];
      if (row.status === "accepted" || row.status === "rejected") continue;

      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r))
      );

      try {
        const res = await scrapePerformerApi(selectedScraperId, row.performer.id);
        const result = res.result ?? res.results?.[0] ?? null;

        if (result) {
          if (autoAccept) {
            // Auto-accept: apply all fields
            const allFields = Object.entries(result)
              .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
              .map(([k]) => k);
            try {
              await applyPerformerScrape(
                row.performer.id,
                result as unknown as Record<string, unknown>,
                allFields
              );
              setRows((prev) =>
                prev.map((r, idx) => (idx === i ? { ...r, status: "accepted", result } : r))
              );
            } catch {
              setRows((prev) =>
                prev.map((r, idx) => (idx === i ? { ...r, status: "found", result } : r))
              );
            }
          } else {
            setRows((prev) =>
              prev.map((r, idx) => (idx === i ? { ...r, status: "found", result } : r))
            );
          }
        } else {
          setRows((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r))
          );
        }
      } catch (err) {
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "error", error: String(err) } : r))
        );
      }
    }

    setRunning(false);
  }

  async function acceptRow(index: number) {
    const row = rows[index];
    if (!row.result) return;

    const allFields = Object.entries(row.result)
      .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k]) => k);

    try {
      await applyPerformerScrape(
        row.performer.id,
        row.result as unknown as Record<string, unknown>,
        allFields
      );
      setRows((prev) =>
        prev.map((r, idx) => (idx === index ? { ...r, status: "accepted" } : r))
      );
    } catch (err) {
      console.error(err);
    }
  }

  function rejectRow(index: number) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === index ? { ...r, status: "rejected" } : r))
    );
  }

  function acceptAll() {
    rows.forEach((row, i) => {
      if (row.status === "found" && row.result) {
        acceptRow(i);
      }
    });
  }

  const processed = rows.filter((r) => r.status !== "pending").length;
  const found = rows.filter((r) => r.status === "found").length;
  const accepted = rows.filter((r) => r.status === "accepted").length;
  const progress = rows.length > 0 ? Math.round((processed / rows.length) * 100) : 0;

  if (loading) {
    return (
      <div className="surface-well p-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-text-disabled animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-heading font-semibold">
            <ScanSearch className="h-5 w-5 text-text-accent" />
            Bulk {entityTerms.performer} scrape
          </h2>
          <p className="text-text-muted text-[0.78rem] mt-1">
            Scrape metadata for performers missing images or gender info
          </p>
        </div>
        <span className="text-mono-sm text-text-disabled">
          {rows.length} performer{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Controls */}
      <div className="surface-well p-3 flex items-center gap-3 flex-wrap">
        <select
          value={selectedScraperId ?? ""}
          onChange={(e) => setSelectedScraperId(e.target.value)}
          className="control-input py-1.5 text-xs flex-1 min-w-[200px]"
          disabled={running}
        >
          {scrapers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
          <Checkbox
            checked={autoAccept}
            onChange={(e) => setAutoAccept(e.target.checked)}
            disabled={running}
          />
          Auto-accept
        </label>

        {!running ? (
          <button
            onClick={runBulkScrape}
            disabled={!selectedScraperId || rows.length === 0}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all duration-fast",
              "bg-accent-950 text-text-accent border border-border-accent",
              "hover:bg-accent-900 disabled:opacity-50"
            )}
          >
            <Play className="h-3 w-3" />
            Start
          </button>
        ) : (
          <button
            onClick={() => setAborted(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium text-status-error border border-status-error/30 hover:bg-status-error/10 transition-all duration-fast"
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        )}

        {found > 0 && !running && (
          <button
            onClick={acceptAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-status-success border border-status-success/30 hover:bg-status-success/10 transition-all duration-fast"
          >
            <Check className="h-3 w-3" />
            Accept All ({found})
          </button>
        )}
      </div>

      {/* Progress bar */}
      {running && (
        <div className="surface-well p-2">
          <div className="h-1.5 bg-surface-3 overflow-hidden">
            <div
              className="h-full bg-accent-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[0.65rem] text-text-disabled font-mono">
            <span>{processed} / {rows.length}</span>
            <span>{accepted} accepted</span>
          </div>
        </div>
      )}

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="surface-well p-12 text-center">
          <Users className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">All performers have complete metadata.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map((row, i) => (
            <div
              key={row.performer.id}
              className={cn(
                "surface-well flex items-center gap-3 px-3 py-2.5 transition-colors duration-fast",
                row.status === "accepted" && "opacity-60",
                row.status === "rejected" && "opacity-40"
              )}
            >
              {/* Image */}
              <div className="flex-shrink-0 h-10 w-8 rounded overflow-hidden bg-surface-3">
                {row.performer.imagePath ? (
                  <img
                    src={toApiUrl(row.performer.imagePath)!}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-3 w-3 text-text-disabled/40" />
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary truncate">{row.performer.name}</div>
                {row.result && row.status === "found" && (
                  <div className="text-[0.65rem] text-text-muted truncate mt-0.5">
                    {[row.result.gender, row.result.country, row.result.birthdate].filter(Boolean).join(" | ")}
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {row.status === "pending" && (
                  <span className="text-[0.65rem] text-text-disabled">Pending</span>
                )}
                {row.status === "scraping" && (
                  <Loader2 className="h-3.5 w-3.5 text-text-accent animate-spin" />
                )}
                {row.status === "found" && (
                  <>
                    <button
                      onClick={() => acceptRow(i)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[0.65rem] text-status-success border border-status-success/30 hover:bg-status-success/10 transition-colors"
                    >
                      <Check className="h-2.5 w-2.5" />
                      Accept
                    </button>
                    <button
                      onClick={() => rejectRow(i)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[0.65rem] text-text-muted hover:text-status-error transition-colors"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </>
                )}
                {row.status === "no-result" && (
                  <span className="text-[0.65rem] text-text-disabled">No result</span>
                )}
                {row.status === "error" && (
                  <span className="text-[0.65rem] text-status-error">Error</span>
                )}
                {row.status === "accepted" && (
                  <span className="flex items-center gap-1 text-[0.65rem] text-status-success">
                    <Check className="h-2.5 w-2.5" />
                    Applied
                  </span>
                )}
                {row.status === "rejected" && (
                  <span className="text-[0.65rem] text-text-disabled">Skipped</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
