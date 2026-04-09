"use client";

import { Loader2 } from "lucide-react";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";

/* ─── StatusDot ───────────────────────────────────────────────── */

export function StatusDot({ status }: { status: string }) {
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

/* ─── ToggleableField ─────────────────────────────────────────── */

export function ToggleableField({
  label,
  value,
  enabled,
  onToggle,
}: {
  /** Semantic field key -- used by callers for identification */
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
      <Checkbox
        checked={enabled}
        onChange={() => onToggle()}
        className="mt-0.5 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="min-w-0">
        <span className="text-text-disabled text-[0.6rem] uppercase tracking-wider font-semibold">{label}</span>
        <p className={cn("truncate text-[0.78rem]", enabled ? "text-text-primary" : "text-text-disabled line-through")}>{value}</p>
      </div>
    </div>
  );
}
