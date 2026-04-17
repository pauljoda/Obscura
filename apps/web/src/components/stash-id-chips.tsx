"use client";

import { useState, useEffect } from "react";
import { X, Plus, Loader2, Database } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import {
  fetchStashIds,
  createStashId,
  deleteStashId,
  fetchStashBoxEndpoints,
  type StashIdEntry,
  type StashBoxEndpoint,
} from "../lib/api";
import { useNsfw } from "./nsfw/nsfw-context";

interface StashIdChipsProps {
  entityType: "video" | "performer" | "studio" | "tag";
  entityId: string;
  /** Pre-loaded stash IDs (avoids initial fetch) */
  initialStashIds?: StashIdEntry[];
  /** Called when stash IDs change */
  onUpdate?: (stashIds: StashIdEntry[]) => void;
  /** Compact mode for inline use */
  compact?: boolean;
}

export function StashIdChips({
  entityType,
  entityId,
  initialStashIds,
  onUpdate,
  compact = false,
}: StashIdChipsProps) {
  const { mode: nsfwMode } = useNsfw();
  const hiddenInSfw = nsfwMode === "off";

  const [stashIds, setStashIds] = useState<StashIdEntry[]>(initialStashIds ?? []);
  const [endpoints, setEndpoints] = useState<StashBoxEndpoint[]>([]);
  const [loading, setLoading] = useState(!initialStashIds);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEndpointId, setSelectedEndpointId] = useState("");
  const [inputStashId, setInputStashId] = useState("");

  useEffect(() => {
    if (hiddenInSfw) {
      setLoading(false);
      return;
    }
    if (initialStashIds) {
      setStashIds(initialStashIds);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchStashIds(entityType, entityId)
      .then((res) => setStashIds(res.stashIds))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entityType, entityId, initialStashIds, hiddenInSfw]);

  useEffect(() => {
    if (hiddenInSfw) return;
    if (showAddForm && endpoints.length === 0) {
      fetchStashBoxEndpoints()
        .then((res) => {
          setEndpoints(res.endpoints);
          if (res.endpoints.length > 0) setSelectedEndpointId(res.endpoints[0].id);
        })
        .catch(() => {});
    }
  }, [showAddForm, endpoints.length, hiddenInSfw]);

  async function handleAdd() {
    if (!selectedEndpointId || !inputStashId.trim()) return;
    setAdding(true);
    try {
      const created = await createStashId({
        entityType,
        entityId,
        stashBoxEndpointId: selectedEndpointId,
        stashId: inputStashId.trim(),
      });
      const updated = [...stashIds.filter((s) => s.id !== created.id), created];
      setStashIds(updated);
      onUpdate?.(updated);
      setInputStashId("");
      setShowAddForm(false);
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await deleteStashId(id);
      const updated = stashIds.filter((s) => s.id !== id);
      setStashIds(updated);
      onUpdate?.(updated);
    } catch {
      // ignore
    }
  }

  if (hiddenInSfw) {
    return null;
  }

  if (loading) {
    return <Loader2 className="h-3 w-3 animate-spin text-text-disabled" />;
  }

  const truncateId = (id: string) =>
    id.length > 12 ? id.slice(0, 8) + "..." + id.slice(-4) : id;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", compact && "gap-1")}>
      {stashIds.length === 0 && !showAddForm && (
        <span className="text-[0.62rem] text-text-disabled italic">No StashBox IDs</span>
      )}

      {stashIds.map((entry) => (
        <span
          key={entry.id}
          className={cn(
            "inline-flex items-center gap-1 border transition-colors",
            "border-border-accent/30 bg-accent-950/40 text-[0.62rem]",
            compact ? "px-1.5 py-0.5" : "px-2 py-1",
          )}
          title={`${entry.endpointName}: ${entry.stashId}`}
        >
          <Database className="h-2.5 w-2.5 text-text-accent flex-shrink-0" />
          <span className="text-text-accent font-medium">{entry.endpointName}</span>
          <span className="text-text-disabled">|</span>
          <span className="text-text-muted font-mono">{truncateId(entry.stashId)}</span>
          <button
            onClick={() => handleRemove(entry.id)}
            className="ml-0.5 text-text-disabled hover:text-status-error transition-colors"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      {showAddForm ? (
        <div className="flex items-center gap-1.5">
          <select
            value={selectedEndpointId}
            onChange={(e) => setSelectedEndpointId(e.target.value)}
            className="control-input py-0.5 text-[0.65rem] min-w-[100px]"
          >
            {endpoints.map((ep) => (
              <option key={ep.id} value={ep.id}>{ep.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={inputStashId}
            onChange={(e) => setInputStashId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Remote ID..."
            className="control-input py-0.5 text-[0.65rem] w-40"
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={adding || !inputStashId.trim()}
            className="text-[0.6rem] text-status-success-text hover:text-status-success-text/80 disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </button>
          <button
            onClick={() => { setShowAddForm(false); setInputStashId(""); }}
            className="text-[0.6rem] text-text-disabled hover:text-text-muted"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className={cn(
            "inline-flex items-center gap-0.5 border border-dashed transition-colors",
            "border-border-subtle text-text-disabled hover:text-text-accent hover:border-border-accent",
            compact ? "px-1.5 py-0.5 text-[0.55rem]" : "px-2 py-1 text-[0.62rem]",
          )}
        >
          <Plus className="h-2.5 w-2.5" />
          Add
        </button>
      )}
    </div>
  );
}

/** Helper to auto-save a stash ID after identification. Returns the created entry. */
export async function autoSaveStashId(
  entityType: "video" | "performer" | "studio" | "tag",
  entityId: string,
  stashBoxEndpointId: string,
  remoteStashId: string | undefined | null,
): Promise<StashIdEntry | null> {
  if (!remoteStashId) return null;
  try {
    return await createStashId({
      entityType,
      entityId,
      stashBoxEndpointId: stashBoxEndpointId,
      stashId: remoteStashId,
    });
  } catch {
    return null;
  }
}
