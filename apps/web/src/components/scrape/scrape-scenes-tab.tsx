"use client";

import { useState } from "react";
import { Badge } from "@obscura/ui/primitives/badge";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import { Check, X, ChevronDown } from "lucide-react";
import {
  scrapeScene,
  identifyViaStashBox,
  acceptScrapeResult,
  rejectScrapeResult,
  toApiUrl,
} from "../../lib/api";
import { entityTerms } from "../../lib/terminology";
import { StatusDot, ToggleableField } from "./shared-components";
import type {
  SceneRow,
  SceneField,
  ScraperPackage,
  StashBoxEndpoint,
  ScrapeResult,
  NormalizedScrapeResult,
  TabSharedProps,
} from "./types";
import { SCENE_FIELDS, SEEK_TIMEOUT_MS, withTimeout } from "./types";

/* ─── Props ───────────────────────────────────────────────────── */

export interface ScenesTabProps extends TabSharedProps {
  sceneRows: SceneRow[];
  setSceneRows: React.Dispatch<React.SetStateAction<SceneRow[]>>;
  sceneScrapers: ScraperPackage[];
}

/* ─── Seek helpers ────────────────────────────────────────────── */

async function seekSceneViaStashBox(row: SceneRow, endpoints: StashBoxEndpoint[]): Promise<{
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  matchedScraper?: string;
  matchType?: string;
}> {
  for (const ep of endpoints) {
    try {
      const res = await withTimeout(
        identifyViaStashBox(ep.id, row.scene.id),
        SEEK_TIMEOUT_MS
      );
      if (res.result && res.normalized) {
        return {
          result: res.result,
          normalized: res.normalized,
          matchedScraper: `${ep.name}${res.matchType === "fingerprint" ? " (fingerprint)" : ""}`,
          matchType: res.matchType,
        };
      }
    } catch {
      // Timeout or error -- try next
    }
  }
  return {};
}

async function seekScene(row: SceneRow, scraperList: ScraperPackage[], sbEndpoints: StashBoxEndpoint[]): Promise<{
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  matchedScraper?: string;
  matchType?: string;
}> {
  // Try StashBox endpoints first (fingerprint matching is highest confidence)
  if (sbEndpoints.length > 0) {
    const sbResult = await seekSceneViaStashBox(row, sbEndpoints);
    if (sbResult.result) return sbResult;
  }

  // Fall back to community scrapers
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
      // Timeout or error -- try next
    }
  }
  return {};
}

/* ─── Tab component ───────────────────────────────────────────── */

export function ScrapeSceneRows({
  sceneRows,
  setSceneRows,
  expandedIds,
  toggleExpanded,
}: Pick<ScenesTabProps, "sceneRows" | "setSceneRows" | "expandedIds" | "toggleExpanded">) {
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

  function toggleSceneExcludePerformer(idx: number, name: string) {
    setSceneRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.excludedPerformers);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return { ...r, excludedPerformers: next };
      })
    );
  }

  function toggleSceneExcludeTag(idx: number, name: string) {
    setSceneRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.excludedTags);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return { ...r, excludedTags: next };
      })
    );
  }

  return sceneRows.map((row, idx) => (
    <SceneRowCard
      key={row.scene.id}
      row={row}
      expanded={expandedIds.has(row.scene.id)}
      onToggleExpand={() => toggleExpanded(row.scene.id)}
      onAccept={() => void acceptSceneRow(sceneRows, idx, setSceneRows)}
      onReject={() => void rejectSceneRow(sceneRows, idx, setSceneRows)}
      onToggleField={(field) => toggleSceneField(idx, field)}
      onTogglePerformer={(name) => toggleSceneExcludePerformer(idx, name)}
      onToggleTag={(name) => toggleSceneExcludeTag(idx, name)}
    />
  ));
}

/* ─── Scrape runner ───────────────────────────────────────────── */

export async function runSceneScrape({
  sceneRows,
  setSceneRows,
  sceneScrapers,
  stashBoxEndpoints,
  selectedScraperId,
  autoAccept,
  abortRef,
  setRunning,
}: ScenesTabProps) {
  setRunning(true);
  abortRef.current = false;

  const isStashBox = selectedScraperId.startsWith("stashbox:");
  const isScraper = selectedScraperId.startsWith("scraper:");
  const realId = selectedScraperId.replace(/^(stashbox|scraper):/, "");

  const scraperList = isScraper
    ? sceneScrapers.filter((s) => s.id === realId)
    : selectedScraperId === "" ? sceneScrapers : [];
  const sbEndpoints = isStashBox
    ? stashBoxEndpoints.filter((e) => e.id === realId)
    : selectedScraperId === "" ? stashBoxEndpoints : [];

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
      const { result, normalized, matchedScraper } = await seekScene(sceneRows[i], scraperList, sbEndpoints);
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

/* ─── Accept / Reject helpers ─────────────────────────────────── */

async function acceptSceneRow(
  sceneRows: SceneRow[],
  idx: number,
  setSceneRows: React.Dispatch<React.SetStateAction<SceneRow[]>>
) {
  const row = sceneRows[idx];
  if (!row.result) return;
  try {
    await acceptScrapeResult(row.result.id, Array.from(row.selectedFields), {
      excludePerformers: Array.from(row.excludedPerformers),
      excludeTags: Array.from(row.excludedTags),
    });
    setSceneRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r))
    );
  } catch { /* keep as found */ }
}

async function rejectSceneRow(
  sceneRows: SceneRow[],
  idx: number,
  setSceneRows: React.Dispatch<React.SetStateAction<SceneRow[]>>
) {
  const row = sceneRows[idx];
  if (!row.result) return;
  try {
    await rejectScrapeResult(row.result.id);
    setSceneRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "rejected", result: undefined, normalized: undefined } : r))
    );
  } catch { /* ignore */ }
}

export async function acceptAllScenes(
  sceneRows: SceneRow[],
  setSceneRows: React.Dispatch<React.SetStateAction<SceneRow[]>>
) {
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

/* ─── Scene row card ──────────────────────────────────────────── */

function SceneRowCard({
  row,
  expanded,
  onToggleExpand,
  onAccept,
  onReject,
  onToggleField,
  onTogglePerformer,
  onToggleTag,
}: {
  row: SceneRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onToggleField: (field: SceneField) => void;
  onTogglePerformer: (name: string) => void;
  onToggleTag: (name: string) => void;
}) {
  return (
    <div>
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(); }}
        className={cn(
          "w-full text-left surface-card no-lift p-3 flex items-center gap-3 transition-all duration-fast cursor-pointer",
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
            className="w-16 h-10 object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-10 bg-surface-3 flex-shrink-0" />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[0.8rem] font-medium truncate">{row.scene.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-text-disabled text-[0.65rem]">{row.scene.durationFormatted ?? "\u2014"}</span>
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
              className="p-1.5 hover:bg-status-success/15 text-status-success-text transition-colors"
              title="Accept"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              className="p-1.5 hover:bg-status-error/10 text-text-disabled hover:text-status-error-text transition-colors"
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
        <div className="surface-card no-lift ml-1 mr-1 mb-1 p-4 border-border-accent/20">
          <div className="flex gap-4">
            {/* Large thumbnail on left */}
            {row.normalized.imageUrl && (
              <div
                className={cn(
                  "flex-shrink-0 cursor-pointer transition-opacity",
                  !row.selectedFields.has("image") && "opacity-40"
                )}
                onClick={(e) => { e.stopPropagation(); onToggleField("image"); }}
              >
                <div className="relative">
                  <img
                    src={row.normalized.imageUrl}
                    alt=""
                    className={cn(
                      "w-40 h-24 object-cover border transition-all",
                      row.selectedFields.has("image")
                        ? "border-border-accent/40"
                        : "border-border-subtle grayscale"
                    )}
                  />
                  <div className="absolute top-1 left-1">
                    <Checkbox
                      checked={row.selectedFields.has("image")}
                      onChange={() => onToggleField("image")}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Fields on right */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Row 1: Title + Date */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
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
              </div>

              {/* Performers as removable chips */}
              {row.normalized.performerNames.length > 0 && (
                <div className={cn("transition-opacity", !row.selectedFields.has("performers") && "opacity-40")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Checkbox
                      checked={row.selectedFields.has("performers")}
                      onChange={() => onToggleField("performers")}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-kicker">{entityTerms.performers}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.normalized.performerNames.map((name) => {
                      const excluded = row.excludedPerformers.has(name);
                      return (
                        <span
                          key={name}
                          className={cn(
                            "inline-flex items-center gap-1 tag-chip transition-all",
                            excluded
                              ? "tag-chip-default opacity-40 line-through"
                              : "tag-chip-accent"
                          )}
                        >
                          {name}
                          <button
                            onClick={(e) => { e.stopPropagation(); onTogglePerformer(name); }}
                            className="hover:text-status-error-text transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags as removable chips */}
              {row.normalized.tagNames.length > 0 && (
                <div className={cn("transition-opacity", !row.selectedFields.has("tags") && "opacity-40")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Checkbox
                      checked={row.selectedFields.has("tags")}
                      onChange={() => onToggleField("tags")}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-kicker">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {row.normalized.tagNames.map((name) => {
                      const excluded = row.excludedTags.has(name);
                      return (
                        <span
                          key={name}
                          className={cn(
                            "inline-flex items-center gap-1 tag-chip transition-all",
                            excluded
                              ? "tag-chip-default opacity-40 line-through"
                              : "tag-chip-default"
                          )}
                        >
                          {name}
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleTag(name); }}
                            className="hover:text-status-error-text transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {expanded && row.error && (
        <div className="surface-card no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
          <p className="text-[0.7rem] text-status-error-text">{row.error}</p>
        </div>
      )}
    </div>
  );
}
