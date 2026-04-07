"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusLed } from "@obscura/ui/composed/status-led";
import { Badge } from "@obscura/ui/primitives/badge";
import { Button } from "@obscura/ui/primitives/button";
import { cn } from "@obscura/ui/lib/utils";
import {
  Check,
  X,
  ChevronRight,
  Plus,
  Minus,
  Search,
  Loader2,
  ScanSearch,
  ArrowRightLeft,
  ExternalLink,
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

interface ScrapeState {
  scraping: boolean;
  result: ScrapeResult | null;
  normalized: NormalizedScrapeResult | null;
  searchResults: NormalizedScrapeResult[] | null;
  error: string | null;
}

const defaultScrapeState: ScrapeState = {
  scraping: false,
  result: null,
  normalized: null,
  searchResults: null,
  error: null,
};

export function ResolveWorkflow() {
  const [unmatchedScenes, setUnmatchedScenes] = useState<SceneListItem[]>([]);
  const [totalUnmatched, setTotalUnmatched] = useState(0);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [scrapers, setScrapers] = useState<ScraperPackage[]>([]);
  const [selectedScraperId, setSelectedScraperId] = useState<string | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeState, setScrapeState] = useState<ScrapeState & { triedActions?: string[] }>(defaultScrapeState);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [enabledFields, setEnabledFields] = useState<Set<string>>(
    new Set(["title", "date", "details", "url", "studio", "performers", "tags"])
  );

  const selectedScene = unmatchedScenes.find((s) => s.id === selectedSceneId);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scenesRes, scrapersRes] = await Promise.all([
        fetchScenes({ sort: "created_at", limit: 100 }),
        fetchInstalledScrapers(),
      ]);

      // Filter to unorganized scenes
      const unorganized = scenesRes.scenes.filter((s) => !s.organized);
      setUnmatchedScenes(unorganized);
      setTotalUnmatched(unorganized.length);
      setScrapers(scrapersRes.packages.filter((s) => s.enabled));

      if (!selectedSceneId && unorganized.length > 0) {
        setSelectedSceneId(unorganized[0].id);
      }
      if (!selectedScraperId && scrapersRes.packages.length > 0) {
        setSelectedScraperId(scrapersRes.packages.filter((s) => s.enabled)[0]?.id ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedSceneId, selectedScraperId]);

  useEffect(() => {
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleScrape() {
    if (!selectedScraperId || !selectedSceneId) return;

    setScrapeState({ ...defaultScrapeState, scraping: true });
    setMessage(null);

    try {
      const res = await scrapeScene(
        selectedScraperId,
        selectedSceneId,
        "auto",
        { url: scrapeUrl || undefined }
      );

      if (res.results) {
        setScrapeState({
          scraping: false,
          result: null,
          normalized: null,
          searchResults: res.results,
          triedActions: res.triedActions,
          error: null,
        });
      } else if (res.result && res.normalized) {
        setScrapeState({
          scraping: false,
          result: res.result,
          normalized: res.normalized,
          searchResults: null,
          triedActions: res.triedActions,
          error: null,
        });
      } else {
        setScrapeState({
          ...defaultScrapeState,
          triedActions: res.triedActions,
          error: res.message || "No results found for this scene.",
        });
      }
    } catch (err) {
      setScrapeState({
        ...defaultScrapeState,
        error: err instanceof Error ? err.message : "Scrape failed",
      });
    }
  }

  async function handleAccept() {
    if (!scrapeState.result) return;
    setApplying(true);
    setMessage(null);

    try {
      await acceptScrapeResult(
        scrapeState.result.id,
        Array.from(enabledFields)
      );

      setMessage("Metadata applied successfully.");
      setScrapeState(defaultScrapeState);

      // Remove the scene from the unmatched list
      setUnmatchedScenes((prev) => prev.filter((s) => s.id !== selectedSceneId));
      setTotalUnmatched((prev) => prev - 1);

      // Select next scene
      const remaining = unmatchedScenes.filter((s) => s.id !== selectedSceneId);
      setSelectedSceneId(remaining[0]?.id ?? null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }

  async function handleReject() {
    if (!scrapeState.result) return;
    try {
      await rejectScrapeResult(scrapeState.result.id);
      setScrapeState(defaultScrapeState);
      setMessage("Result rejected.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to reject");
    }
  }

  function toggleField(field: string) {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

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
          <h1>Resolve</h1>
          <p className="mt-1 text-text-muted text-sm">
            Scrape and apply metadata to your scenes
          </p>
        </div>
        <div className="surface-well flex flex-col items-center justify-center py-16">
          <ScanSearch className="h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted text-sm">No scrapers installed.</p>
          <p className="text-text-disabled text-xs mt-1">
            Install scrapers from the community index in{" "}
            <a href="/scrapers" className="text-text-accent hover:underline">
              Scrapers
            </a>{" "}
            to begin matching.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>Resolve</h1>
          <p className="mt-1 text-text-muted text-sm">
            Scrape and apply metadata to your scenes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="accent">{totalUnmatched} unmatched</Badge>
        </div>
      </div>

      {message && (
        <div className="surface-panel border border-border-accent p-3 text-text-secondary text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-[600px]">
        {/* Left panel: Unmatched queue */}
        <div className="space-y-2">
          <h4 className="text-kicker mb-3">Unmatched Queue</h4>
          <div className="space-y-1 max-h-[calc(100vh-260px)] overflow-y-auto scrollbar-hidden">
            {unmatchedScenes.length === 0 ? (
              <div className="surface-well p-6 text-center">
                <Check className="h-8 w-8 text-success-text mx-auto mb-2" />
                <p className="text-text-muted text-sm">All scenes matched!</p>
              </div>
            ) : (
              unmatchedScenes.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => {
                    setSelectedSceneId(scene.id);
                    setScrapeState(defaultScrapeState);
                    setMessage(null);
                  }}
                  className={cn(
                    "w-full text-left surface-card p-3 flex items-center gap-3 transition-colors duration-fast",
                    selectedSceneId === scene.id &&
                      "border-border-accent bg-accent-950/30"
                  )}
                >
                  {scene.thumbnailPath ? (
                    <img
                      src={toApiUrl(scene.thumbnailPath)}
                      alt=""
                      className="w-16 h-10 object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-10 bg-surface-3 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{scene.title}</p>
                    <p className="text-text-disabled text-xs mt-0.5">
                      {scene.durationFormatted ?? "—"}{" "}
                      {scene.resolution && (
                        <span className="text-text-muted">{scene.resolution}</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-text-disabled flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel: Scraper controls + results */}
        <div className="lg:col-span-2 space-y-4">
          {selectedScene ? (
            <>
              {/* Scene info header */}
              <div className="surface-panel p-4">
                <div className="flex items-start gap-4">
                  {selectedScene.thumbnailPath ? (
                    <img
                      src={toApiUrl(selectedScene.thumbnailPath)}
                      alt=""
                      className="w-40 h-24 object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-40 h-24 bg-surface-3 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">{selectedScene.title}</h3>
                    <p className="text-mono-sm text-text-muted mt-1 truncate">
                      {selectedScene.filePath}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-disabled">
                      {selectedScene.durationFormatted && (
                        <span>{selectedScene.durationFormatted}</span>
                      )}
                      {selectedScene.resolution && (
                        <span>{selectedScene.resolution}</span>
                      )}
                      {selectedScene.fileSizeFormatted && (
                        <span>{selectedScene.fileSizeFormatted}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scraper controls */}
              <div className="surface-panel p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label className="control-label">Scraper</label>
                    <select
                      className="control-input"
                      value={selectedScraperId ?? ""}
                      onChange={(e) => setSelectedScraperId(e.target.value)}
                    >
                      {scrapers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="control-label">Scene URL (optional)</label>
                    <input
                      className="control-input"
                      placeholder="https://example.com/scene/12345"
                      value={scrapeUrl}
                      onChange={(e) => setScrapeUrl(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      onClick={() => void handleScrape()}
                      disabled={scrapeState.scraping || !selectedScraperId}
                    >
                      {scrapeState.scraping ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                      {scrapeState.scraping ? "Scraping..." : "Scrape"}
                    </Button>
                  </div>
                </div>
                <p className="text-text-disabled text-xs">
                  Tries URL → Title → Fragment in order, using the first match.
                </p>
              </div>

              {/* Scrape error */}
              {scrapeState.error && (
                <div className="surface-panel border border-error/20 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-error-text flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-error-text font-medium">
                        Scrape failed
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        {scrapeState.error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Search results (sceneByName) */}
              {scrapeState.searchResults && (
                <div className="surface-panel p-4 space-y-3">
                  <span className="text-label text-text-muted">
                    Search Results ({scrapeState.searchResults.length})
                  </span>
                  <div className="space-y-2">
                    {scrapeState.searchResults.map((result, idx) => (
                      <div
                        key={idx}
                        className="surface-well p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {result.title ?? "Untitled"}
                          </p>
                          <p className="text-text-muted text-xs mt-0.5">
                            {[result.studioName, result.date]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        {result.url && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setScrapeUrl(result.url!);
                              // Will auto-trigger scrape with this URL set
                              setScrapeState(defaultScrapeState);
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Scrape URL
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scrape result diff */}
              {scrapeState.normalized && (
                <div className="surface-panel p-5 space-y-5">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-accent-500" />
                    <span className="text-label text-text-muted">
                      Scraped Metadata
                    </span>
                    <Badge variant="info" className="text-[0.6rem]">
                      {scrapers.find((s) => s.id === selectedScraperId)?.name}
                    </Badge>
                  </div>

                  <div className="separator" />

                  <div className="surface-well p-3 space-y-0">
                    <DiffField
                      field="Title"
                      current={selectedScene.title}
                      proposed={scrapeState.normalized.title}
                      enabled={enabledFields.has("title")}
                      onToggle={() => toggleField("title")}
                    />
                    <div className="separator" />
                    <DiffField
                      field="Date"
                      current={selectedScene.date}
                      proposed={scrapeState.normalized.date}
                      enabled={enabledFields.has("date")}
                      onToggle={() => toggleField("date")}
                    />
                    <div className="separator" />
                    <DiffField
                      field="Studio"
                      current={null}
                      proposed={scrapeState.normalized.studioName}
                      enabled={enabledFields.has("studio")}
                      onToggle={() => toggleField("studio")}
                    />
                    <div className="separator" />
                    <DiffField
                      field="Performers"
                      current={
                        selectedScene.performers.length > 0
                          ? selectedScene.performers.map((p) => p.name).join(", ")
                          : null
                      }
                      proposed={
                        scrapeState.normalized.performerNames.length > 0
                          ? scrapeState.normalized.performerNames.join(", ")
                          : null
                      }
                      enabled={enabledFields.has("performers")}
                      onToggle={() => toggleField("performers")}
                    />
                    <div className="separator" />
                    <DiffField
                      field="Tags"
                      current={
                        selectedScene.tags.length > 0
                          ? selectedScene.tags.map((t) => t.name).join(", ")
                          : null
                      }
                      proposed={
                        scrapeState.normalized.tagNames.length > 0
                          ? scrapeState.normalized.tagNames.join(", ")
                          : null
                      }
                      enabled={enabledFields.has("tags")}
                      onToggle={() => toggleField("tags")}
                    />
                    <div className="separator" />
                    <DiffField
                      field="URL"
                      current={null}
                      proposed={scrapeState.normalized.url}
                      enabled={enabledFields.has("url")}
                      onToggle={() => toggleField("url")}
                    />
                    <div className="separator" />
                    <DiffField
                      field="Details"
                      current={selectedScene.details}
                      proposed={scrapeState.normalized.details}
                      enabled={enabledFields.has("details")}
                      onToggle={() => toggleField("details")}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="ghost" size="md" onClick={() => void handleReject()}>
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => void handleAccept()}
                      disabled={applying}
                    >
                      {applying ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {applying ? "Applying..." : "Accept Match"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Empty state when no scrape has been run */}
              {!scrapeState.scraping &&
                !scrapeState.result &&
                !scrapeState.error &&
                !scrapeState.searchResults && (
                  <div className="surface-well flex flex-col items-center justify-center py-12">
                    <ScanSearch className="h-10 w-10 text-text-disabled mb-3" />
                    <p className="text-text-muted text-sm">
                      Select a scraper, optionally provide a URL, then click Scrape.
                    </p>
                  </div>
                )}
            </>
          ) : (
            <div className="surface-well flex flex-col items-center justify-center py-20">
              <ScanSearch className="h-12 w-12 text-text-disabled mb-3" />
              <p className="text-text-muted text-sm">
                Select a scene from the queue to begin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffField({
  field,
  current,
  proposed,
  enabled,
  onToggle,
}: {
  field: string;
  current: string | null;
  proposed: string | null;
  enabled: boolean;
  onToggle: () => void;
}) {
  if (!proposed && !current) return null;

  const isAdd = !current && !!proposed;
  const isChange = !!current && !!proposed && current !== proposed;
  const isUnchanged = current === proposed;

  if (isUnchanged || !proposed) return null;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        onClick={onToggle}
        className={cn(
          "flex h-5 w-5 items-center justify-center transition-colors",
          enabled
            ? isAdd
              ? "bg-success-muted/30 text-success-text"
              : "bg-info-muted/30 text-info-text"
            : "bg-surface-3 text-text-disabled"
        )}
      >
        {isAdd ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      </button>
      <span className="text-label text-text-muted w-24">{field}</span>
      {isChange && current && (
        <>
          <span className="text-mono-sm text-text-disabled line-through max-w-[200px] truncate">
            {current}
          </span>
          <ChevronRight className="h-3 w-3 text-text-disabled flex-shrink-0" />
        </>
      )}
      <span
        className={cn(
          "text-mono-sm flex-1 min-w-0 truncate",
          !enabled
            ? "text-text-disabled"
            : isAdd
              ? "text-success-text"
              : "text-info-text"
        )}
      >
        {proposed}
      </span>
    </div>
  );
}
