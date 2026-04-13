"use client";

import { Badge } from "@obscura/ui/primitives/badge";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import { Check, ChevronDown, X, Images } from "lucide-react";
import { StatusDot, ToggleableField } from "../scrape/shared-components";
import { entityTerms } from "../../lib/terminology";
import type { GalleryRow, GalleryField } from "./types";
import { GALLERY_FIELDS } from "./types";

/* ─── Props ───────────────────────────────────────────────────── */

export interface GalleriesTabProps {
  rows: GalleryRow[];
  setRows: React.Dispatch<React.SetStateAction<GalleryRow[]>>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
}

/* ─── Rows renderer ───────────────────────────────────────────── */

export function IdentifyGalleryRows({
  rows,
  setRows,
  expandedIds,
  toggleExpanded,
}: GalleriesTabProps) {
  function toggleField(idx: number, field: GalleryField) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.selectedFields);
        if (next.has(field)) next.delete(field);
        else next.add(field);
        return { ...r, selectedFields: next };
      }),
    );
  }

  return rows.map((row, idx) => (
    <GalleryRowCard
      key={row.gallery.id}
      row={row}
      expanded={expandedIds.has(row.gallery.id)}
      onToggleExpand={() => toggleExpanded(row.gallery.id)}
      onToggleField={(field) => toggleField(idx, field)}
    />
  ));
}

/* ─── Row card ────────────────────────────────────────────────── */

function GalleryRowCard({
  row,
  expanded,
  onToggleExpand,
  onToggleField,
}: {
  row: GalleryRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleField: (field: GalleryField) => void;
}) {
  return (
    <div>
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggleExpand();
        }}
        className={cn(
          "w-full text-left surface-card no-lift p-3 flex items-center gap-3 transition-all duration-fast cursor-pointer",
          expanded && "border-border-accent/40",
          row.status === "accepted" && "opacity-50",
        )}
      >
        <StatusDot status={row.status} />
        <Images className="h-5 w-5 text-text-muted flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-[0.8rem] font-medium truncate">{row.gallery.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-text-disabled text-[0.65rem]">
              {row.gallery.imageCount} images
            </span>
            <span className="text-text-disabled text-[0.65rem]">
              {row.gallery.galleryType}
            </span>
            {row.matchedProvider && row.status !== "pending" && (
              <span className="text-text-disabled text-[0.6rem] font-mono">
                via {row.matchedProvider}
              </span>
            )}
          </div>
        </div>

        {row.status === "accepted" && (
          <Badge variant="accent" className="text-[0.55rem] flex-shrink-0">Applied</Badge>
        )}

        <ChevronDown
          className={cn(
            "h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast",
            expanded && "rotate-180",
          )}
        />
      </div>

      {expanded && row.result && (
        <div className="surface-card no-lift ml-1 mr-1 mb-1 p-4 border-border-accent/20">
          <div className="flex gap-4">
            {row.result.imageUrl && (
              <img src={row.result.imageUrl} alt="" className="w-32 h-24 object-cover border border-border-subtle flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {row.result.title && (
                  <ToggleableField field="title" label="Title" value={row.result.title} enabled={row.selectedFields.has("title")} onToggle={() => onToggleField("title")} />
                )}
                {row.result.date && (
                  <ToggleableField field="date" label="Date" value={row.result.date} enabled={row.selectedFields.has("date")} onToggle={() => onToggleField("date")} />
                )}
                {row.result.studioName && (
                  <ToggleableField field="studio" label="Studio" value={row.result.studioName} enabled={row.selectedFields.has("studio")} onToggle={() => onToggleField("studio")} />
                )}
              </div>
              {row.result.performerNames.length > 0 && (
                <div className={cn("transition-opacity", !row.selectedFields.has("performers") && "opacity-40")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Checkbox checked={row.selectedFields.has("performers")} onChange={() => onToggleField("performers")} />
                    <span className="text-kicker">{entityTerms.performers}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.result.performerNames.map((name) => (
                      <span key={name} className="tag-chip tag-chip-accent">{name}</span>
                    ))}
                  </div>
                </div>
              )}
              {row.result.tagNames.length > 0 && (
                <div className={cn("transition-opacity", !row.selectedFields.has("tags") && "opacity-40")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Checkbox checked={row.selectedFields.has("tags")} onChange={() => onToggleField("tags")} />
                    <span className="text-kicker">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {row.result.tagNames.map((name) => (
                      <span key={name} className="tag-chip tag-chip-default">{name}</span>
                    ))}
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

/* ─── Scrape runner (placeholder) ─────────────────────────────── */

export async function runGalleryIdentify(): Promise<void> {}
export async function acceptAllGalleries(): Promise<void> {}
