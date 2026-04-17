"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  FolderOpen,
  Plus,
  Check,
  Loader2,
  Hand,
  Zap,
  Shuffle,
} from "lucide-react";
import { Button } from "@obscura/ui/primitives/button";
import type {
  CollectionListItemDto,
  CollectionEntityType,
} from "@obscura/contracts";
import {
  fetchCollections,
  addCollectionItems,
  createCollection,
} from "../../lib/api/media";
import { revalidateCollectionCache } from "../../app/actions/revalidate-collection";

const modeIcons = {
  manual: Hand,
  dynamic: Zap,
  hybrid: Shuffle,
};

interface AddToCollectionModalProps {
  open: boolean;
  onClose: () => void;
  entityType: CollectionEntityType;
  entityId: string;
  entityTitle?: string;
  /**
   * When provided, these items are added instead of the single entityType/entityId.
   * Used to expand galleries (→ individual images) and audio libraries (→ individual tracks).
   */
  items?: { entityType: CollectionEntityType; entityId: string }[];
}

export function AddToCollectionModal({
  open,
  onClose,
  entityType,
  entityId,
  entityTitle,
  items: expandedItems,
}: AddToCollectionModalProps) {
  const [collections, setCollections] = useState<CollectionListItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingToIds, setAddingToIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setSelectedIds(new Set());
    setAddedIds(new Set());
    fetchCollections({ limit: 200, sort: "updated", order: "desc" })
      .then((res) => setCollections(res.items))
      .catch(() => setCollections([]))
      .finally(() => setIsLoading(false));
  }, [open]);

  const itemsToAdd = expandedItems ?? [{ entityType, entityId }];

  const handleAdd = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setAddingToIds(new Set(ids));

    // Fire all adds in parallel for speed
    await Promise.allSettled(
      ids.map(async (collId) => {
        try {
          await addCollectionItems(collId, { items: itemsToAdd });
          setAddedIds((prev) => new Set([...prev, collId]));
        } catch (err) {
          console.error(`Failed to add to ${collId}:`, err);
        }
      }),
    );

    // Invalidate server cache so collection pages show fresh data
    await revalidateCollectionCache(ids);
    setAddingToIds(new Set());
    setTimeout(onClose, 400);
  }, [selectedIds, itemsToAdd, onClose]);

  const handleCreateAndAdd = useCallback(async () => {
    setIsCreating(true);
    try {
      const coll = await createCollection({
        name: entityTitle
          ? `${entityTitle} collection`
          : "New Collection",
      });

      // Add items to the new collection
      await addCollectionItems(coll.id, { items: itemsToAdd });

      // Build type counts from the items being added
      const counts = { video: 0, gallery: 0, image: 0, "audio-track": 0 };
      for (const item of itemsToAdd) {
        counts[item.entityType] = (counts[item.entityType] ?? 0) + 1;
      }

      // Immediately insert the new collection into the list so the user
      // sees it appear with a success checkmark — no delay.
      setCollections((prev) => [
        {
          ...coll,
          itemCount: itemsToAdd.length,
          typeCounts: counts,
        } as CollectionListItemDto,
        ...prev,
      ]);
      setAddedIds((prev) => new Set([...prev, coll.id]));
      // Invalidate server cache
      await revalidateCollectionCache([coll.id]);
    } catch (err) {
      console.error("Failed to create collection:", err);
    } finally {
      setIsCreating(false);
    }
  }, [itemsToAdd, entityTitle]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-surface-1 border border-border-default shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-heading font-medium text-text-primary">
            Add to Collection
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {/* Create new */}
          <button
            onClick={handleCreateAndAdd}
            disabled={isCreating}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-2 transition-colors border-b border-border-subtle mb-1"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 text-text-accent animate-spin" />
            ) : (
              <Plus className="h-4 w-4 text-text-accent" />
            )}
            <span className="text-[0.78rem] text-text-accent font-medium">
              {isCreating ? "Creating..." : "Create new collection"}
            </span>
          </button>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 text-text-muted animate-spin" />
            </div>
          ) : collections.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-sm">
              No collections yet
            </div>
          ) : (
            <div className="space-y-[1px]">
              {collections.map((coll) => {
                const isSelected = selectedIds.has(coll.id);
                const isAdding = addingToIds.has(coll.id);
                const isAdded = addedIds.has(coll.id);
                const ModeIcon = modeIcons[coll.mode];

                return (
                  <button
                    key={coll.id}
                    onClick={() => {
                      if (isAdded) return;
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(coll.id)) {
                          next.delete(coll.id);
                        } else {
                          next.add(coll.id);
                        }
                        return next;
                      });
                    }}
                    disabled={isAdding || isAdded}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-accent-brass/10"
                        : isAdded
                          ? "bg-green-500/5"
                          : "hover:bg-surface-2"
                    } disabled:cursor-default`}
                  >
                    {/* Checkbox area */}
                    <div
                      className={`h-4 w-4 flex items-center justify-center border flex-shrink-0 ${
                        isSelected || isAdded
                          ? "border-accent-brass/50 bg-accent-brass/20"
                          : "border-border-default"
                      }`}
                    >
                      {isAdding && (
                        <Loader2 className="h-3 w-3 text-text-accent animate-spin" />
                      )}
                      {isAdded && (
                        <Check className="h-3 w-3 text-green-400" />
                      )}
                      {isSelected && !isAdding && !isAdded && (
                        <Check className="h-3 w-3 text-text-accent" />
                      )}
                    </div>

                    {/* Collection info */}
                    <FolderOpen className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[0.78rem] text-text-primary truncate block">
                        {coll.name}
                      </span>
                    </div>
                    {isAdded && (
                      <span className="text-[0.6rem] font-mono text-green-400 flex-shrink-0">
                        Added
                      </span>
                    )}
                    <span className="text-[0.65rem] font-mono text-text-disabled flex-shrink-0 inline-flex items-center gap-0.5">
                      <ModeIcon className="h-2.5 w-2.5" />
                      {coll.itemCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between">
            <span className="text-[0.75rem] text-text-muted">
              {selectedIds.size} selected
            </span>
            <Button
              onClick={handleAdd}
              disabled={addingToIds.size > 0}
              size="sm"
            >
              {addingToIds.size > 0 ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Confirm
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
