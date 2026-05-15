<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { ArrowLeft, Film } from "@lucide/svelte";
  import {
    fetchV2Tag,
    fetchV2Entities,
    updateV2EntityRating,
    updateV2EntityFlags,
    type V2TagDetail,
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
  import type { EntityCard } from "$lib/api/generated/model";
  import EntityDetail from "$lib/components/entities/EntityDetail.svelte";
  import EntityGrid from "$lib/components/entities/EntityGrid.svelte";

  type LoadState = "loading" | "ready" | "error";

  let loadState: LoadState = $state("loading");
  let tag = $state<V2TagDetail | null>(null);
  let relatedCards = $state<EntityThumbnailCard[]>([]);
  let errorMessage: string | null = $state(null);
  let ratingBusy = $state(false);

  const card = $derived.by((): EntityDetailCardFull | null => {
    if (!tag) return null;
    return entityCardToDetailCard(tag);
  });

  onMount(() => {
    void loadTag();
  });

  async function loadTag() {
    loadState = "loading";
    errorMessage = null;
    try {
      const id = page.params.id ?? "";
      tag = await fetchV2Tag(id);
      await loadRelated(id, tag.title);
      loadState = "ready";
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      loadState = "error";
    }
  }

  async function loadRelated(tagId: string, tagTitle: string) {
    try {
      const response = await fetchV2Entities({ query: tagTitle });
      relatedCards = response.items
        .filter((item: EntityCard) => {
          const tagsCap = getCapability(item.capabilities, "tags");
          return tagsCap?.values.some((t) => t.toLowerCase() === tagTitle.toLowerCase()) ?? false;
        })
        .map((item: EntityCard) => entityCardToThumbnailCard(item, resolveEntityHref(item.kind, item.id)));
    } catch {
      relatedCards = [];
    }
  }

  async function handleRatingChange(value: number | null) {
    if (!tag || ratingBusy) return;
    const previous = tag;
    ratingBusy = true;
    tag = { ...tag, capabilities: withRatingCapability(tag.capabilities, value) };
    try {
      await updateV2EntityRating(tag.id, value);
    } catch {
      tag = previous;
    } finally {
      ratingBusy = false;
    }
  }

  async function handleFavoriteToggle() {
    if (!tag) return;
    const previous = tag;
    const flagsCap = getCapability(tag.capabilities, "flags");
    const next = !(flagsCap?.isFavorite ?? false);
    tag = { ...tag, capabilities: withFlagCapability(tag.capabilities, "isFavorite", next) };
    try {
      await updateV2EntityFlags(tag.id, { isFavorite: next });
    } catch {
      tag = previous;
    }
  }

  async function handleOrganizedToggle() {
    if (!tag) return;
    const previous = tag;
    const flagsCap = getCapability(tag.capabilities, "flags");
    const next = !(flagsCap?.isOrganized ?? false);
    tag = { ...tag, capabilities: withFlagCapability(tag.capabilities, "isOrganized", next) };
    try {
      await updateV2EntityFlags(tag.id, { isOrganized: next });
    } catch {
      tag = previous;
    }
  }
</script>

<svelte:head>
  <title>{tag?.title ?? "Tag"} · Obscura</title>
</svelte:head>

<div class="detail-page">
  <a href="/tags" class="back-link">
    <ArrowLeft class="h-4 w-4" />
    Tags
  </a>

  {#if loadState === "loading"}
    <div class="loading-shell" aria-busy="true"></div>
  {:else if loadState === "error"}
    <div class="error-notice">
      <p>{errorMessage ?? "Failed to load tag."}</p>
      <button type="button" onclick={() => void loadTag()}>Retry</button>
    </div>
  {:else if card && tag}
    <EntityDetail
      {card}
      onRatingChange={handleRatingChange}
      onFavoriteToggle={handleFavoriteToggle}
      onOrganizedToggle={handleOrganizedToggle}
      {ratingBusy}
      posterSize="large"
    >
      {#snippet heroMeta()}
        {#if relatedCards.length > 0}
          <span class="meta-item">{relatedCards.length} {relatedCards.length === 1 ? "item" : "items"}</span>
        {/if}
        {#if tag?.ignoreAutoTag}
          {#if relatedCards.length > 0}<span class="meta-sep"></span>{/if}
          <span class="meta-item is-muted">Auto-tag ignored</span>
        {/if}
      {/snippet}
    </EntityDetail>

    {#if relatedCards.length > 0}
      <section class="content-section">
        <h2 class="content-heading">
          <Film class="h-4 w-4" />
          Tagged Content
          <span class="content-count">{relatedCards.length}</span>
        </h2>
        <EntityGrid
          cards={relatedCards}
          prefsKey={`tag-${tag?.id}-content`}
          selectable={false}
          emptyTitle="No content"
          emptyMessage="No content tagged with this tag."
        />
      </section>
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
  :global(.meta-item.is-muted) { color: var(--color-text-muted, #8a93a6); opacity: 0.7; font-style: italic; }
  :global(.meta-sep) { display: inline-block; width: 3px; height: 3px; margin: 0 0.5rem; background: var(--color-text-muted, #8a93a6); opacity: 0.5; }

  .content-section { display: grid; gap: 0.75rem; }
  .content-heading { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-family: var(--font-heading, Geist, sans-serif); font-size: 1.1rem; font-weight: 600; color: var(--color-text-primary, #f2eed8); }
  .content-count { font-family: var(--font-mono, "JetBrains Mono", monospace); font-size: 0.68rem; font-weight: 600; color: var(--color-text-muted, #8a93a6); padding: 0.1rem 0.4rem; border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-3, #151a28); }

  @keyframes pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.85; } }
</style>
