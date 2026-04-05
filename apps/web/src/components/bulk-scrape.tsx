"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, cn } from "@obscura/ui";
import {
  Check,
  X,
  Loader2,
  ScanSearch,
  Play,
  Square,
  ChevronDown,
  Film,
  Users,
  SkipForward,
  Image as ImageIcon,
} from "lucide-react";
import {
  fetchScenes,
  fetchPerformers,
  fetchInstalledScrapers,
  scrapeScene,
  scrapePerformerApi,
  acceptScrapeResult,
  rejectScrapeResult,
  applyPerformerScrape,
  toApiUrl,
  type SceneListItem,
  type PerformerItem,
  type ScraperPackage,
  type ScrapeResult,
  type NormalizedScrapeResult,
  type NormalizedPerformerScrapeResult,
} from "../lib/api";

/* ─── Types ────────────────────────────────────────────────────── */

type Tab = "scenes" | "performers";

const SCENE_FIELDS = ["title", "date", "details", "url", "studio", "performers", "tags", "image"] as const;
type SceneField = typeof SCENE_FIELDS[number];

interface SceneRow {
  scene: SceneListItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<SceneField>;
}

interface PerformerRow {
  performer: PerformerItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: NormalizedPerformerScrapeResult;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<string>;
}

/* ─── Seek timeout ──────────────────────────────────────────────── */
const SEEK_TIMEOUT_MS = 5_000;

function perfFieldsFromResult(result: NormalizedPerformerScrapeResult): Set<string> {
  return new Set(
    Object.entries(result)
      .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k]) => k)
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Scraper timeout")), ms)
    ),
  ]);
}

/* ─── Component ─────────────────────────────────────────────────── */

export function BulkScrape() {
  const [tab, setTab] = useState<Tab>("scenes");
  const [scrapers, setScrapers] = useState<ScraperPackage[]>([]);
  const [loading, setLoading] = useState(true);

  // Scene state
  const [sceneRows, setSceneRows] = useState<SceneRow[]>([]);
  const [sceneScrapers, setSceneScrapers] = useState<ScraperPackage[]>([]);

  // Performer state
  const [perfRows, setPerfRows] = useState<PerformerRow[]>([]);
  const [perfScrapers, setPerfScrapers] = useState<ScraperPackage[]>([]);

  // All items for show-all toggle
  const [allScenes, setAllScenes] = useState<SceneListItem[]>([]);
  const [allPerformers, setAllPerformers] = useState<PerformerItem[]>([]);

  // Shared
  const [running, setRunning] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [selectedScraperId, setSelectedScraperId] = useState<string>(""); // "" = seek all
  const [showAll, setShowAll] = useState(false);
  const abortRef = useRef(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    if (tab === "performers") {
      const allIds = perfRows.map((r) => r.performer.id);
      setExpandedIds(new Set(allIds));
    } else {
      const allIds = sceneRows.map((r) => r.scene.id);
      setExpandedIds(new Set(allIds));
    }
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function toggleSceneField(idx: number, field: SceneField) {
    setSceneRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.selectedFields);
        if (next.has(field)) next.delete(field);
        else next.add(field);
        return { ...r, selectedFields: next };
      })
    );
  }

  function togglePerfField(idx: number, field: string) {
    setPerfRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.selectedFields);
        if (next.has(field)) next.delete(field);
        else next.add(field);
        return { ...r, selectedFields: next };
      })
    );
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scenesRes, perfRes, scrapersRes] = await Promise.all([
        fetchScenes({ sort: "created_at", limit: 500 }),
        fetchPerformers({ sort: "name", order: "asc", limit: 200 }),
        fetchInstalledScrapers(),
      ]);

      const unorganized = scenesRes.scenes.filter((s) => !s.organized);
      setSceneRows(unorganized.map((scene) => ({ scene, status: "pending", selectedFields: new Set(SCENE_FIELDS) })));

      const sparse = perfRes.performers.filter((p) => !p.imagePath || !p.gender);
      setPerfRows(sparse.map((performer) => ({ performer, status: "pending", selectedFields: new Set() })));

      // Store all for show-all toggle
      setAllScenes(scenesRes.scenes);
      setAllPerformers(perfRes.performers);

      const enabled = scrapersRes.packages.filter((s) => s.enabled);
      setScrapers(enabled);

      // Filter by capability
      const sceneCapable = enabled.filter((pkg) => {
        const caps = pkg.capabilities as Record<string, boolean> | null;
        return caps && (caps.sceneByURL || caps.sceneByFragment || caps.sceneByName || caps.sceneByQueryFragment);
      });
      setSceneScrapers(sceneCapable);

      const perfCapable = enabled.filter((pkg) => {
        const caps = pkg.capabilities as Record<string, boolean> | null;
        return caps && (caps.performerByURL || caps.performerByName || caps.performerByFragment);
      });
      setPerfScrapers(perfCapable);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Rebuild rows when showAll toggles
  useEffect(() => {
    if (!allScenes.length && !allPerformers.length) return;
    const filteredScenes = showAll ? allScenes : allScenes.filter((s) => !s.organized);
    setSceneRows((prev) => {
      const existing = new Map(prev.map((r) => [r.scene.id, r]));
      return filteredScenes.map((scene) => existing.get(scene.id) ?? { scene, status: "pending", selectedFields: new Set(SCENE_FIELDS) });
    });
    const filteredPerfs = showAll ? allPerformers : allPerformers.filter((p) => !p.imagePath || !p.gender);
    setPerfRows((prev) => {
      const existing = new Map(prev.map((r) => [r.performer.id, r]));
      return filteredPerfs.map((performer) => existing.get(performer.id) ?? { performer, status: "pending", selectedFields: new Set() });
    });
  }, [showAll, allScenes, allPerformers]);

  /* ─── Scene seek ────────────────────────────────────────────── */

  async function seekScene(row: SceneRow, scraperList: ScraperPackage[]): Promise<{
    result?: ScrapeResult;
    normalized?: NormalizedScrapeResult;
    matchedScraper?: string;
  }> {
    for (const scraper of scraperList) {
      try {
        const res = await withTimeout(
          scrapeScene(scraper.id, row.scene.id, "auto"),
          SEEK_TIMEOUT_MS
        );
        if (res.result && res.normalized) {
          return { result: res.result, normalized: res.normalized, matchedScraper: scraper.name };
        }
      } catch {
        // Timeout or error — try next
      }
    }
    return {};
  }

  async function runSceneScrape() {
    setRunning(true);
    abortRef.current = false;

    // Determine scraper list: single selected or seek through all
    const scraperList = selectedScraperId
      ? sceneScrapers.filter((s) => s.id === selectedScraperId)
      : sceneScrapers;

    // Reset non-accepted rows
    setSceneRows((prev) =>
      prev.map((r) =>
        r.status === "accepted" ? r : { ...r, status: "pending", result: undefined, normalized: undefined, error: undefined }
      )
    );

    for (let i = 0; i < sceneRows.length; i++) {
      if (abortRef.current) break;
      if (sceneRows[i].status === "accepted") continue;

      setSceneRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r))
      );

      try {
        const { result, normalized, matchedScraper } = await seekScene(sceneRows[i], scraperList);
        if (result && normalized) {
          if (autoAccept) {
            try {
              await acceptScrapeResult(result.id);
              setSceneRows((prev) =>
                prev.map((r, idx) =>
                  idx === i ? { ...r, status: "accepted", result, normalized, matchedScraper } : r
                )
              );
            } catch {
              setSceneRows((prev) =>
                prev.map((r, idx) =>
                  idx === i ? { ...r, status: "found", result, normalized, matchedScraper } : r
                )
              );
            }
          } else {
            setSceneRows((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, status: "found", result, normalized, matchedScraper } : r
              )
            );
          }
        } else {
          setSceneRows((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r))
          );
        }
      } catch (err) {
        setSceneRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" } : r
          )
        );
      }
    }
    setRunning(false);
  }

  /* ─── Performer seek ─────────────────────────────────────────── */

  async function seekPerformer(row: PerformerRow, scraperList: ScraperPackage[]): Promise<{
    result?: NormalizedPerformerScrapeResult;
    matchedScraper?: string;
  }> {
    const performerName = row.performer.name.toLowerCase().trim();

    for (const scraper of scraperList) {
      try {
        const res = await withTimeout(
          scrapePerformerApi(scraper.id, row.performer.id, { action: "auto" }),
          SEEK_TIMEOUT_MS
        );

        // If the API found an exact match, use it directly
        if (res.result) {
          return { result: res.result, matchedScraper: scraper.name };
        }

        // If we got an array of search results, find the best match
        if (res.results && res.results.length > 0) {
          // Exact match
          const exact = res.results.find(
            (r) => r.name?.toLowerCase().trim() === performerName
          );
          if (exact) {
            return { result: exact, matchedScraper: scraper.name };
          }
          // Skip partial matches — too high false positive rate
        }
      } catch {
        // Timeout or error — try next
      }
    }
    return {};
  }

  async function runPerformerScrape() {
    setRunning(true);
    abortRef.current = false;

    const scraperList = selectedScraperId
      ? perfScrapers.filter((s) => s.id === selectedScraperId)
      : perfScrapers;

    setPerfRows((prev) =>
      prev.map((r) =>
        r.status === "accepted" ? r : { ...r, status: "pending", result: undefined, error: undefined }
      )
    );

    for (let i = 0; i < perfRows.length; i++) {
      if (abortRef.current) break;
      if (perfRows[i].status === "accepted") continue;

      setPerfRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r))
      );

      try {
        const { result, matchedScraper } = await seekPerformer(perfRows[i], scraperList);
        if (result) {
          if (autoAccept) {
            const allFields = Object.entries(result)
              .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
              .map(([k]) => k);
            try {
              await applyPerformerScrape(
                perfRows[i].performer.id,
                result as unknown as Record<string, unknown>,
                allFields
              );
              setPerfRows((prev) =>
                prev.map((r, idx) =>
                  idx === i ? { ...r, status: "accepted", result, matchedScraper } : r
                )
              );
            } catch {
              setPerfRows((prev) =>
                prev.map((r, idx) =>
                  idx === i ? { ...r, status: "found", result, matchedScraper, selectedFields: perfFieldsFromResult(result) } : r
                )
              );
            }
          } else {
            setPerfRows((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, status: "found", result, matchedScraper, selectedFields: perfFieldsFromResult(result) } : r
              )
            );
          }
        } else {
          setPerfRows((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r))
          );
        }
      } catch (err) {
        setPerfRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" } : r
          )
        );
      }
    }
    setRunning(false);
  }

  /* ─── Accept / Reject handlers ───────────────────────────────── */

  async function acceptScene(idx: number) {
    const row = sceneRows[idx];
    if (!row.result) return;
    try {
      await acceptScrapeResult(row.result.id, Array.from(row.selectedFields));
      setSceneRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r))
      );
    } catch { /* keep as found */ }
  }

  async function rejectScene(idx: number) {
    const row = sceneRows[idx];
    if (!row.result) return;
    try {
      await rejectScrapeResult(row.result.id);
      setSceneRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "rejected", result: undefined, normalized: undefined } : r))
      );
    } catch { /* ignore */ }
  }

  async function acceptAllScenes() {
    const found = sceneRows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.status === "found" && row.result);
    for (const { row, idx } of found) {
      try {
        await acceptScrapeResult(row.result!.id);
        setSceneRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r))
        );
      } catch { /* skip */ }
    }
  }

  async function acceptPerformer(idx: number, overrideImageUrl?: string) {
    const row = perfRows[idx];
    if (!row.result) return;
    const fields = { ...row.result } as Record<string, unknown>;
    if (overrideImageUrl) {
      fields.imageUrl = overrideImageUrl;
    }
    try {
      await applyPerformerScrape(
        row.performer.id,
        fields,
        Array.from(row.selectedFields)
      );
      setPerfRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r))
      );
    } catch { /* keep as found */ }
  }

  function rejectPerformer(idx: number) {
    setPerfRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "rejected" } : r))
    );
  }

  async function acceptAllPerformers() {
    const found = perfRows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.status === "found" && row.result);
    for (const { idx } of found) {
      await acceptPerformer(idx);
    }
  }

  /* ─── Stats ──────────────────────────────────────────────────── */

  const rows = tab === "scenes" ? sceneRows : perfRows;
  const foundCount = rows.filter((r) => r.status === "found").length;
  const acceptedCount = rows.filter((r) => r.status === "accepted").length;
  const missedCount = rows.filter((r) => r.status === "no-result" || r.status === "error").length;
  const processedCount = rows.filter((r) => r.status !== "pending" && r.status !== "scraping").length;
  const totalCount = rows.length;
  const scrapersForTab = tab === "scenes" ? sceneScrapers : perfScrapers;

  /* ─── Render ─────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5">
            <ScanSearch className="h-5 w-5 text-text-accent" />
            Bulk Scrape
          </h1>
          <p className="mt-1 text-text-muted text-[0.78rem]">
            Seek through all installed scrapers to enrich metadata
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1">
        {([
          { key: "scenes" as Tab, label: "Scenes", icon: Film, count: sceneRows.length },
          { key: "performers" as Tab, label: "Performers", icon: Users, count: perfRows.length },
        ]).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => { if (!running) setTab(key); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-[3px] text-sm font-medium transition-all duration-fast",
              tab === key
                ? "bg-accent-950 text-text-accent border border-border-accent shadow-[var(--shadow-glow-accent)]"
                : "text-text-muted border border-transparent hover:text-text-secondary hover:bg-surface-3/40",
              running && tab !== key && "opacity-40 cursor-not-allowed"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span className="text-mono-sm text-text-disabled ml-1">{count}</span>
          </button>
        ))}
      </div>

      {/* Stats strip */}
      {processedCount > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="surface-stat px-3 py-2">
            <span className="text-kicker !text-text-disabled">Processed</span>
            <div className="text-lg font-semibold text-text-primary leading-tight">{processedCount}</div>
            {running && (
              <div className="meter-track mt-1.5">
                <div className="meter-fill" style={{ width: `${Math.round((processedCount / totalCount) * 100)}%` }} />
              </div>
            )}
          </div>
          <div className={cn("surface-stat px-3 py-2", foundCount > 0 && "surface-stat-accent")}>
            <span className="text-kicker !text-text-disabled">Found</span>
            <div className={cn("text-lg font-semibold leading-tight", foundCount > 0 ? "text-text-accent" : "text-text-primary")}>
              {foundCount}
            </div>
          </div>
          <div className="surface-stat px-3 py-2">
            <span className="text-kicker !text-text-disabled">Accepted</span>
            <div className="text-lg font-semibold text-status-success-text leading-tight">{acceptedCount}</div>
          </div>
          <div className="surface-stat px-3 py-2">
            <span className="text-kicker !text-text-disabled">Missed</span>
            <div className="text-lg font-semibold text-text-muted leading-tight">{missedCount}</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="surface-card-sharp no-lift p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Scraper selector */}
          <div className="flex items-center gap-2">
            <select
              value={selectedScraperId}
              onChange={(e) => setSelectedScraperId(e.target.value)}
              className="control-input py-1.5 text-xs min-w-[200px]"
              disabled={running}
            >
              <option value="">Seek all ({scrapersForTab.length} scrapers)</option>
              {scrapersForTab.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={autoAccept}
              onChange={(e) => setAutoAccept(e.target.checked)}
              className="accent-[#c79b5c]"
              disabled={running}
            />
            Auto-accept
          </label>

          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="accent-[#c79b5c]"
              disabled={running}
            />
            Show all
          </label>

          <div className="flex-1" />

          {!running ? (
            <div className="flex items-center gap-2">
              {foundCount > 0 && (
                <button
                  onClick={() => void (tab === "scenes" ? acceptAllScenes() : acceptAllPerformers())}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-medium text-status-success-text border border-status-success/30 hover:bg-status-success/10 transition-all duration-fast"
                >
                  <Check className="h-3 w-3" />
                  Accept All ({foundCount})
                </button>
              )}
              <button
                onClick={() => void (tab === "scenes" ? runSceneScrape() : runPerformerScrape())}
                disabled={totalCount === 0 || scrapersForTab.length === 0}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-[3px] text-xs font-medium transition-all duration-normal",
                  "bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900",
                  "text-accent-200 border border-border-accent shadow-[var(--shadow-glow-accent)]",
                  "hover:shadow-[var(--shadow-glow-accent-strong)] hover:border-border-accent-strong",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {selectedScraperId ? <Play className="h-3 w-3" /> : <SkipForward className="h-3 w-3" />}
                {selectedScraperId ? `Scrape All (${totalCount - acceptedCount})` : `Seek All (${totalCount - acceptedCount})`}
              </button>
            </div>
          ) : (
            <button
              onClick={() => { abortRef.current = true; }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-[3px] text-xs font-medium text-status-error-text border border-status-error/30 hover:bg-status-error/10 transition-all duration-fast"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          )}
        </div>

        {!selectedScraperId && (
          <div className="flex items-center gap-1.5 text-[0.65rem] text-text-disabled">
            <SkipForward className="h-3 w-3 text-text-accent" />
            Cycles through all scrapers per item with 5s timeout each — select a specific scraper above to use only one
          </div>
        )}
      </div>

      {/* Empty state */}
      {scrapersForTab.length === 0 && (
        <div className="surface-card-sharp no-lift p-12 text-center">
          <ScanSearch className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            No {tab === "scenes" ? "scene" : "performer"} scrapers installed.
          </p>
          <p className="text-text-disabled text-xs mt-1">
            Install scrapers from Settings to begin matching.
          </p>
        </div>
      )}

      {totalCount === 0 && scrapersForTab.length > 0 && (
        <div className="surface-card-sharp no-lift p-12 text-center">
          <Check className="h-8 w-8 text-status-success-text mx-auto mb-2" />
          <p className="text-text-muted text-sm">
            {tab === "scenes" ? "All scenes are organized!" : "All performers have complete metadata."}
          </p>
        </div>
      )}

      {/* Row list */}
      {totalCount > 0 && scrapersForTab.length > 0 && (
        <div className="space-y-1">
          {/* Expand all / collapse all */}
          <div className="flex items-center justify-end gap-2 px-1 mb-1">
            <button
              onClick={expandedIds.size > 0 ? collapseAll : expandAll}
              className="text-[0.65rem] text-text-muted hover:text-text-primary transition-colors"
            >
              {expandedIds.size > 0 ? "Collapse all" : "Expand all"}
            </button>
          </div>

          {tab === "scenes"
            ? sceneRows.map((row, idx) => (
                <SceneRowCard
                  key={row.scene.id}
                  row={row}
                  expanded={expandedIds.has(row.scene.id)}
                  onToggleExpand={() => toggleExpanded(row.scene.id)}
                  onAccept={() => void acceptScene(idx)}
                  onReject={() => void rejectScene(idx)}
                  onToggleField={(field) => toggleSceneField(idx, field)}
                />
              ))
            : perfRows.map((row, idx) => (
                <PerformerRowCard
                  key={row.performer.id}
                  row={row}
                  expanded={expandedIds.has(row.performer.id)}
                  onToggleExpand={() => toggleExpanded(row.performer.id)}
                  onAccept={(imageUrl) => void acceptPerformer(idx, imageUrl)}
                  onReject={() => rejectPerformer(idx)}
                  onToggleField={(field) => togglePerfField(idx, field)}
                />
              ))}
        </div>
      )}
    </div>
  );
}

/* ─── Scene row ────────────────────────────────────────────────── */

function SceneRowCard({
  row,
  expanded,
  onToggleExpand,
  onAccept,
  onReject,
  onToggleField,
}: {
  row: SceneRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onToggleField: (field: SceneField) => void;
}) {
  return (
    <div>
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(); }}
        className={cn(
          "w-full text-left surface-card-sharp no-lift p-3 flex items-center gap-3 transition-all duration-fast cursor-pointer",
          expanded && "border-border-accent/40",
          row.status === "accepted" && "opacity-50",
          row.status === "rejected" && "opacity-30"
        )}
      >
        <StatusDot status={row.status} />

        {/* Thumbnail */}
        {row.scene.thumbnailPath ? (
          <img
            src={toApiUrl(row.scene.thumbnailPath)}
            alt=""
            className="w-16 h-10 object-cover rounded-[2px] flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-10 bg-surface-3 rounded-[2px] flex-shrink-0" />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[0.8rem] font-medium truncate">{row.scene.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-text-disabled text-[0.65rem]">{row.scene.durationFormatted ?? "—"}</span>
            {row.scene.resolution && (
              <span className="pill-accent px-1 py-0 text-[0.55rem]">{row.scene.resolution}</span>
            )}
            {row.normalized?.studioName && (
              <span className="text-text-accent text-[0.65rem]">{row.normalized.studioName}</span>
            )}
            {row.matchedScraper && row.status !== "pending" && (
              <span className="text-text-disabled text-[0.6rem] font-mono">via {row.matchedScraper}</span>
            )}
          </div>
        </div>

        {/* Actions for found */}
        {row.status === "found" && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onAccept(); }}
              className="p-1.5 rounded-[3px] hover:bg-status-success/15 text-status-success-text transition-colors"
              title="Accept"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              className="p-1.5 rounded-[3px] hover:bg-status-error/10 text-text-disabled hover:text-status-error-text transition-colors"
              title="Reject"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {row.status === "accepted" && (
          <Badge variant="accent" className="text-[0.55rem] flex-shrink-0">Applied</Badge>
        )}

        <ChevronDown
          className={cn(
            "h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast",
            expanded && "rotate-180"
          )}
        />
      </div>

      {/* Expanded detail */}
      {expanded && row.normalized && (
        <div className="surface-card-sharp no-lift ml-6 mr-1 mb-1 p-3 border-border-accent/20">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[0.8rem]">
            {row.normalized.title && (
              <ToggleableField field="title" label="Title" value={row.normalized.title} enabled={row.selectedFields.has("title")} onToggle={() => onToggleField("title")} />
            )}
            {row.normalized.date && (
              <ToggleableField field="date" label="Date" value={row.normalized.date} enabled={row.selectedFields.has("date")} onToggle={() => onToggleField("date")} />
            )}
            {row.normalized.studioName && (
              <ToggleableField field="studio" label="Studio" value={row.normalized.studioName} enabled={row.selectedFields.has("studio")} onToggle={() => onToggleField("studio")} />
            )}
            {row.normalized.url && (
              <ToggleableField field="url" label="URL" value={row.normalized.url} enabled={row.selectedFields.has("url")} onToggle={() => onToggleField("url")} />
            )}
            {row.normalized.performerNames.length > 0 && (
              <ToggleableField field="performers" label="Performers" value={row.normalized.performerNames.join(", ")} enabled={row.selectedFields.has("performers")} onToggle={() => onToggleField("performers")} />
            )}
            {row.normalized.tagNames.length > 0 && (
              <ToggleableField field="tags" label="Tags" value={row.normalized.tagNames.join(", ")} enabled={row.selectedFields.has("tags")} onToggle={() => onToggleField("tags")} />
            )}
            {row.normalized.imageUrl && (
              <ToggleableField field="image" label="Thumbnail" value="Available" enabled={row.selectedFields.has("image")} onToggle={() => onToggleField("image")} />
            )}
          </div>
        </div>
      )}

      {expanded && row.error && (
        <div className="surface-card-sharp no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
          <p className="text-[0.7rem] text-status-error-text">{row.error}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Performer row ────────────────────────────────────────────── */

function PerformerRowCard({
  row,
  expanded,
  onToggleExpand,
  onAccept,
  onReject,
  onToggleField,
}: {
  row: PerformerRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: (imageUrl?: string) => void;
  onReject: () => void;
  onToggleField: (field: string) => void;
}) {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // All available images: imageUrls array + imageUrl single
  const allImages = row.result
    ? [...new Set([
        ...(row.result.imageUrl ? [row.result.imageUrl] : []),
        ...(row.result.imageUrls ?? []),
      ].filter((u) => u.startsWith("http") || u.startsWith("data:image/")))]
    : [];

  const effectiveImageUrl = selectedImageUrl ?? allImages[0] ?? null;
  return (
    <div>
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(); }}
        className={cn(
          "surface-card-sharp no-lift flex items-center gap-3 px-3 py-2.5 transition-all duration-fast cursor-pointer",
          expanded && "border-border-accent/40",
          row.status === "accepted" && "opacity-50",
          row.status === "rejected" && "opacity-30"
        )}
      >
        <StatusDot status={row.status} />

        {/* Image */}
        <div className="flex-shrink-0 h-10 w-8 rounded-[2px] overflow-hidden bg-surface-3">
          {row.performer.imagePath ? (
            <img src={toApiUrl(row.performer.imagePath)!} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-3 w-3 text-text-disabled/40" />
            </div>
          )}
        </div>

        {/* Name + scraped summary */}
        <div className="flex-1 min-w-0">
          <div className="text-[0.8rem] font-medium text-text-primary truncate">{row.performer.name}</div>
          {row.result && (row.status === "found" || row.status === "accepted") && (
            <div className="text-[0.62rem] text-text-muted truncate mt-0.5">
              {[row.result.gender, row.result.country, row.result.birthdate].filter(Boolean).join(" | ")}
            </div>
          )}
          {row.matchedScraper && row.status !== "pending" && (
            <span className="text-text-disabled text-[0.58rem] font-mono">via {row.matchedScraper}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {row.status === "scraping" && (
            <Loader2 className="h-3.5 w-3.5 text-text-accent animate-spin" />
          )}
          {row.status === "found" && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onAccept(effectiveImageUrl ?? undefined); }}
                className="flex items-center gap-1 px-2 py-1 rounded-[3px] text-[0.62rem] text-status-success-text border border-status-success/25 hover:bg-status-success/10 transition-colors"
              >
                <Check className="h-2.5 w-2.5" />
                Accept
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                className="p-1 rounded-[3px] text-text-disabled hover:text-status-error-text transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          {row.status === "no-result" && <span className="text-[0.62rem] text-text-disabled">No result</span>}
          {row.status === "error" && <span className="text-[0.62rem] text-status-error-text">Error</span>}
          {row.status === "accepted" && (
            <Badge variant="accent" className="text-[0.55rem]">Applied</Badge>
          )}
          {row.status === "rejected" && <span className="text-[0.62rem] text-text-disabled">Skipped</span>}
        </div>

        <ChevronDown
          className={cn(
            "h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast",
            expanded && "rotate-180"
          )}
        />
      </div>

      {/* Expanded performer detail */}
      {expanded && row.result && (
        <div className="surface-card-sharp no-lift ml-6 mr-1 mb-1 p-3 border-border-accent/20">
          <div className="flex gap-4">
            {/* Image selection */}
            {allImages.length > 0 && (
              <div className="flex-shrink-0 space-y-2">
                {/* Selected/primary image */}
                <div className="w-24 h-32 rounded-[3px] overflow-hidden bg-surface-3 border border-border-subtle">
                  {effectiveImageUrl && (
                    <img src={effectiveImageUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                {/* Thumbnails for selection (only if multiple) */}
                {allImages.length > 1 && (
                  <div className="flex gap-1 flex-wrap max-w-[120px]">
                    {allImages.slice(0, 8).map((url, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setSelectedImageUrl(url); }}
                        className={cn(
                          "w-7 h-9 rounded-[2px] overflow-hidden bg-surface-3 transition-all duration-fast flex-shrink-0",
                          (selectedImageUrl ?? allImages[0]) === url
                            ? "border-2 border-border-accent shadow-[var(--shadow-glow-accent)]"
                            : "border border-border-subtle hover:border-text-muted opacity-70 hover:opacity-100"
                        )}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                    {allImages.length > 8 && (
                      <span className="text-[0.55rem] text-text-disabled self-center">+{allImages.length - 8}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Metadata fields */}
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-[0.8rem]">
                {row.result.name && <ToggleableField field="name" label="Name" value={row.result.name} enabled={row.selectedFields.has("name")} onToggle={() => onToggleField("name")} />}
                {row.result.gender && <ToggleableField field="gender" label="Gender" value={row.result.gender} enabled={row.selectedFields.has("gender")} onToggle={() => onToggleField("gender")} />}
                {row.result.birthdate && <ToggleableField field="birthdate" label="Birthdate" value={row.result.birthdate} enabled={row.selectedFields.has("birthdate")} onToggle={() => onToggleField("birthdate")} />}
                {row.result.country && <ToggleableField field="country" label="Country" value={row.result.country} enabled={row.selectedFields.has("country")} onToggle={() => onToggleField("country")} />}
                {row.result.ethnicity && <ToggleableField field="ethnicity" label="Ethnicity" value={row.result.ethnicity} enabled={row.selectedFields.has("ethnicity")} onToggle={() => onToggleField("ethnicity")} />}
                {row.result.height && <ToggleableField field="height" label="Height" value={row.result.height} enabled={row.selectedFields.has("height")} onToggle={() => onToggleField("height")} />}
                {row.result.weight && <ToggleableField field="weight" label="Weight" value={String(row.result.weight)} enabled={row.selectedFields.has("weight")} onToggle={() => onToggleField("weight")} />}
                {row.result.hairColor && <ToggleableField field="hairColor" label="Hair" value={row.result.hairColor} enabled={row.selectedFields.has("hairColor")} onToggle={() => onToggleField("hairColor")} />}
                {row.result.eyeColor && <ToggleableField field="eyeColor" label="Eyes" value={row.result.eyeColor} enabled={row.selectedFields.has("eyeColor")} onToggle={() => onToggleField("eyeColor")} />}
                {row.result.measurements && <ToggleableField field="measurements" label="Measurements" value={row.result.measurements} enabled={row.selectedFields.has("measurements")} onToggle={() => onToggleField("measurements")} />}
                {row.result.aliases && <ToggleableField field="aliases" label="Aliases" value={row.result.aliases} enabled={row.selectedFields.has("aliases")} onToggle={() => onToggleField("aliases")} />}
                {row.result.tattoos && <ToggleableField field="tattoos" label="Tattoos" value={row.result.tattoos} enabled={row.selectedFields.has("tattoos")} onToggle={() => onToggleField("tattoos")} />}
                {row.result.piercings && <ToggleableField field="piercings" label="Piercings" value={row.result.piercings} enabled={row.selectedFields.has("piercings")} onToggle={() => onToggleField("piercings")} />}
                {row.result.tagNames.length > 0 && (
                  <ToggleableField field="tagNames" label="Tags" value={row.result.tagNames.join(", ")} enabled={row.selectedFields.has("tagNames")} onToggle={() => onToggleField("tagNames")} />
                )}
                {allImages.length > 0 && (
                  <ToggleableField field="imageUrl" label="Image" value={`${allImages.length} available`} enabled={row.selectedFields.has("imageUrl")} onToggle={() => onToggleField("imageUrl")} />
                )}
              </div>
              {row.result.details && (
                <div className="mt-2">
                  <ToggleableField field="details" label="Details" value={row.result.details.slice(0, 200) + (row.result.details.length > 200 ? "..." : "")} enabled={row.selectedFields.has("details")} onToggle={() => onToggleField("details")} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {expanded && row.error && (
        <div className="surface-card-sharp no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
          <p className="text-[0.7rem] text-status-error-text">{row.error}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Shared small components ──────────────────────────────────── */

function StatusDot({ status }: { status: string }) {
  return (
    <div className="flex-shrink-0 w-4">
      {status === "scraping" && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-accent" />}
      {status === "found" && <div className="led led-active" />}
      {status === "accepted" && <div className="led led-accent" />}
      {(status === "error" || status === "no-result") && <div className="led led-idle" />}
      {status === "rejected" && <div className="led led-idle" />}
      {status === "pending" && <div className="led led-idle" />}
    </div>
  );
}

function ToggleableField({
  field,
  label,
  value,
  enabled,
  onToggle,
}: {
  field: string;
  label: string;
  value: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "col-span-2 sm:col-span-1 flex items-start gap-2 cursor-pointer transition-opacity",
        !enabled && "opacity-40"
      )}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        className="accent-[#c79b5c] mt-0.5 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="min-w-0">
        <span className="text-text-disabled text-[0.6rem] uppercase tracking-wider font-semibold">{label}</span>
        <p className={cn("truncate text-[0.78rem]", enabled ? "text-text-primary" : "text-text-disabled line-through")}>{value}</p>
      </div>
    </div>
  );
}
