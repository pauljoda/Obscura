"use client";

import { useState } from "react";
import { Badge } from "@obscura/ui/primitives/badge";
import { cn } from "@obscura/ui/lib/utils";
import { Check, X, Loader2, ChevronDown, Image as ImageIcon } from "lucide-react";
import {
  scrapePerformerApi,
  identifyPerformerViaStashBox,
  applyPerformerScrape,
  toApiUrl,
} from "../../lib/api";
import { entityTerms } from "../../lib/terminology";
import { ImagePickerModal } from "../image-picker-modal";
import { StatusDot, ToggleableField } from "./shared-components";
import type {
  PerformerRow,
  ScraperPackage,
  StashBoxEndpoint,
  NormalizedPerformerScrapeResult,
  TabSharedProps,
} from "./types";
import { SEEK_TIMEOUT_MS, withTimeout, perfFieldsFromResult } from "./types";

/* ─── Props ───────────────────────────────────────────────────── */

export interface PerformersTabProps extends TabSharedProps {
  perfRows: PerformerRow[];
  setPerfRows: React.Dispatch<React.SetStateAction<PerformerRow[]>>;
  perfScrapers: ScraperPackage[];
}

/* ─── Seek helpers ────────────────────────────────────────────── */

async function seekPerformer(row: PerformerRow, scraperList: ScraperPackage[], sbEndpoints: StashBoxEndpoint[]): Promise<{
  result?: NormalizedPerformerScrapeResult;
  matchedScraper?: string;
}> {
  const performerName = row.performer.name.toLowerCase().trim();

  // Try StashBox endpoints first
  for (const ep of sbEndpoints) {
    try {
      const res = await withTimeout(
        identifyPerformerViaStashBox(ep.id, row.performer.id),
        SEEK_TIMEOUT_MS
      );
      if (res.results && res.results.length > 0) {
        const exact = res.results.find(
          (r) => r.name?.toLowerCase().trim() === performerName
        );
        if (exact) {
          return { result: exact, matchedScraper: ep.name };
        }
      }
    } catch {
      // Timeout or error -- try next
    }
  }

  // Fall back to community scrapers
  for (const scraper of scraperList) {
    try {
      const res = await withTimeout(
        scrapePerformerApi(scraper.id, row.performer.id, { action: "auto" }),
        SEEK_TIMEOUT_MS
      );

      if (res.result) {
        return { result: res.result, matchedScraper: scraper.name };
      }

      if (res.results && res.results.length > 0) {
        const exact = res.results.find(
          (r) => r.name?.toLowerCase().trim() === performerName
        );
        if (exact) {
          return { result: exact, matchedScraper: scraper.name };
        }
      }
    } catch {
      // Timeout or error -- try next
    }
  }
  return {};
}

/* ─── Row renderer ────────────────────────────────────────────── */

export function ScrapePerformerRows({
  perfRows,
  setPerfRows,
  expandedIds,
  toggleExpanded,
}: Pick<PerformersTabProps, "perfRows" | "setPerfRows" | "expandedIds" | "toggleExpanded">) {
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

  return perfRows.map((row, idx) => (
    <PerformerRowCard
      key={row.performer.id}
      row={row}
      expanded={expandedIds.has(row.performer.id)}
      onToggleExpand={() => toggleExpanded(row.performer.id)}
      onAccept={(imageUrl) => void acceptPerformerRow(perfRows, idx, setPerfRows, imageUrl)}
      onReject={() => rejectPerformerRow(idx, setPerfRows)}
      onToggleField={(field) => togglePerfField(idx, field)}
    />
  ));
}

/* ─── Scrape runner ───────────────────────────────────────────── */

export async function runPerformerScrape({
  perfRows,
  setPerfRows,
  perfScrapers,
  stashBoxEndpoints,
  selectedScraperId,
  autoAccept,
  abortRef,
  setRunning,
}: PerformersTabProps) {
  setRunning(true);
  abortRef.current = false;

  const isStashBox = selectedScraperId.startsWith("stashbox:");
  const isScraper = selectedScraperId.startsWith("scraper:");
  const realId = selectedScraperId.replace(/^(stashbox|scraper):/, "");

  const scraperList = isScraper
    ? perfScrapers.filter((s) => s.id === realId)
    : selectedScraperId === "" ? perfScrapers : [];
  const sbEndpoints = isStashBox
    ? stashBoxEndpoints.filter((e) => e.id === realId)
    : selectedScraperId === "" ? stashBoxEndpoints : [];

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
      const { result, matchedScraper } = await seekPerformer(perfRows[i], scraperList, sbEndpoints);
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

/* ─── Accept / Reject helpers ─────────────────────────────────── */

async function acceptPerformerRow(
  perfRows: PerformerRow[],
  idx: number,
  setPerfRows: React.Dispatch<React.SetStateAction<PerformerRow[]>>,
  overrideImageUrl?: string
) {
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

function rejectPerformerRow(
  idx: number,
  setPerfRows: React.Dispatch<React.SetStateAction<PerformerRow[]>>
) {
  setPerfRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "rejected" } : r))
  );
}

export async function acceptAllPerformers(
  perfRows: PerformerRow[],
  setPerfRows: React.Dispatch<React.SetStateAction<PerformerRow[]>>
) {
  const found = perfRows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.status === "found" && row.result);
  for (const { idx } of found) {
    await acceptPerformerRow(perfRows, idx, setPerfRows);
  }
}

/* ─── Performer row card ──────────────────────────────────────── */

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
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  // All available images: imageUrls array + imageUrl single
  const allImages = row.result
    ? [...new Set([
        ...(row.result.imageUrl ? [row.result.imageUrl] : []),
        ...(row.result.imageUrls ?? []),
      ].filter((u) => u.startsWith("http") || u.startsWith("data:image/")))]
    : [];

  const effectiveImageUrl = allImages[selectedImageIndex] ?? allImages[0] ?? null;
  return (
    <div>
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(); }}
        className={cn(
          "surface-card no-lift flex items-center gap-3 px-3 py-2.5 transition-all duration-fast cursor-pointer",
          expanded && "border-border-accent/40",
          row.status === "accepted" && "opacity-50",
          row.status === "rejected" && "opacity-30"
        )}
      >
        <StatusDot status={row.status} />

        {/* Image */}
        <div className="flex-shrink-0 h-10 w-8 overflow-hidden bg-surface-3">
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
                className="flex items-center gap-1 px-2 py-1 text-[0.62rem] text-status-success-text border border-status-success/25 hover:bg-status-success/10 transition-colors"
              >
                <Check className="h-2.5 w-2.5" />
                Accept
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                className="p-1 text-text-disabled hover:text-status-error-text transition-colors"
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
        <div className="surface-card no-lift ml-6 mr-1 mb-1 p-3 border-border-accent/20">
          <div className="flex gap-4">
            {/* Image selection */}
            {allImages.length > 0 && (
              <div className="flex-shrink-0 space-y-2 flex flex-col items-center">
                {/* Selected/primary image -- click to browse */}
                <button
                  onClick={(e) => { e.stopPropagation(); if (allImages.length > 1) setImagePickerOpen(true); }}
                  className="w-24 h-32 overflow-hidden bg-surface-3 border border-border-subtle hover:border-border-accent transition-all"
                >
                  {effectiveImageUrl && (
                    <img src={effectiveImageUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
                {allImages.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setImagePickerOpen(true); }}
                    className="text-[0.6rem] text-text-accent hover:text-text-accent-bright transition-colors text-center"
                  >
                    Browse all ({allImages.length})
                  </button>
                )}
                {imagePickerOpen && (
                  <ImagePickerModal
                    images={allImages}
                    selectedIndex={selectedImageIndex}
                    onSelect={setSelectedImageIndex}
                    onClose={() => setImagePickerOpen(false)}
                    title={`Select ${entityTerms.performer} image`}
                  />
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
        <div className="surface-card no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
          <p className="text-[0.7rem] text-status-error-text">{row.error}</p>
        </div>
      )}
    </div>
  );
}
