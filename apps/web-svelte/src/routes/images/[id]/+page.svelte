<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { ArrowLeft, Users } from "@lucide/svelte";
  import {
    fetchV2Image,
    updateV2EntityRating,
    updateV2EntityFlags,
    type V2ImageDetail,
  } from "$lib/api/v2";
  import {
    getCapability,
    getImagesCapability,
    withFlagCapability,
    withRatingCapability,
  } from "$lib/api/capabilities";
  import { entityCardToDetailCard, type EntityDetailCardFull } from "$lib/entities/entity-detail";
  import { resolveEntityHref } from "$lib/entities/entity-routes";
  import EntityDetail from "$lib/components/entities/EntityDetail.svelte";

  type LoadState = "loading" | "ready" | "error";

  let loadState: LoadState = $state("loading");
  let image = $state<V2ImageDetail | null>(null);
  let errorMessage: string | null = $state(null);
  let ratingBusy = $state(false);

  const card = $derived.by((): EntityDetailCardFull | null => {
    if (!image) return null;
    return entityCardToDetailCard(image);
  });

  const fullSrc = $derived.by(() => {
    if (!image) return null;
    const images = getImagesCapability(image.capabilities);
    if (!images) return null;
    const full = images.items.find((i) => i.kind === "original" || i.kind === "full");
    return full?.path ?? images.coverUrl ?? images.thumbnailUrl ?? null;
  });

  const studio = $derived.by((): { id: string; title: string } | null => null);

  const credits = $derived.by((): Array<{ id: string; title: string }> => []);

  const dates = $derived.by(() => {
    if (!image) return [];
    const cap = getCapability(image.capabilities, "dates");
    return cap?.items ?? [];
  });

  onMount(() => {
    void loadImage();
  });

  async function loadImage() {
    loadState = "loading";
    errorMessage = null;
    try {
      image = await fetchV2Image(page.params.id ?? "");
      loadState = "ready";
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      loadState = "error";
    }
  }

  async function handleRatingChange(value: number | null) {
    if (!image || ratingBusy) return;
    const previous = image;
    ratingBusy = true;
    image = { ...image, capabilities: withRatingCapability(image.capabilities, value) };
    try {
      await updateV2EntityRating(image.id, value);
    } catch {
      image = previous;
    } finally {
      ratingBusy = false;
    }
  }

  async function handleFavoriteToggle() {
    if (!image) return;
    const previous = image;
    const flagsCap = getCapability(image.capabilities, "flags");
    const next = !(flagsCap?.isFavorite ?? false);
    image = { ...image, capabilities: withFlagCapability(image.capabilities, "isFavorite", next) };
    try {
      await updateV2EntityFlags(image.id, { isFavorite: next });
    } catch {
      image = previous;
    }
  }

  async function handleOrganizedToggle() {
    if (!image) return;
    const previous = image;
    const flagsCap = getCapability(image.capabilities, "flags");
    const next = !(flagsCap?.isOrganized ?? false);
    image = { ...image, capabilities: withFlagCapability(image.capabilities, "isOrganized", next) };
    try {
      await updateV2EntityFlags(image.id, { isOrganized: next });
    } catch {
      image = previous;
    }
  }
</script>

<svelte:head>
  <title>{image?.title ?? "Image"} · Obscura</title>
</svelte:head>

<div class="detail-page">
  <a href="/images" class="back-link">
    <ArrowLeft class="h-4 w-4" />
    Images
  </a>

  {#if loadState === "loading"}
    <div class="loading-shell" aria-busy="true"></div>
  {:else if loadState === "error"}
    <div class="error-notice">
      <p>{errorMessage ?? "Failed to load image."}</p>
      <button type="button" onclick={() => void loadImage()}>Retry</button>
    </div>
  {:else if card && image}
    {#if fullSrc}
      <div class="image-surface">
        <img src={fullSrc} alt={image.title} />
      </div>
    {/if}

    <EntityDetail
      {card}
      onRatingChange={handleRatingChange}
      onFavoriteToggle={handleFavoriteToggle}
      onOrganizedToggle={handleOrganizedToggle}
      {ratingBusy}
      showHero={false}
    >
      {#snippet heroMeta()}
        {#if studio}
          <a href={resolveEntityHref("studio", studio.id)} class="meta-item is-studio">{studio.title}</a>
        {/if}
        {#each dates as date, i (date.code)}
          {#if studio || i > 0}
            <span class="meta-sep"></span>
          {/if}
          <span class="meta-item">{date.value}</span>
        {/each}
      {/snippet}

      {#snippet afterBody()}
        {#if credits.length > 0}
          <div class="credits-section">
            <h2 class="section-label">
              <Users class="h-4 w-4" />
              Performers
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
  {/if}
</div>

<style>
  .detail-page { display: grid; gap: 1.25rem; padding: clamp(1rem, 3vw, 2rem); max-width: 72rem; margin: 0 auto; }
  .back-link { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--color-text-muted, #8a93a6); font-size: 0.78rem; text-decoration: none; font-family: var(--font-mono, "JetBrains Mono", monospace); text-transform: uppercase; letter-spacing: 0.04em; transition: color 0.15s; }
  .back-link:hover { color: var(--color-text-primary, #f2eed8); }
  .loading-shell { min-height: 28rem; border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-2, #101420); animation: pulse 1.2s ease-in-out infinite; }
  .error-notice { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem; border: 1px solid color-mix(in srgb, #ef4444 50%, var(--color-border, #1c2235)); background: var(--color-surface-2, #101420); color: var(--color-text-muted, #8a93a6); font-size: 0.85rem; }
  .error-notice button { border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-3, #151a28); color: var(--color-text-muted, #8a93a6); padding: 0.4rem 0.8rem; font-size: 0.78rem; cursor: pointer; }

  .image-surface { background: #050508; border: 1px solid var(--color-border, #1c2235); display: flex; justify-content: center; align-items: center; }
  .image-surface img { display: block; max-width: 100%; max-height: 80vh; object-fit: contain; }

  :global(.meta-item) { white-space: nowrap; font-size: 0.82rem; }
  :global(.meta-item.is-studio) { color: var(--color-text-accent, #c49a5a); text-decoration: none; transition: opacity 0.15s; }
  :global(.meta-item.is-studio:hover) { opacity: 0.8; }
  :global(.meta-sep) { display: inline-block; width: 3px; height: 3px; margin: 0 0.5rem; background: var(--color-text-muted, #8a93a6); opacity: 0.5; }

  .credits-section { padding: 1rem 1.5rem; border-top: 1px solid var(--color-border, #1c2235); }
  .section-label { display: flex; align-items: center; gap: 0.45rem; margin: 0 0 0.75rem; font-family: var(--font-mono, "JetBrains Mono", monospace); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-muted, #8a93a6); }
  .credits-grid { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .credit-chip { padding: 0.22rem 0.55rem; font-size: 0.75rem; color: var(--color-text-secondary, #c4c9d4); border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-3, #151a28); text-decoration: none; transition: border-color 0.15s, color 0.15s; }
  .credit-chip:hover { color: var(--color-text-accent, #c49a5a); border-color: rgba(196, 154, 90, 0.35); }

  @media (min-width: 640px) { .credits-section { padding: 1rem 2rem; } }
  @keyframes pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.85; } }
</style>
