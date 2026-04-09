"use client";

import { Badge } from "@obscura/ui/primitives/badge";
import { cn } from "@obscura/ui/lib/utils";
import { Check, X, Loader2, ChevronDown, Tag } from "lucide-react";
import {
  lookupTagViaStashBox,
  updateTag,
} from "../../lib/api";
import { autoSaveStashId } from "../stash-id-chips";
import { StatusDot, ToggleableField } from "./shared-components";
import type {
  TagRow,
  StashBoxEndpoint,
  NormalizedTagScrapeResult,
  TabSharedProps,
} from "./types";
import { SEEK_TIMEOUT_MS, withTimeout } from "./types";

/* ─── Props ───────────────────────────────────────────────────── */

export interface TagsTabProps extends TabSharedProps {
  tagRows: TagRow[];
  setTagRows: React.Dispatch<React.SetStateAction<TagRow[]>>;
}

/* ─── Seek helpers ────────────────────────────────────────────── */

async function seekTag(row: TagRow, sbEndpoints: StashBoxEndpoint[]): Promise<{
  result?: NormalizedTagScrapeResult;
  remoteId?: string;
  endpointId?: string;
  matchedScraper?: string;
}> {
  // Build search variants: original name + normalized versions (e.g. "1-on-1" -> "1 on 1")
  const original = row.tag.name.trim();
  const variants = new Set([original]);
  if (original.includes("-")) variants.add(original.replace(/-/g, " "));
  if (original.includes("_")) variants.add(original.replace(/_/g, " "));
  if (original.includes(" ")) {
    variants.add(original.replace(/ /g, "-"));
    variants.add(original.replace(/ /g, "_"));
  }

  for (const ep of sbEndpoints) {
    for (const query of variants) {
      try {
        const res = await withTimeout(lookupTagViaStashBox(ep.id, query), SEEK_TIMEOUT_MS);
        if (res.tags && res.tags.length > 0) {
          const queryLower = query.toLowerCase();
          // Strict matching: exact name or alias match against the query variant
          const match = res.tags.find((t) =>
            t.name.toLowerCase().trim() === queryLower ||
            t.aliases?.some((a) => a.toLowerCase().trim() === queryLower)
          );
          if (match) {
            return {
              result: {
                name: match.name,
                description: match.description ?? null,
                aliases: match.aliases?.join(", ") ?? null,
              },
              remoteId: match.id,
              endpointId: ep.id,
              matchedScraper: ep.name,
            };
          }
        }
      } catch { /* next */ }
    }
  }
  return {};
}

/* ─── Row renderer ────────────────────────────────────────────── */

export function ScrapeTagRows({
  tagRows,
  setTagRows,
  expandedIds,
  toggleExpanded,
}: Pick<TagsTabProps, "tagRows" | "setTagRows" | "expandedIds" | "toggleExpanded">) {
  function toggleTagField(idx: number, field: string) {
    setTagRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = new Set(r.selectedFields);
      if (next.has(field)) next.delete(field); else next.add(field);
      return { ...r, selectedFields: next };
    }));
  }

  return tagRows.map((row, idx) => (
    <TagRowCard
      key={row.tag.id}
      row={row}
      expanded={expandedIds.has(row.tag.id)}
      onToggleExpand={() => toggleExpanded(row.tag.id)}
      onAccept={() => void acceptTagRow(tagRows, idx, setTagRows)}
      onReject={() => rejectTagRow(idx, setTagRows)}
      onToggleField={(field) => toggleTagField(idx, field)}
    />
  ));
}

/* ─── Scrape runner ───────────────────────────────────────────── */

export async function runTagScrape({
  tagRows,
  setTagRows,
  stashBoxEndpoints,
  selectedScraperId,
  autoAccept,
  abortRef,
  setRunning,
}: TagsTabProps) {
  setRunning(true);
  abortRef.current = false;

  const isStashBox = selectedScraperId.startsWith("stashbox:");
  const realId = selectedScraperId.replace(/^stashbox:/, "");
  const sbEndpoints = isStashBox
    ? stashBoxEndpoints.filter((e) => e.id === realId)
    : selectedScraperId === "" ? stashBoxEndpoints : [];

  setTagRows((prev) =>
    prev.map((r) => r.status === "accepted" ? r : { ...r, status: "pending", result: undefined, error: undefined })
  );

  for (let i = 0; i < tagRows.length; i++) {
    if (abortRef.current) break;
    if (tagRows[i].status === "accepted") continue;

    setTagRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r)));

    try {
      const { result, remoteId, endpointId, matchedScraper } = await seekTag(tagRows[i], sbEndpoints);
      if (result) {
        const fields = new Set(Object.entries(result).filter(([, v]) => v != null && v !== "").map(([k]) => k));
        if (autoAccept) {
          try {
            const data: Record<string, unknown> = {};
            if (result.description) data.description = result.description;
            if (result.aliases) data.aliases = result.aliases;
            await updateTag(tagRows[i].tag.id, data);
            if (endpointId && remoteId) await autoSaveStashId("tag", tagRows[i].tag.id, endpointId, remoteId);
            setTagRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "accepted", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
          } catch {
            setTagRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "found", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
          }
        } else {
          setTagRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "found", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
        }
      } else {
        setTagRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r)));
      }
    } catch (err) {
      setTagRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" } : r));
    }
  }
  setRunning(false);
}

/* ─── Accept / Reject helpers ─────────────────────────────────── */

async function acceptTagRow(
  tagRows: TagRow[],
  idx: number,
  setTagRows: React.Dispatch<React.SetStateAction<TagRow[]>>
) {
  const row = tagRows[idx];
  if (!row.result) return;
  try {
    const data: Record<string, unknown> = {};
    if (row.selectedFields.has("description") && row.result.description) data.description = row.result.description;
    if (row.selectedFields.has("aliases") && row.result.aliases) data.aliases = row.result.aliases;
    await updateTag(row.tag.id, data);
    if (row.endpointId && row.remoteId) await autoSaveStashId("tag", row.tag.id, row.endpointId, row.remoteId);
    setTagRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)));
  } catch { /* keep as found */ }
}

function rejectTagRow(
  idx: number,
  setTagRows: React.Dispatch<React.SetStateAction<TagRow[]>>
) {
  setTagRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: "rejected" } : r)));
}

export async function acceptAllTags(
  tagRows: TagRow[],
  setTagRows: React.Dispatch<React.SetStateAction<TagRow[]>>
) {
  const found = tagRows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.status === "found" && row.result);
  for (const { idx } of found) { await acceptTagRow(tagRows, idx, setTagRows); }
}

/* ─── Tag row card ────────────────────────────────────────────── */

function TagRowCard({
  row,
  expanded,
  onToggleExpand,
  onAccept,
  onReject,
  onToggleField,
}: {
  row: TagRow;
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
        <Tag className="h-4 w-4 text-text-disabled flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[0.8rem] font-medium text-text-primary truncate">{row.tag.name}</div>
          {row.result && row.status === "found" && row.result.description && (
            <div className="text-[0.62rem] text-text-muted truncate mt-0.5">
              {row.result.description.slice(0, 80)}
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
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[0.8rem]">
            {row.result.name && <ToggleableField field="name" label="Name" value={row.result.name} enabled={row.selectedFields.has("name")} onToggle={() => onToggleField("name")} />}
            {row.result.description && <ToggleableField field="description" label="Description" value={row.result.description.slice(0, 200)} enabled={row.selectedFields.has("description")} onToggle={() => onToggleField("description")} />}
            {row.result.aliases && <ToggleableField field="aliases" label="Aliases" value={row.result.aliases} enabled={row.selectedFields.has("aliases")} onToggle={() => onToggleField("aliases")} />}
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
