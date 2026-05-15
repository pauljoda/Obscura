<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { ArrowLeft, Users, Layers } from "@lucide/svelte";
  import {
    fetchV2Gallery,
    updateV2EntityRating,
    updateV2EntityFlags,
    type V2GalleryDetail,
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
  let gallery = $state<V2GalleryDetail | null>(null);
  let errorMessage: string | null = $state(null);
  let ratingBusy = $state(false);

  const card = $derived.by((): EntityDetailCardFull | null => {
    if (!gallery) return null;
    return entityCardToDetailCard(gallery);
  });

  const studio = $derived.by(() => {
    if (!gallery) return null;
    const cap = getCapability(gallery.capabilities, "studio");
    return cap?.value ?? null;
  });

  const credits = $derived.by(() => {
    if (!gallery) return [];
    const cap = getCapability(gallery.capabilities, "credits");
    return cap?.people ?? [];
  });

  const dates = $derived.by(() => {
    if (!gallery) return [];
    const cap = getCapability(gallery.capabilities, "dates");
    return cap?.items ?? [];
  });

  const childCards = $derived.by((): EntityThumbnailCard[] => {
    if (!gallery) return [];
    return gallery.children.map((child) => {
      const href = child.kind === "gallery"
        ? resolveEntityHref("gallery", child.id)
        : resolveEntityHref(child.kind, child.id);
      return entityCardToThumbnailCard(child, href);
    });
  });

  const imageChildren = $derived(childCards.filter((c) => c.entity.kind === "image"));
  const galleryChildren = $derived(childCards.filter((c) => c.entity.kind === "gallery"));

  onMount(() => {
    void loadGallery();
  });

  async function loadGallery() {
    loadState = "loading";
    errorMessage = null;
    try {
      gallery = await fetchV2Gallery(page.params.id ?? "");
      loadState = "ready";
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      loadState = "error";
    }
  }

  async function handleRatingChange(value: number | null) {
    if (!gallery || ratingBusy) return;
    const previous = gallery;
    ratingBusy = true;
    gallery = { ...gallery, capabilities: withRatingCapability(gallery.capabilities, value) };
    try {
      await updateV2EntityRating(gallery.id, value);
    } catch {
      gallery = previous;
    } finally {
      ratingBusy = false;
    }
  }

  async function handleFavoriteToggle() {
    if (!gallery) return;
    const previous = gallery;
    const flagsCap = getCapability(gallery.capabilities, "flags");
    const next = !(flagsCap?.isFavorite ?? false);
    gallery = { ...gallery, capabilities: withFlagCapability(gallery.capabilities, "isFavorite", next) };
    try {
      await updateV2EntityFlags(gallery.id, { isFavorite: next });
    } catch {
      gallery = previous;
    }
  }

  async function handleOrganizedToggle() {
    if (!gallery) return;
    const previous = gallery;
    const flagsCap = getCapability(gallery.capabilities, "flags");
    const next = !(flagsCap?.isOrganized ?? false);
    gallery = { ...gallery, capabilities: withFlagCapability(gallery.capabilities, "isOrganized", next) };
    try {
      await updateV2EntityFlags(gallery.id, { isOrganized: next });
    } catch {
      gallery = previous;
    }
  }
</script>

<svelte:head>
  <title>{gallery?.title ?? "Gallery"} · Obscura</title>
</svelte:head>

<div class="detail-page">
  <a href="/galleries" class="back-link">
    <ArrowLeft class="h-4 w-4" />
    Galleries
  </a>

  {#if loadState === "loading"}
    <div class="loading-shell" aria-busy="true"></div>
  {:else if loadState === "error"}
    <div class="error-notice">
      <p>{errorMessage ?? "Failed to load gallery."}</p>
      <button type="button" onclick={() => void loadGallery()}>Retry</button>
    </div>
  {:else if card && gallery}
    <EntityDetail
      {card}
      onRatingChange={handleRatingChange}
      onFavoriteToggle={handleFavoriteToggle}
      onOrganizedToggle={handleOrganizedToggle}
      {ratingBusy}
      posterSize="large"
    >
      {#snippet heroMeta()}
        {#if studio}
          <a href={resolveEntityHref("studio", studio.id)} class="meta-item is-studio">{studio.title}</a>
        {/if}
        {#if gallery?.galleryType}
          {#if studio}<span class="meta-sep"></span>{/if}
          <span class="meta-item">{gallery.galleryType}</span>
        {/if}
        {#each dates as date, i (date.code)}
          <span class="meta-sep"></span>
          <span class="meta-item">{date.value}</span>
        {/each}
        {#if childCards.length > 0}
          <span class="meta-sep"></span>
          <span class="meta-item">{childCards.length} {childCards.length === 1 ? "item" : "items"}</span>
        {/if}
      {/snippet}

      {#snippet heroBadges()}
        {#if gallery?.galleryType}
          <span class="type-badge">{gallery.galleryType}</span>
        {/if}
      {/snippet}

      {#snippet afterBody()}
        {#if credits.length > 0}
          <div class="credits-section">
            <h2 class="section-label">
              <Users class="h-4 w-4" />
              Cast
            </h2>
            <div class="credits-grid">
              {#each credits as person (person.id)}
                <a href={resolveEntityHref("person", person.id)} class="credit-chip">
                  {person.title}
                </a>
              {/each}
            </div>
          </div>
        {/if}
      {/snippet}
    </EntityDetail>

    {#if galleryChildren.length > 0}
      <section class="content-section">
        <h2 class="content-heading">
          <Layers class="h-4 w-4" />
          Sub-Galleries
          <span class="content-count">{galleryChildren.length}</span>
        </h2>
        <EntityGrid
          cards={galleryChildren}
          prefsKey={`gallery-${gallery?.id}-children`}
          selectable={false}
          emptyTitle="No sub-galleries"
          emptyMessage="This gallery has no sub-galleries."
        />
      </section>
    {/if}

    {#if imageChildren.length > 0}
      <section class="content-section">
        <h2 class="content-heading">
          Images
          <span class="content-count">{imageChildren.length}</span>
        </h2>
        <EntityGrid
          cards={imageChildren}
          prefsKey={`gallery-${gallery?.id}-images`}
          selectable={false}
          emptyTitle="No images"
          emptyMessage="This gallery has no images."
        />
      </section>
    {/if}

    {#if childCards.length === 0}
      <div class="empty-children">
        <p>No images or sub-galleries in this gallery yet.</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .detail-page {
    display: grid;
    gap: 1.25rem;
    padding: clamp(1rem, 3vw, 2rem);
    max-width: 72rem;
    margin: 0 auto;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.78rem;
    text-decoration: none;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    transition: color 0.15s;
  }

  .back-link:hover {
    color: var(--color-text-primary, #f2eed8);
  }

  .loading-shell {
    min-height: 28rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .error-notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid color-mix(in srgb, #ef4444 50%, var(--color-border, #1c2235));
    background: var(--color-surface-2, #101420);
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.85rem;
  }

  .error-notice button {
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-3, #151a28);
    color: var(--color-text-muted, #8a93a6);
    padding: 0.4rem 0.8rem;
    font-size: 0.78rem;
    cursor: pointer;
  }

  :global(.meta-item) { white-space: nowrap; font-size: 0.82rem; }
  :global(.meta-item.is-studio) { color: var(--color-text-accent, #c49a5a); text-decoration: none; transition: opacity 0.15s; }
  :global(.meta-item.is-studio:hover) { opacity: 0.8; }
  :global(.meta-sep) { display: inline-block; width: 3px; height: 3px; margin: 0 0.5rem; background: var(--color-text-muted, #8a93a6); opacity: 0.5; }

  .type-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.15rem 0.5rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-accent, #c49a5a);
    border: 1px solid rgba(196, 154, 90, 0.35);
    background: rgba(196, 154, 90, 0.08);
  }

  .credits-section { padding: 1rem 1.5rem; border-top: 1px solid var(--color-border, #1c2235); }
  .section-label { display: flex; align-items: center; gap: 0.45rem; margin: 0 0 0.75rem; font-family: var(--font-mono, "JetBrains Mono", monospace); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-muted, #8a93a6); }
  .credits-grid { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .credit-chip { padding: 0.22rem 0.55rem; font-size: 0.75rem; color: var(--color-text-secondary, #c4c9d4); border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-3, #151a28); text-decoration: none; transition: border-color 0.15s, color 0.15s; }
  .credit-chip:hover { color: var(--color-text-accent, #c49a5a); border-color: rgba(196, 154, 90, 0.35); }

  .content-section { display: grid; gap: 0.75rem; }
  .content-heading { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-family: var(--font-heading, Geist, sans-serif); font-size: 1.1rem; font-weight: 600; color: var(--color-text-primary, #f2eed8); }
  .content-count { font-family: var(--font-mono, "JetBrains Mono", monospace); font-size: 0.68rem; font-weight: 600; color: var(--color-text-muted, #8a93a6); padding: 0.1rem 0.4rem; border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-3, #151a28); }

  .empty-children { padding: 2rem; border: 1px solid var(--color-border-subtle, #1c2235); background: var(--color-surface-1, #0c0f15); color: var(--color-text-muted, #8a93a6); text-align: center; font-size: 0.85rem; }

  @media (min-width: 640px) { .credits-section { padding: 1rem 2rem; } }
  @keyframes pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.85; } }
</style>
