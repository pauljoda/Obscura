"use client";

import { Badge } from "@obscura/ui/primitives/badge";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import { Check, X, Loader2, ChevronDown, Building2 } from "lucide-react";
import {
  lookupStudioViaStashBox,
  updateStudio,
  uploadStudioImageFromUrl,
  findOrCreateStudio,
} from "../../lib/api";
import { autoSaveStashId } from "../stash-id-chips";
import { StatusDot, ToggleableField } from "./shared-components";
import type {
  StudioRow,
  StashBoxEndpoint,
  NormalizedStudioScrapeResult,
  TabSharedProps,
} from "./types";
import { SEEK_TIMEOUT_MS, withTimeout } from "./types";

/* ─── Props ───────────────────────────────────────────────────── */

export interface StudiosTabProps extends TabSharedProps {
  studioRows: StudioRow[];
  setStudioRows: React.Dispatch<React.SetStateAction<StudioRow[]>>;
}

/* ─── Seek helpers ────────────────────────────────────────────── */

async function seekStudio(row: StudioRow, sbEndpoints: StashBoxEndpoint[]): Promise<{
  result?: NormalizedStudioScrapeResult;
  remoteId?: string;
  endpointId?: string;
  matchedScraper?: string;
}> {
  for (const ep of sbEndpoints) {
    try {
      const res = await withTimeout(lookupStudioViaStashBox(ep.id, row.studio.name), SEEK_TIMEOUT_MS);
      if (res.studio) {
        return {
          result: {
            name: res.studio.name,
            url: res.studio.urls?.[0]?.url ?? null,
            imageUrl: res.studio.images?.[0]?.url ?? null,
            parentName: res.studio.parent?.name ?? null,
          },
          remoteId: res.studio.id,
          endpointId: ep.id,
          matchedScraper: ep.name,
        };
      }
    } catch { /* next */ }
  }
  return {};
}

/* ─── Row renderer ────────────────────────────────────────────── */

export function ScrapeStudioRows({
  studioRows,
  setStudioRows,
  expandedIds,
  toggleExpanded,
}: Pick<StudiosTabProps, "studioRows" | "setStudioRows" | "expandedIds" | "toggleExpanded">) {
  function toggleStudioField(idx: number, field: string) {
    setStudioRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = new Set(r.selectedFields);
      if (next.has(field)) next.delete(field); else next.add(field);
      return { ...r, selectedFields: next };
    }));
  }

  return studioRows.map((row, idx) => (
    <StudioRowCard
      key={row.studio.id}
      row={row}
      expanded={expandedIds.has(row.studio.id)}
      onToggleExpand={() => toggleExpanded(row.studio.id)}
      onAccept={() => void acceptStudioRow(studioRows, idx, setStudioRows)}
      onReject={() => rejectStudioRow(idx, setStudioRows)}
      onToggleField={(field) => toggleStudioField(idx, field)}
    />
  ));
}

/* ─── Scrape runner ───────────────────────────────────────────── */

export async function runStudioScrape({
  studioRows,
  setStudioRows,
  stashBoxEndpoints,
  selectedScraperId,
  autoAccept,
  abortRef,
  setRunning,
}: StudiosTabProps) {
  setRunning(true);
  abortRef.current = false;

  const isStashBox = selectedScraperId.startsWith("stashbox:");
  const realId = selectedScraperId.replace(/^stashbox:/, "");
  const sbEndpoints = isStashBox
    ? stashBoxEndpoints.filter((e) => e.id === realId)
    : selectedScraperId === "" ? stashBoxEndpoints : [];

  setStudioRows((prev) =>
    prev.map((r) => r.status === "accepted" ? r : { ...r, status: "pending", result: undefined, error: undefined })
  );

  for (let i = 0; i < studioRows.length; i++) {
    if (abortRef.current) break;
    if (studioRows[i].status === "accepted") continue;

    setStudioRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r)));

    try {
      const { result, remoteId, endpointId, matchedScraper } = await seekStudio(studioRows[i], sbEndpoints);
      if (result) {
        // Don't auto-select parentName -- data quality varies across endpoints
        const fields = new Set(Object.entries(result).filter(([k, v]) => v != null && v !== "" && k !== "parentName").map(([k]) => k));
        if (autoAccept) {
          try {
            const data: Record<string, unknown> = {};
            if (result.url) data.url = result.url;
            await updateStudio(studioRows[i].studio.id, data);
            // Download image from URL
            if (result.imageUrl) {
              try { await uploadStudioImageFromUrl(studioRows[i].studio.id, result.imageUrl); } catch (e) { console.error("Studio image download failed:", e); }
            }
            if (endpointId && remoteId) await autoSaveStashId("studio", studioRows[i].studio.id, endpointId, remoteId);
            setStudioRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "accepted", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
          } catch {
            setStudioRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "found", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
          }
        } else {
          setStudioRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "found", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
        }
      } else {
        setStudioRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r)));
      }
    } catch (err) {
      setStudioRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" } : r));
    }
  }
  setRunning(false);
}

/* ─── Accept / Reject helpers ─────────────────────────────────── */

async function acceptStudioRow(
  studioRows: StudioRow[],
  idx: number,
  setStudioRows: React.Dispatch<React.SetStateAction<StudioRow[]>>
) {
  const row = studioRows[idx];
  if (!row.result) return;
  try {
    const data: Record<string, unknown> = {};
    if (row.selectedFields.has("url") && row.result.url) data.url = row.result.url;
    if (row.selectedFields.has("name") && row.result.name) data.name = row.result.name;
    // Resolve parent studio if selected
    if (row.selectedFields.has("parentName") && row.result.parentName) {
      try {
        const parentResult = await findOrCreateStudio({ name: row.result.parentName });
        data.parentId = parentResult.id;
      } catch (e) { console.error("Parent studio resolution failed:", e); }
    }
    await updateStudio(row.studio.id, data);
    // Download image from URL (stores locally)
    if (row.selectedFields.has("imageUrl") && row.result.imageUrl) {
      try { await uploadStudioImageFromUrl(row.studio.id, row.result.imageUrl); } catch (e) { console.error("Studio image download failed:", e); }
    }
    if (row.endpointId && row.remoteId) await autoSaveStashId("studio", row.studio.id, row.endpointId, row.remoteId);
    setStudioRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)));
  } catch { /* keep as found */ }
}

function rejectStudioRow(
  idx: number,
  setStudioRows: React.Dispatch<React.SetStateAction<StudioRow[]>>
) {
  setStudioRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: "rejected" } : r)));
}

export async function acceptAllStudios(
  studioRows: StudioRow[],
  setStudioRows: React.Dispatch<React.SetStateAction<StudioRow[]>>
) {
  const found = studioRows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.status === "found" && row.result);
  for (const { idx } of found) { await acceptStudioRow(studioRows, idx, setStudioRows); }
}

/* ─── Studio row card ─────────────────────────────────────────── */

function StudioRowCard({
  row,
  expanded,
  onToggleExpand,
  onAccept,
  onReject,
  onToggleField,
}: {
  row: StudioRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onToggleField: (field: string) => void;
}) {
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
        <Building2 className="h-4 w-4 text-text-disabled flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[0.8rem] font-medium text-text-primary truncate">{row.studio.name}</div>
          {row.result && row.status === "found" && (
            <div className="text-[0.62rem] text-text-muted truncate mt-0.5">
              {[row.result.url, row.result.parentName].filter(Boolean).join(" | ")}
            </div>
          )}
          {row.matchedScraper && row.status !== "pending" && (
            <span className="text-text-disabled text-[0.58rem] font-mono">via {row.matchedScraper}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {row.status === "scraping" && <Loader2 className="h-3.5 w-3.5 text-text-accent animate-spin" />}
          {row.status === "found" && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onAccept(); }} className="flex items-center gap-1 px-2 py-1 text-[0.62rem] text-status-success-text border border-status-success/25 hover:bg-status-success/10 transition-colors">
                <Check className="h-2.5 w-2.5" /> Accept
              </button>
              <button onClick={(e) => { e.stopPropagation(); onReject(); }} className="p-1 text-text-disabled hover:text-status-error-text transition-colors">
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          {row.status === "no-result" && <span className="text-[0.62rem] text-text-disabled">No result</span>}
          {row.status === "error" && <span className="text-[0.62rem] text-status-error-text">Error</span>}
          {row.status === "accepted" && <Badge variant="accent" className="text-[0.55rem]">Applied</Badge>}
        </div>

        <ChevronDown className={cn("h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast", expanded && "rotate-180")} />
      </div>

      {expanded && row.result && (
        <div className="surface-card no-lift ml-6 mr-1 mb-1 p-3 border-border-accent/20">
          <div className="flex gap-4">
            {/* Image preview */}
            {row.result.imageUrl && (
              <div
                className={cn("flex-shrink-0 cursor-pointer transition-opacity", !row.selectedFields.has("imageUrl") && "opacity-40")}
                onClick={(e) => { e.stopPropagation(); onToggleField("imageUrl"); }}
              >
                <div className="relative">
                  <img
                    src={row.result.imageUrl}
                    alt=""
                    className={cn(
                      "w-32 h-20 object-contain border transition-all",
                      row.selectedFields.has("imageUrl") ? "border-border-accent/40" : "border-border-subtle grayscale"
                    )}
                  />
                  <div className="absolute top-1 left-1">
                    <Checkbox
                      checked={row.selectedFields.has("imageUrl")}
                      onChange={() => onToggleField("imageUrl")}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* Fields */}
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-6 gap-y-2 text-[0.8rem]">
              {row.result.name && <ToggleableField field="name" label="Name" value={row.result.name} enabled={row.selectedFields.has("name")} onToggle={() => onToggleField("name")} />}
              {row.result.url && <ToggleableField field="url" label="URL" value={row.result.url} enabled={row.selectedFields.has("url")} onToggle={() => onToggleField("url")} />}
              {row.result.parentName && <ToggleableField field="parentName" label="Parent" value={row.result.parentName} enabled={row.selectedFields.has("parentName")} onToggle={() => onToggleField("parentName")} />}
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
