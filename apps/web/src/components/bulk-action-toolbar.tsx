"use client";

import { ShieldAlert, ShieldOff, Trash2, X, Loader2 } from "lucide-react";
import { Button } from "@obscura/ui/primitives/button";

interface BulkActionToolbarProps {
  selectedCount: number;
  onDeselectAll: () => void;
  onMarkNsfw: () => void;
  onUnmarkNsfw: () => void;
  onDelete: () => void;
  loading?: boolean;
}

export function BulkActionToolbar({
  selectedCount,
  onDeselectAll,
  onMarkNsfw,
  onUnmarkNsfw,
  onDelete,
  loading,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-4 px-4 pointer-events-none">
      <div className="surface-elevated border border-border-subtle shadow-lg pointer-events-auto flex items-center gap-3 px-4 py-2.5">
        {loading && <Loader2 className="h-3.5 w-3.5 text-text-accent animate-spin" />}
        <span className="text-[0.78rem] font-medium text-text-primary tabular-nums">
          {selectedCount} selected
        </span>

        <div className="h-5 w-px bg-border-subtle" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkNsfw}
          disabled={loading}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Mark NSFW
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onUnmarkNsfw}
          disabled={loading}
        >
          <ShieldOff className="h-3.5 w-3.5" />
          Unmark NSFW
        </Button>

        <div className="h-5 w-px bg-border-subtle" />

        <Button
          variant="danger"
          size="sm"
          onClick={onDelete}
          disabled={loading}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>

        <div className="h-5 w-px bg-border-subtle" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onDeselectAll}
          disabled={loading}
        >
          <X className="h-3.5 w-3.5" />
          Deselect
        </Button>
      </div>
    </div>
  );
}
