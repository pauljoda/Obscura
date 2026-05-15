<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { ArrowLeft, Layers } from "@lucide/svelte";
  import {
    fetchV2Collection,
    updateV2EntityRating,
    updateV2EntityFlags,
    type V2CollectionDetail,
  } from "$lib/api/v2";
  import {
    getCapability,
    withFlagCapability,
    withRatingCapability,
  } from "$lib/api/capabilities";
  import { entityCardToDetailCard, type EntityDetailCardFull } from "$lib/entities/entity-detail";
  import { entityCardToThumbnailCard } from "$lib/entities/entity-grid";
  import { resolveEntityHref } from "$lib/entities/entity-routes";
  import type { EntityThumbnailCard } from "$lib/entities/entity-thumbnail";
  import EntityDetail from "$lib/components/entities/EntityDetail.svelte";
  import EntityGrid from "$lib/components/entities/EntityGrid.svelte";

  type LoadState = "loading" | "ready" | "error";

  let loadState: LoadState = $state("loading");
  let collection = $state<V2CollectionDetail | null>(null);
  let errorMessage: string | null = $state(null);
  let ratingBusy = $state(false);

  const card = $derived.by((): EntityDetailCardFull | null => {
    if (!collection) return null;
    return entityCardToDetailCard(collection);
  });

  const itemCards = $derived.by((): EntityThumbnailCard[] => {
    if (!collection) return [];
    return collection.items.map((item) =>
      entityCardToThumbnailCard(item, resolveEntityHref(item.kind, item.id)),
    );
  });

  onMount(() => {
    void loadCollection();
  });

  async function loadCollection() {
    loadState = "loading";
    errorMessage = null;
    try {
      collection = await fetchV2Collection(page.params.id ?? "");
      loadState = "ready";
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      loadState = "error";
    }
  }

  async function handleRatingChange(value: number | null) {
    if (!collection || ratingBusy) return;
    const previous = collection;
    ratingBusy = true;
    collection = { ...collection, capabilities: withRatingCapability(collection.capabilities, value) };
    try {
      await updateV2EntityRating(collection.id, value);
    } catch {
      collection = previous;
    } finally {
      ratingBusy = false;
    }
  }

  async function handleFavoriteToggle() {
    if (!collection) return;
    const previous = collection;
    const flagsCap = getCapability(collection.capabilities, "flags");
    const next = !(flagsCap?.isFavorite ?? false);
    collection = { ...collection, capabilities: withFlagCapability(collection.capabilities, "isFavorite", next) };
    try {
      await updateV2EntityFlags(collection.id, { isFavorite: next });
    } catch {
      collection = previous;
    }
  }

  async function handleOrganizedToggle() {
    if (!collection) return;
    const previous = collection;
    const flagsCap = getCapability(collection.capabilities, "flags");
    const next = !(flagsCap?.isOrganized ?? false);
    collection = { ...collection, capabilities: withFlagCapability(collection.capabilities, "isOrganized", next) };
    try {
      await updateV2EntityFlags(collection.id, { isOrganized: next });
    } catch {
      collection = previous;
    }
  }
</script>

<svelte:head>
  <title>{collection?.title ?? "Collection"} · Obscura</title>
</svelte:head>

<div class="detail-page">
  <a href="/collections" class="back-link">
    <ArrowLeft class="h-4 w-4" />
    Collections
  </a>

  {#if loadState === "loading"}
    <div class="loading-shell" aria-busy="true"></div>
  {:else if loadState === "error"}
    <div class="error-notice">
      <p>{errorMessage ?? "Failed to load collection."}</p>
      <button type="button" onclick={() => void loadCollection()}>Retry</button>
    </div>
  {:else if card && collection}
    <EntityDetail
      {card}
      onRatingChange={handleRatingChange}
      onFavoriteToggle={handleFavoriteToggle}
      onOrganizedToggle={handleOrganizedToggle}
      {ratingBusy}
      posterSize="large"
    >
      {#snippet heroMeta()}
        {#if collection?.mode}
          <span class="meta-item">{collection.mode}</span>
        {/if}
        {#if itemCards.length > 0}
          {#if collection?.mode}<span class="meta-sep"></span>{/if}
          <span class="meta-item">{itemCards.length} {itemCards.length === 1 ? "item" : "items"}</span>
        {/if}
      {/snippet}

      {#snippet heroBadges()}
        {#if collection?.mode}
          <span class="type-badge">{collection.mode}</span>
        {/if}
      {/snippet}
    </EntityDetail>

    {#if itemCards.length > 0}
      <section class="content-section">
        <h2 class="content-heading">
          <Layers class="h-4 w-4" />
          Items
          <span class="content-count">{itemCards.length}</span>
        </h2>
        <EntityGrid
          cards={itemCards}
          prefsKey={`collection-${collection?.id}-items`}
          selectable={false}
          emptyTitle="Empty collection"
          emptyMessage="This collection has no items."
        />
      </section>
    {:else}
      <div class="empty-children">
        <p>This collection is empty.</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .detail-page { display: grid; gap: 1.25rem; padding: clamp(1rem, 3vw, 2rem); max-width: 72rem; margin: 0 auto; }
  .back-link { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--color-text-muted, #8a93a6); font-size: 0.78rem; text-decoration: none; font-family: var(--font-mono, "JetBrains Mono", monospace); text-transform: uppercase; letter-spacing: 0.04em; transition: color 0.15s; }
  .back-link:hover { color: var(--color-text-primary, #f2eed8); }
  .loading-shell { min-height: 28rem; border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-2, #101420); animation: pulse 1.2s ease-in-out infinite; }
  .error-notice { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem; border: 1px solid color-mix(in srgb, #ef4444 50%, var(--color-border, #1c2235)); background: var(--color-surface-2, #101420); color: var(--color-text-muted, #8a93a6); font-size: 0.85rem; }
  .error-notice button { border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-3, #151a28); color: var(--color-text-muted, #8a93a6); padding: 0.4rem 0.8rem; font-size: 0.78rem; cursor: pointer; }

  :global(.meta-item) { white-space: nowrap; font-size: 0.82rem; }
  :global(.meta-sep) { display: inline-block; width: 3px; height: 3px; margin: 0 0.5rem; background: var(--color-text-muted, #8a93a6); opacity: 0.5; }

  .type-badge {
    display: inline-flex; align-items: center; padding: 0.15rem 0.5rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace); font-size: 0.68rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--color-text-accent, #c49a5a); border: 1px solid rgba(196, 154, 90, 0.35); background: rgba(196, 154, 90, 0.08);
  }

  .content-section { display: grid; gap: 0.75rem; }
  .content-heading { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-family: var(--font-heading, Geist, sans-serif); font-size: 1.1rem; font-weight: 600; color: var(--color-text-primary, #f2eed8); }
  .content-count { font-family: var(--font-mono, "JetBrains Mono", monospace); font-size: 0.68rem; font-weight: 600; color: var(--color-text-muted, #8a93a6); padding: 0.1rem 0.4rem; border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-3, #151a28); }

  .empty-children { padding: 2rem; border: 1px solid var(--color-border-subtle, #1c2235); background: var(--color-surface-1, #0c0f15); color: var(--color-text-muted, #8a93a6); text-align: center; font-size: 0.85rem; }

  @keyframes pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.85; } }
</style>
