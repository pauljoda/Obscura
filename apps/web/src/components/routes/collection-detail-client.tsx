"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FolderOpen,
  Film,
  Images,
  Layers,
  Music,
  Pencil,
  Trash2,
  RefreshCw,
  Play,
  LayoutGrid,
  LayoutList,
  Shuffle,
  Zap,
  Hand,
  ChevronLeft,
  CheckSquare,
  X,
  Loader2,
} from "lucide-react";
import type {
  CollectionDetailDto,
  CollectionItemDto,
  CollectionEntityType,
} from "@obscura/contracts";
import { Button } from "@obscura/ui/primitives/button";
import {
  deleteCollection,
  refreshCollection,
  removeCollectionItems,
} from "../../lib/api/media";
import { CollectionItemCard } from "../collections/collection-item-card";
import { usePlaylistContext } from "../collections/playlist-context";

type ViewMode = "mixed" | "by-type";

interface CollectionDetailClientProps {
  collection: CollectionDetailDto;
  initialItems: CollectionItemDto[];
  initialTotal: number;
}

const modeIcons = {
  manual: Hand,
  dynamic: Zap,
  hybrid: Shuffle,
};

const modeLabels = {
  manual: "Manual",
  dynamic: "Dynamic",
  hybrid: "Hybrid",
};

const typeLabels: Record<CollectionEntityType, string> = {
  scene: "Scenes",
  gallery: "Galleries",
  image: "Images",
  "audio-track": "Audio",
};

const typeIcons: Record<CollectionEntityType, typeof Film> = {
  scene: Film,
  gallery: Images,
  image: Layers,
  "audio-track": Music,
};

export function CollectionDetailClient({
  collection,
  initialItems,
  initialTotal,
}: CollectionDetailClientProps) {
  const router = useRouter();
  const playlist = usePlaylistContext();
  const [items, setItems] = useState(initialItems);
  const [viewMode, setViewMode] = useState<ViewMode>("mixed");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isRemoving, setIsRemoving] = useState(false);

  const ModeIcon = modeIcons[collection.mode];
  const hasManualItems = items.some((i) => i.source === "manual");

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshCollection(collection.id);
      router.refresh();
    } catch (err) {
      console.error("Failed to refresh:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [collection.id, router]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this collection? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      await deleteCollection(collection.id);
      router.push("/collections");
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setIsDeleting(false);
    }
  }, [collection.id, router]);

  const handleStartPlaylist = useCallback(
    (startIndex = 0) => {
      playlist.startPlaylist(items, collection.name, startIndex);
    },
    [items, collection.name, playlist],
  );

  const toggleSelectItem = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleRemoveSelected = useCallback(async () => {
    if (selectedItemIds.size === 0) return;
    setIsRemoving(true);
    try {
      await removeCollectionItems(collection.id, {
        itemIds: Array.from(selectedItemIds),
      });
      // Remove from local state immediately
      setItems((prev) =>
        prev.filter((i) => !selectedItemIds.has(i.id)),
      );
      setSelectedItemIds(new Set());
      setSelectMode(false);
    } catch (err) {
      console.error("Failed to remove items:", err);
    } finally {
      setIsRemoving(false);
    }
  }, [selectedItemIds, collection.id]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedItemIds(new Set());
  }, []);

  // Group items by type
  const itemsByType = items.reduce(
    (acc, item) => {
      if (!acc[item.entityType]) acc[item.entityType] = [];
      acc[item.entityType].push(item);
      return acc;
    },
    {} as Record<CollectionEntityType, CollectionItemDto[]>,
  );

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/collections"
        className="inline-flex items-center gap-1 text-[0.78rem] text-text-muted hover:text-text-secondary transition-colors duration-fast"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Collections
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="flex items-center gap-2.5">
            <FolderOpen className="h-5 w-5 text-text-accent" />
            {collection.name}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="inline-flex items-center gap-1 text-[0.75rem] font-mono text-text-muted">
              <ModeIcon className="h-3 w-3" />
              {modeLabels[collection.mode]}
            </span>
            <span className="text-[0.75rem] text-text-muted">
              {collection.itemCount} items
            </span>
            {collection.lastRefreshedAt && (
              <span className="text-[0.7rem] text-text-disabled">
                Last refreshed{" "}
                {new Date(collection.lastRefreshedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          {collection.description && (
            <p className="text-text-muted text-[0.78rem] mt-2 max-w-2xl">
              {collection.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {items.length > 0 && (
            <Button
              onClick={() => handleStartPlaylist(0)}
              size="sm"
            >
              <Play className="h-3.5 w-3.5" />
              Play
            </Button>
          )}
          {collection.mode !== "manual" && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-text-muted hover:text-text-accent transition-colors disabled:opacity-50"
              title="Refresh dynamic rules"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
          )}
          <Link
            href={`/collections/${collection.id}/edit`}
            className="p-1.5 text-text-muted hover:text-text-accent transition-colors"
            title="Edit collection"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 text-text-muted hover:text-error-text transition-colors disabled:opacity-50"
            title="Delete collection"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Type breakdown */}
      <div className="flex items-center gap-4">
        {(
          Object.entries(collection.typeCounts) as [
            CollectionEntityType,
            number,
          ][]
        )
          .filter(([, count]) => count > 0)
          .map(([type, count]) => {
            const Icon = typeIcons[type];
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 text-[0.75rem] text-text-secondary"
              >
                <Icon className="h-3.5 w-3.5 text-text-muted" />
                {count} {typeLabels[type]}
              </span>
            );
          })}
      </div>

      {/* View mode toolbar */}
      <div className="flex items-center gap-1 border-b border-border-subtle pb-2">
        <button
          onClick={() => setViewMode("mixed")}
          className={`px-3 py-1.5 text-[0.78rem] font-medium transition-colors ${
            viewMode === "mixed"
              ? "text-text-accent border-b-2 border-accent-brass"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          <LayoutGrid className="inline h-3.5 w-3.5 mr-1" />
          Mixed
        </button>
        <button
          onClick={() => setViewMode("by-type")}
          className={`px-3 py-1.5 text-[0.78rem] font-medium transition-colors ${
            viewMode === "by-type"
              ? "text-text-accent border-b-2 border-accent-brass"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          <LayoutList className="inline h-3.5 w-3.5 mr-1" />
          By Type
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Select mode toggle */}
        {hasManualItems && !selectMode && (
          <button
            onClick={() => setSelectMode(true)}
            className="px-2 py-1 text-[0.72rem] text-text-muted hover:text-text-secondary transition-colors"
          >
            <CheckSquare className="inline h-3.5 w-3.5 mr-1" />
            Select
          </button>
        )}
      </div>

      {/* Selection action bar */}
      {selectMode && (
        <div className="flex items-center justify-between px-3 py-2 bg-surface-2 border border-border-subtle">
          <div className="flex items-center gap-3">
            <span className="text-[0.75rem] text-text-secondary">
              {selectedItemIds.size} selected
            </span>
            {selectedItemIds.size > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleRemoveSelected}
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Remove from Collection
              </Button>
            )}
          </div>
          <button
            onClick={exitSelectMode}
            className="p-1 text-text-muted hover:text-text-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Content */}
      {items.length === 0 ? (
        <div className="surface-well flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-10 w-10 text-text-disabled mb-3" />
          <p className="text-text-muted text-sm">
            This collection is empty.{" "}
            {collection.mode !== "manual"
              ? "Try refreshing the dynamic rules."
              : "Add items from scene, gallery, image, or audio pages."}
          </p>
        </div>
      ) : viewMode === "mixed" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {items.map((item) => (
            <CollectionItemCard
              key={item.id}
              item={item}
              selectable={selectMode}
              selected={selectedItemIds.has(item.id)}
              onSelect={toggleSelectItem}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {(
            ["scene", "gallery", "image", "audio-track"] as CollectionEntityType[]
          )
            .filter((type) => itemsByType[type]?.length)
            .map((type) => {
              const Icon = typeIcons[type];
              return (
                <div key={type}>
                  <h2 className="flex items-center gap-2 text-sm font-heading font-medium text-text-secondary mb-3">
                    <Icon className="h-4 w-4 text-text-muted" />
                    {typeLabels[type]}
                    <span className="text-text-disabled font-mono text-[0.7rem]">
                      {itemsByType[type].length}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {itemsByType[type].map((item) => (
                      <CollectionItemCard
                        key={item.id}
                        item={item}
                        selectable={selectMode}
                        selected={selectedItemIds.has(item.id)}
                        onSelect={toggleSelectItem}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
