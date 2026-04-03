"use client";

import { useState } from "react";
import { Badge, Button, StatusLed } from "@obscura/ui";
import { cn } from "@obscura/ui";
import {
  Check,
  X,
  ChevronRight,
  Plus,
  Minus,
  FileQuestion,
  ArrowRightLeft,
} from "lucide-react";

interface UnmatchedItem {
  id: string;
  filename: string;
  size: string;
  status: "pending" | "matched" | "rejected";
}

interface MatchField {
  field: string;
  current: string | null;
  proposed: string;
  type: "add" | "change";
}

const unmatchedItems: UnmatchedItem[] = [
  { id: "1", filename: "Scene_2024_0142.mp4", size: "4.2 GB", status: "pending" },
  { id: "2", filename: "Scene_2024_0089.mp4", size: "2.1 GB", status: "pending" },
  { id: "3", filename: "Scene_2023_0421.mp4", size: "6.8 GB", status: "matched" },
  { id: "4", filename: "Scene_2024_0203.mp4", size: "1.4 GB", status: "pending" },
  { id: "5", filename: "Scene_2023_0299.mp4", size: "8.1 GB", status: "pending" },
  { id: "6", filename: "Scene_2024_0067.mp4", size: "3.3 GB", status: "rejected" },
  { id: "7", filename: "Scene_2023_0188.mp4", size: "5.0 GB", status: "pending" },
];

const matchFields: MatchField[] = [
  { field: "Title", current: null, proposed: "Sunset Session Vol. 12", type: "add" },
  { field: "Studio", current: null, proposed: "Studio Alpha", type: "add" },
  { field: "Performers", current: null, proposed: "Performer A, Performer B", type: "add" },
  { field: "Tags", current: null, proposed: "tag-one, tag-two, tag-three", type: "add" },
  { field: "Date", current: null, proposed: "2024-06-15", type: "add" },
  { field: "Duration", current: "24:30", proposed: "24:30", type: "change" },
];

export function ResolveWorkflow() {
  const [selectedId, setSelectedId] = useState<string>("1");

  const pendingCount = unmatchedItems.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>Resolve</h1>
          <p className="mt-1 text-text-muted text-sm">
            Review and apply metadata from imports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="accent">{pendingCount} pending</Badge>
          <Button variant="primary" size="sm">
            Accept All Matches
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-[600px]">
        {/* Left panel: Unmatched queue */}
        <div className="space-y-2">
          <h4 className="text-kicker mb-3">Unmatched Queue</h4>
          <div className="space-y-1">
            {unmatchedItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "w-full text-left surface-card p-3 flex items-center gap-3 transition-colors duration-fast",
                  selectedId === item.id && "border-border-accent bg-accent-950/30"
                )}
              >
                <StatusLed
                  status={
                    item.status === "matched"
                      ? "active"
                      : item.status === "rejected"
                        ? "error"
                        : "warning"
                  }
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-mono-sm truncate">{item.filename}</p>
                  <p className="text-text-disabled text-xs">{item.size}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-text-disabled flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Right panel: Match review */}
        <div className="lg:col-span-2">
          <h4 className="text-kicker mb-3">Match Review</h4>
          <div className="surface-panel p-5 space-y-5">
            {/* Source file */}
            <div>
              <span className="text-label text-text-muted">Source File</span>
              <p className="text-mono mt-1">
                {unmatchedItems.find((i) => i.id === selectedId)?.filename}
              </p>
            </div>

            <div className="separator" />

            {/* Match candidate */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ArrowRightLeft className="h-3.5 w-3.5 text-accent-500" />
                <span className="text-label text-text-muted">
                  Match Candidate
                </span>
                <Badge variant="info" className="text-[0.6rem]">
                  StashDB · 92% confidence
                </Badge>
              </div>
              <p className="text-sm font-medium mt-1">
                Sunset Session Vol. 12
              </p>
            </div>

            <div className="separator" />

            {/* Diff view */}
            <div>
              <span className="text-label text-text-muted mb-3 block">
                Changes to Apply
              </span>
              <div className="surface-well p-3 space-y-0">
                {matchFields.map((field, i) => (
                  <div key={field.field}>
                    <div className="flex items-center gap-3 py-2.5">
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-sm",
                          field.type === "add"
                            ? "bg-success-muted/30 text-success-text"
                            : "bg-info-muted/30 text-info-text"
                        )}
                      >
                        {field.type === "add" ? (
                          <Plus className="h-3 w-3" />
                        ) : (
                          <Minus className="h-3 w-3" />
                        )}
                      </span>
                      <span className="text-label text-text-muted w-24">
                        {field.field}
                      </span>
                      {field.current && (
                        <>
                          <span className="text-mono-sm text-text-disabled line-through">
                            {field.current}
                          </span>
                          <ChevronRight className="h-3 w-3 text-text-disabled" />
                        </>
                      )}
                      <span
                        className={cn(
                          "text-mono-sm",
                          field.type === "add"
                            ? "text-success-text"
                            : "text-info-text"
                        )}
                      >
                        {field.proposed}
                      </span>
                    </div>
                    {i < matchFields.length - 1 && (
                      <div className="separator" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" size="md">
                <X className="h-3.5 w-3.5 mr-1.5" />
                Reject
              </Button>
              <Button variant="primary" size="md">
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Accept Match
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
