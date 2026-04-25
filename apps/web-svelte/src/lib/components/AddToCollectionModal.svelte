<script lang="ts">
  import { invalidate } from "$app/navigation";
  import {
    Check,
    FolderOpen,
    Hand,
    Loader2,
    Plus,
    Shuffle,
    X,
    Zap,
  } from "@lucide/svelte";
  import type {
    CollectionEntityType,
    CollectionListItemDto,
  } from "@obscura/contracts";
  import { Button, dur, ease, flyUp } from "@obscura/ui-svelte";
  import { fade } from "svelte/transition";
  import {
    addCollectionItems,
    createCollection,
    fetchCollections,
  } from "$lib/api/media";

  interface Props {
    open: boolean;
    onClose: () => void;
    entityType: CollectionEntityType;
    entityId: string;
    entityTitle?: string;
    items?: { entityType: CollectionEntityType; entityId: string }[];
  }

  let {
    open,
    onClose,
    entityType,
    entityId,
    entityTitle,
    items: expandedItems,
  }: Props = $props();

  const modeIcons = {
    manual: Hand,
    dynamic: Zap,
    hybrid: Shuffle,
  } as const;

  let collections = $state<CollectionListItemDto[]>([]);
  let isLoading = $state(false);
  let selectedIds = $state<string[]>([]);
  let addingToIds = $state<string[]>([]);
  let addedIds = $state<string[]>([]);
  let isCreating = $state(false);

  const itemsToAdd = $derived(
    expandedItems ?? [{ entityType, entityId }],
  );

  $effect(() => {
    if (!open) return;

    let cancelled = false;
    selectedIds = [];
    addingToIds = [];
    addedIds = [];
    isLoading = true;

    void fetchCollections({ limit: 200, sort: "updated", order: "desc" })
      .then((response) => {
        if (cancelled) return;
        collections = response.items;
      })
      .catch(() => {
        if (cancelled) return;
        collections = [];
      })
      .finally(() => {
        if (!cancelled) isLoading = false;
      });

    return () => {
      cancelled = true;
    };
  });

  function toggleSelection(collectionId: string) {
    selectedIds = selectedIds.includes(collectionId)
      ? selectedIds.filter((id) => id !== collectionId)
      : [...selectedIds, collectionId];
  }

  async function refreshCollectionDependencies(collectionIds: Iterable<string>) {
    await invalidate("collections");
    await Promise.all(
      Array.from(collectionIds, (collectionId) =>
        invalidate(`collections:${collectionId}`),
      ),
    );
  }

  async function handleAdd() {
    if (selectedIds.length === 0) return;

    const ids = [...selectedIds];
    addingToIds = ids;

    await Promise.allSettled(
      ids.map(async (collectionId) => {
        try {
          await addCollectionItems(collectionId, { items: itemsToAdd });
          addedIds = [...addedIds, collectionId];
        } catch {
          // Ignore per-collection failures so the user still gets partial success.
        }
      }),
    );

    await refreshCollectionDependencies(ids);
    addingToIds = [];
    window.setTimeout(() => onClose(), 400);
  }

  async function handleCreateAndAdd() {
    isCreating = true;
    try {
      const collection = await createCollection({
        name: entityTitle ? `${entityTitle} collection` : "New Collection",
      });

      await addCollectionItems(collection.id, { items: itemsToAdd });

      const typeCounts = { video: 0, gallery: 0, image: 0, "audio-track": 0 };
      for (const item of itemsToAdd) {
        typeCounts[item.entityType] += 1;
      }

      collections = [
        {
          ...collection,
          itemCount: itemsToAdd.length,
          typeCounts,
        } as CollectionListItemDto,
        ...collections,
      ];
      addedIds = [...addedIds, collection.id];
      await refreshCollectionDependencies([collection.id]);
    } finally {
      isCreating = false;
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button
      type="button"
      class="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onclick={onClose}
      aria-label="Close add to collection modal"
      transition:fade={{ duration: dur.normal, easing: ease.enter }}
    ></button>

    <div class="relative z-10 w-full max-w-md surface-elevated" transition:flyUp>
      <div class="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 class="text-sm font-heading font-medium text-text-primary">
          Add to Collection
        </h2>
        <button
          type="button"
          onclick={onClose}
          class="p-1 text-text-muted transition-colors hover:text-text-secondary"
          aria-label="Close add to collection modal"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="max-h-[60vh] overflow-y-auto p-2">
        <button
          type="button"
          onclick={() => void handleCreateAndAdd()}
          disabled={isCreating}
          class="mb-1 flex w-full items-center gap-2 border-b border-border-subtle px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
        >
          {#if isCreating}
            <Loader2 class="h-4 w-4 animate-spin text-text-accent" />
          {:else}
            <Plus class="h-4 w-4 text-text-accent" />
          {/if}
          <span class="text-[0.78rem] font-medium text-text-accent">
            {isCreating ? "Creating..." : "Create new collection"}
          </span>
        </button>

        {#if isLoading}
          <div class="flex items-center justify-center py-8">
            <Loader2 class="h-5 w-5 animate-spin text-text-muted" />
          </div>
        {:else if collections.length === 0}
          <div class="py-8 text-center text-sm text-text-muted">
            No collections yet
          </div>
        {:else}
          <div class="space-y-[1px]">
            {#each collections as collection (collection.id)}
              {@const isSelected = selectedIds.includes(collection.id)}
              {@const isAdding = addingToIds.includes(collection.id)}
              {@const isAdded = addedIds.includes(collection.id)}
              {@const ModeIcon = modeIcons[collection.mode]}

              <button
                type="button"
                onclick={() => {
                  if (isAdded) return;
                  toggleSelection(collection.id);
                }}
                disabled={isAdding || isAdded}
                class={[
                  "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors disabled:cursor-default",
                  isSelected
                    ? "bg-accent-brass/10"
                    : isAdded
                      ? "bg-green-500/5"
                      : "hover:bg-surface-2",
                ]}
              >
                <div
                  class={[
                    "flex h-4 w-4 shrink-0 items-center justify-center border",
                    isSelected || isAdded
                      ? "border-accent-brass/50 bg-accent-brass/20"
                      : "border-border-default",
                  ]}
                >
                  {#if isAdding}
                    <Loader2 class="h-3 w-3 animate-spin text-text-accent" />
                  {:else if isAdded}
                    <Check class="h-3 w-3 text-green-400" />
                  {:else if isSelected}
                    <Check class="h-3 w-3 text-text-accent" />
                  {/if}
                </div>

                <FolderOpen class="h-3.5 w-3.5 shrink-0 text-text-muted" />
                <div class="min-w-0 flex-1">
                  <span class="block truncate text-[0.78rem] text-text-primary">
                    {collection.name}
                  </span>
                </div>
                {#if isAdded}
                  <span class="shrink-0 text-[0.6rem] font-mono text-green-400">
                    Added
                  </span>
                {/if}
                <span
                  class="inline-flex shrink-0 items-center gap-0.5 text-[0.65rem] font-mono text-text-disabled"
                >
                  <ModeIcon class="h-2.5 w-2.5" />
                  {collection.itemCount}
                </span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      {#if selectedIds.length > 0}
        <div class="flex items-center justify-between border-t border-border-subtle px-4 py-3">
          <span class="text-[0.75rem] text-text-muted">
            {selectedIds.length} selected
          </span>
          <Button size="sm" onclick={() => void handleAdd()} disabled={addingToIds.length > 0}>
            {#if addingToIds.length > 0}
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
            {:else}
              <Check class="h-3.5 w-3.5" />
            {/if}
            Confirm
          </Button>
        </div>
      {/if}
    </div>
  </div>
{/if}
