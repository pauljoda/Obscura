"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus, Grid3x3, List, Search } from "lucide-react";
import type { CollectionListItemDto } from "@obscura/contracts";
import { Button } from "@obscura/ui/primitives/button";
import { CollectionCard } from "../collections/collection-card";
import { createCollection } from "../../lib/api/media";

interface CollectionsPageClientProps {
  initialCollections: CollectionListItemDto[];
  initialTotal: number;
}

export function CollectionsPageClient({
  initialCollections,
  initialTotal,
}: CollectionsPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [collections, setCollections] = useState(initialCollections);
  const [total, setTotal] = useState(initialTotal);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const result = await createCollection({ name: "New Collection" });
      router.push(`/collections/${result.id}/edit`);
    } catch (err) {
      console.error("Failed to create collection:", err);
    } finally {
      setIsCreating(false);
    }
  }, [router]);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2.5">
            <FolderOpen className="h-5 w-5 text-text-accent" />
            Collections
          </h1>
          <p className="text-text-muted text-[0.78rem] mt-1">
            {total} collection{total !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={isCreating}>
          <Plus className="h-4 w-4" />
          New Collection
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
          <input
            type="text"
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-sm bg-surface-1 border border-border-default text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent-brass/30"
          />
        </div>

        {/* View mode toggle */}
        <div className="flex items-center border border-border-default">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 ${viewMode === "grid" ? "bg-surface-2 text-text-accent" : "text-text-muted hover:text-text-secondary"}`}
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 ${viewMode === "list" ? "bg-surface-2 text-text-accent" : "text-text-muted hover:text-text-secondary"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Collection grid/list */}
      {collections.length === 0 ? (
        <div className="surface-well flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center bg-surface-3 mb-4">
            <FolderOpen className="h-8 w-8 text-text-disabled" />
          </div>
          <h3 className="text-base font-medium font-heading text-text-secondary mb-1">
            No collections yet
          </h3>
          <p className="text-text-muted text-sm max-w-xs">
            Collections let you group videos, galleries, images, and audio into
            curated playlists and smart sets.
          </p>
          <Button onClick={handleCreate} disabled={isCreating} size="lg" className="mt-4">
            <Plus className="h-4 w-4" />
            Create your first collection
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {collections
            .filter(
              (c) =>
                !searchQuery ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                variant="grid"
              />
            ))}
        </div>
      ) : (
        <div className="space-y-[1px]">
          {collections
            .filter(
              (c) =>
                !searchQuery ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                variant="list"
              />
            ))}
        </div>
      )}
    </div>
  );
}
