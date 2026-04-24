<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { page } from "$app/state";
  import {
    CheckSquare,
    Edit,
    FolderOpen,
    Grid3X3,
    Hand,
    Images,
    Image as ImageIcon,
    List,
    Loader2,
    Music,
    Play,
    RefreshCw,
    Shuffle,
    Trash2,
    X,
    Zap,
    Film,
  } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
  import type {
    CollectionEntityType,
    CollectionItemDto,
    CollectionMode,
  } from "@obscura/contracts";
  import { deleteCollection, fetchCollectionItems, refreshCollection, removeCollectionItems } from "$lib/api/media";
  import CollectionItemCard from "$lib/components/collections/CollectionItemCard.svelte";
  import { usePlaylist } from "$lib/stores/playlist.svelte";

  type ViewMode = "mixed" | "by-type";

  let { data } = $props();
  const playlist = usePlaylist();
  const c = $derived(data.collection);
  const initialItems = $derived(data.items as CollectionItemDto[]);
  let items = $derived(initialItems);
  let viewMode = $state<ViewMode>("mixed");
  let selectMode = $state(false);
  let selectedItemIds = $state<string[]>([]);
  let refreshing = $state(false);
  let deleting = $state(false);
  let removing = $state(false);

  const typeOrder: CollectionEntityType[] = ["video", "gallery", "image", "audio-track"];
  const modeIcons: Record<CollectionMode, typeof Hand> = {
    manual: Hand,
    dynamic: Zap,
    hybrid: Shuffle,
  };
  const modeLabels: Record<CollectionMode, string> = {
    manual: "Manual",
    dynamic: "Dynamic",
    hybrid: "Hybrid",
  };
  const typeLabels: Record<CollectionEntityType, string> = {
    video: "Videos",
    gallery: "Galleries",
    image: "Images",
    "audio-track": "Audio",
  };
  const typeIcons: Record<CollectionEntityType, typeof Film> = {
    video: Film,
    gallery: Images,
    image: ImageIcon,
    "audio-track": Music,
  };

  const ModeIcon = $derived(modeIcons[c.mode as CollectionMode]);
  const hasManualItems = $derived(items.some((item) => item.source === "manual"));
  const selectedCount = $derived(selectedItemIds.length);
  const currentPath = $derived(page.url.pathname);
  const itemsByType = $derived.by(() => {
    const grouped: Record<CollectionEntityType, CollectionItemDto[]> = {
      video: [],
      gallery: [],
      image: [],
      "audio-track": [],
    };
    for (const item of items) grouped[item.entityType].push(item);
    return grouped;
  });

  function slideshowDuration() {
    return c.slideshowAutoAdvance ? c.slideshowDurationSeconds : 0;
  }

  function startPlayback(shuffle = false) {
    if (items.length === 0) return;
    playlist.startPlaylist(items, c.name, 0, {
      shuffle,
      slideshowDurationSeconds: slideshowDuration(),
    });
  }

  async function refreshDynamicRules() {
    if (refreshing) return;
    refreshing = true;
    try {
      await refreshCollection(c.id);
      await invalidate(`collections:${c.id}`);
      const fresh = await fetchCollectionItems(c.id, { limit: 200 });
      items = fresh.items;
      selectedItemIds = selectedItemIds.filter((id) => fresh.items.some((item) => item.id === id));
    } finally {
      refreshing = false;
    }
  }

  async function deleteThisCollection() {
    if (deleting) return;
    if (!confirm("Delete this collection? This cannot be undone.")) return;
    deleting = true;
    try {
      await deleteCollection(c.id);
      await invalidate("collections");
      await goto("/collections");
    } finally {
      deleting = false;
    }
  }

  function toggleSelection(itemId: string) {
    if (selectedItemIds.includes(itemId)) {
      selectedItemIds = selectedItemIds.filter((id) => id !== itemId);
      return;
    }
    selectedItemIds = [...selectedItemIds, itemId];
  }

  async function removeSelectedItems() {
    if (selectedItemIds.length === 0 || removing) return;
    const ids = selectedItemIds;
    const previous = items;
    removing = true;
    items = items.filter((item) => !ids.includes(item.id));
    selectedItemIds = [];
    selectMode = false;
    try {
      await removeCollectionItems(c.id, { itemIds: ids });
      await invalidate(`collections:${c.id}`);
      await invalidate("collections");
    } catch (err) {
      items = previous;
      throw err;
    } finally {
      removing = false;
    }
  }

  function exitSelectMode() {
    selectMode = false;
    selectedItemIds = [];
  }
</script>

<svelte:head>
  <title>{c.name} — Obscura</title>
</svelte:head>

<div class="space-y-5">
  <header class="space-y-3">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1 space-y-1.5">
        <h1 class="flex items-center gap-2.5 text-text-primary">
          <FolderOpen class="h-5 w-5 text-text-accent" />
          {c.name}
        </h1>
        <div class="flex flex-wrap items-center gap-3 text-[0.75rem] text-text-muted">
          <span class="inline-flex items-center gap-1 font-mono">
            <ModeIcon class="h-3 w-3" />
            {modeLabels[c.mode as CollectionMode]}
          </span>
          <span>{items.length} item{items.length === 1 ? "" : "s"}</span>
          {#if c.lastRefreshedAt}
            <span class="text-text-disabled">
              Last refreshed {new Date(c.lastRefreshedAt).toLocaleDateString()}
            </span>
          {/if}
          {#if c.slideshowAutoAdvance}
            <Badge>auto-advance {c.slideshowDurationSeconds}s</Badge>
          {/if}
        </div>
        {#if c.description}
          <p class="max-w-2xl whitespace-pre-wrap text-[0.78rem] leading-relaxed text-text-muted">
            {c.description}
          </p>
        {/if}
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      {#if items.length > 0}
        <Button size="sm" onclick={() => startPlayback(false)}>
          <Play class="h-3.5 w-3.5" />
          Play All
        </Button>
        <Button size="sm" variant="secondary" onclick={() => startPlayback(true)}>
          <Shuffle class="h-3.5 w-3.5" />
          Shuffle All
        </Button>
      {/if}

      <div class="min-w-3 flex-1"></div>

      {#if c.mode !== "manual"}
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center text-text-muted transition-colors hover:text-text-accent disabled:opacity-50"
          aria-label="Refresh dynamic rules"
          title="Refresh dynamic rules"
          disabled={refreshing}
          onclick={refreshDynamicRules}
        >
          <RefreshCw class={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      {/if}
      <a
        href={`/collections/${c.id}/edit`}
        class="flex h-8 w-8 items-center justify-center text-text-muted transition-colors hover:text-text-accent"
        aria-label="Edit collection"
        title="Edit collection"
      >
        <Edit class="h-4 w-4" />
      </a>
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center text-text-muted transition-colors hover:text-error-text disabled:opacity-50"
        aria-label="Delete collection"
        title="Delete collection"
        disabled={deleting}
        onclick={deleteThisCollection}
      >
        {#if deleting}
          <Loader2 class="h-4 w-4 animate-spin" />
        {:else}
          <Trash2 class="h-4 w-4" />
        {/if}
      </button>
    </div>
  </header>

  {#if Object.values(c.typeCounts).some((n) => n > 0)}
    <div class="flex flex-wrap gap-4">
      {#each typeOrder as type (type)}
        {@const count = c.typeCounts[type] ?? 0}
        {#if count > 0}
          {@const Icon = typeIcons[type]}
          <span class="inline-flex items-center gap-1.5 text-[0.75rem] text-text-secondary">
            <Icon class="h-3.5 w-3.5 text-text-muted" />
            {count} {typeLabels[type]}
          </span>
        {/if}
      {/each}
    </div>
  {/if}

  <div class="flex items-center gap-1 border-b border-border-subtle pb-2">
    <button
      type="button"
      onclick={() => (viewMode = "mixed")}
      class={`px-3 py-1.5 text-[0.78rem] font-medium transition-colors ${
        viewMode === "mixed"
          ? "border-b-2 border-accent-brass text-text-accent shadow-[0_8px_20px_rgba(196,154,90,0.12)]"
          : "text-text-muted hover:text-text-secondary"
      }`}
      aria-pressed={viewMode === "mixed"}
    >
      <Grid3X3 class="mr-1 inline h-3.5 w-3.5" />
      Mixed
    </button>
    <button
      type="button"
      onclick={() => (viewMode = "by-type")}
      class={`px-3 py-1.5 text-[0.78rem] font-medium transition-colors ${
        viewMode === "by-type"
          ? "border-b-2 border-accent-brass text-text-accent shadow-[0_8px_20px_rgba(196,154,90,0.12)]"
          : "text-text-muted hover:text-text-secondary"
      }`}
      aria-pressed={viewMode === "by-type"}
    >
      <List class="mr-1 inline h-3.5 w-3.5" />
      By Type
    </button>

    <div class="flex-1"></div>

    {#if hasManualItems && !selectMode}
      <button
        type="button"
        onclick={() => (selectMode = true)}
        class="px-2 py-1 text-[0.72rem] text-text-muted transition-colors hover:text-text-secondary"
      >
        <CheckSquare class="mr-1 inline h-3.5 w-3.5" />
        Select
      </button>
    {/if}
  </div>

  {#if selectMode}
    <div class="flex items-center justify-between border border-border-subtle bg-surface-2 px-3 py-2">
      <div class="flex items-center gap-3">
        <span class="text-[0.75rem] text-text-secondary">{selectedCount} selected</span>
        {#if selectedCount > 0}
          <Button variant="danger" size="sm" disabled={removing} onclick={removeSelectedItems}>
            {#if removing}
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
            {:else}
              <Trash2 class="h-3.5 w-3.5" />
            {/if}
            Remove from Collection
          </Button>
        {/if}
      </div>
      <button
        type="button"
        onclick={exitSelectMode}
        class="p-1 text-text-muted transition-colors hover:text-text-secondary"
        aria-label="Exit selection mode"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  {/if}

  {#if items.length === 0}
    <div class="surface-well flex flex-col items-center justify-center py-16 text-center">
      <FolderOpen class="mb-3 h-10 w-10 text-text-disabled" />
      <p class="text-sm text-text-muted">
        {c.mode === "manual"
          ? "This collection is empty. Add items from video, gallery, image, or audio pages."
          : "No items match the current rules. Try refreshing the dynamic rules."}
      </p>
    </div>
  {:else if viewMode === "mixed"}
    <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each items as item (item.id)}
        <CollectionItemCard
          {item}
          selectable={selectMode}
          selected={selectedItemIds.includes(item.id)}
          onSelect={toggleSelection}
          from={currentPath}
        />
      {/each}
    </div>
  {:else}
    <div class="space-y-6">
      {#each typeOrder as type (type)}
        {@const typeItems = itemsByType[type]}
        {#if typeItems.length > 0}
          {@const Icon = typeIcons[type]}
          <section>
            <h2 class="mb-3 flex items-center gap-2 text-sm font-heading font-medium text-text-secondary">
              <Icon class="h-4 w-4 text-text-muted" />
              {typeLabels[type]}
              <span class="font-mono text-[0.7rem] text-text-disabled">{typeItems.length}</span>
            </h2>
            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {#each typeItems as item (item.id)}
                <CollectionItemCard
                  {item}
                  selectable={selectMode}
                  selected={selectedItemIds.includes(item.id)}
                  onSelect={toggleSelection}
                  from={currentPath}
                />
              {/each}
            </div>
          </section>
        {/if}
      {/each}
    </div>
  {/if}
</div>
