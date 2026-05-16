<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { ArrowLeft, Users, Building2, Calendar } from "@lucide/svelte";
  import {
    fetchV2Series,
    updateV2EntityRating,
    updateV2EntityFlags,
    type V2VideoSeriesDetail,
  } from "$lib/api/v2";
  import {
    getCapability,
    withFlagCapability,
    withRatingCapability,
  } from "$lib/api/capabilities";
  import { entityCardToDetailCard, type EntityDetailCardFull } from "$lib/entities/entity-detail";
  import { entityCardToThumbnailCard } from "$lib/entities/entity-grid";
  import type { EntityThumbnailCard } from "$lib/entities/entity-thumbnail";
  import EntityDetail from "$lib/components/entities/EntityDetail.svelte";
  import EntityGrid from "$lib/components/entities/EntityGrid.svelte";
  import EntityThumbnail from "$lib/components/thumbnails/EntityThumbnail.svelte";

  type LoadState = "loading" | "ready" | "error";

  let loadState: LoadState = $state("loading");
  let series = $state<V2VideoSeriesDetail | null>(null);
  let errorMessage: string | null = $state(null);
  let ratingBusy = $state(false);

  const card = $derived.by((): EntityDetailCardFull | null => {
    if (!series) return null;
    return entityCardToDetailCard(series);
  });

  const studio = $derived.by(() => {
    if (!series) return null;
    const cap = getCapability(series.capabilities, "studio");
    return cap?.value ?? null;
  });

  const credits = $derived.by(() => {
    if (!series) return [];
    const cap = getCapability(series.capabilities, "credits");
    return cap?.people ?? [];
  });

  const dates = $derived.by(() => {
    if (!series) return [];
    const cap = getCapability(series.capabilities, "dates");
    return cap?.items ?? [];
  });

  const seasonCards = $derived.by((): EntityThumbnailCard[] => {
    if (!series) return [];
    return series.children
      .filter((child) => child.kind === "video-season")
      .map((child) => entityCardToThumbnailCard(child, `/series/${series!.id}/seasons/${child.id}`));
  });

  const childSeriesCards = $derived.by((): EntityThumbnailCard[] => {
    if (!series) return [];
    return series.children
      .filter((child) => child.kind === "video-series")
      .map((child) => entityCardToThumbnailCard(child, `/series/${child.id}`));
  });

  const videoCards = $derived.by((): EntityThumbnailCard[] => {
    if (!series) return [];
    return series.videos.map((video) => entityCardToThumbnailCard(video, `/videos/${video.id}`));
  });

  const hasSeasons = $derived(seasonCards.length > 0);
  const hasChildSeries = $derived(childSeriesCards.length > 0);
  const hasVideos = $derived(videoCards.length > 0);
  const totalChildren = $derived(seasonCards.length + childSeriesCards.length + videoCards.length);

  onMount(() => {
    void loadSeries();
  });

  async function loadSeries() {
    loadState = "loading";
    errorMessage = null;
    try {
      series = await fetchV2Series(page.params.id ?? "");
      loadState = "ready";
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      loadState = "error";
    }
  }

  async function handleRatingChange(value: number | null) {
    if (!series || ratingBusy) return;
    const previous = series;
    ratingBusy = true;
    series = { ...series, capabilities: withRatingCapability(series.capabilities, value) };
    try {
      await updateV2EntityRating(series.id, value);
    } catch {
      series = previous;
    } finally {
      ratingBusy = false;
    }
  }

  async function handleFavoriteToggle() {
    if (!series) return;
    const previous = series;
    const flagsCap = getCapability(series.capabilities, "flags");
    const next = !(flagsCap?.isFavorite ?? false);
    series = { ...series, capabilities: withFlagCapability(series.capabilities, "isFavorite", next) };
    try {
      await updateV2EntityFlags(series.id, { isFavorite: next });
    } catch {
      series = previous;
    }
  }

  async function handleOrganizedToggle() {
    if (!series) return;
    const previous = series;
    const flagsCap = getCapability(series.capabilities, "flags");
    const next = !(flagsCap?.isOrganized ?? false);
    series = { ...series, capabilities: withFlagCapability(series.capabilities, "isOrganized", next) };
    try {
      await updateV2EntityFlags(series.id, { isOrganized: next });
    } catch {
      series = previous;
    }
  }
</script>

<svelte:head>
  <title>{series?.title ?? "Series"} · Obscura</title>
</svelte:head>

<div class="series-page">
  <a href="/series" class="back-link">
    <ArrowLeft class="h-4 w-4" />
    Series
  </a>

  {#if loadState === "loading"}
    <div class="loading-shell" aria-busy="true"></div>
  {:else if loadState === "error"}
    <div class="error-notice">
      <p>{errorMessage ?? "Failed to load series."}</p>
      <button type="button" onclick={() => void loadSeries()}>Retry</button>
    </div>
  {:else if card && series}
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
          <span class="meta-item is-studio">{studio.title}</span>
        {/if}
        {#if studio && dates.length > 0}
          <span class="meta-sep"></span>
        {/if}
        {#each dates as date, i (date.code)}
          {#if i > 0}
            <span class="meta-sep"></span>
          {/if}
          <span class="meta-item">{date.value}</span>
        {/each}
        {#if (studio || dates.length > 0) && totalChildren > 0}
          <span class="meta-sep"></span>
        {/if}
        {#if totalChildren > 0}
          <span class="meta-item">{totalChildren} {totalChildren === 1 ? "item" : "items"}</span>
        {/if}
      {/snippet}

      {#snippet heroBadges()}
        {#if series?.renderingMode}
          <span class="position-badge">{series.renderingMode}</span>
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
                <a href={`/performers/${person.id}`} class="credit-chip">
                  {person.title}
                </a>
              {/each}
            </div>
          </div>
        {/if}
      {/snippet}
    </EntityDetail>

    {#if hasSeasons}
      <section class="content-section">
        <h2 class="content-heading">
          <Calendar class="h-4 w-4" />
          Seasons
          <span class="content-count">{seasonCards.length}</span>
        </h2>
        <div class="season-row" aria-label="Seasons">
          {#each seasonCards as seasonCard (seasonCard.entity.id)}
            <div class="season-card">
              <EntityThumbnail card={seasonCard} selectable={false} />
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if hasChildSeries}
      <section class="content-section">
        <h2 class="content-heading">
          <Building2 class="h-4 w-4" />
          Sub-Series
          <span class="content-count">{childSeriesCards.length}</span>
        </h2>
        <EntityGrid
          cards={childSeriesCards}
          prefsKey={`series-${series?.id}-children`}
          selectable={false}
          emptyTitle="No sub-series"
          emptyMessage="This series has no sub-series."
        />
      </section>
    {/if}

    {#if hasVideos}
      <section class="content-section">
        <h2 class="content-heading">
          {hasSeasons ? "Specials" : "Episodes"}
          <span class="content-count">{videoCards.length}</span>
        </h2>
        <EntityGrid
          cards={videoCards}
          prefsKey={`series-${series?.id}-videos`}
          initialSortBy="position"
          selectable={false}
          emptyTitle={hasSeasons ? "No specials" : "No episodes"}
          emptyMessage="No loose videos in this series."
        />
      </section>
    {/if}

    {#if !hasSeasons && !hasChildSeries && !hasVideos}
      <div class="empty-children">
        <p>No seasons, episodes, or sub-series linked to this series yet.</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .series-page {
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

  /* ── Hero meta items (used inside EntityDetail snippets) ── */

  :global(.meta-item) {
    white-space: nowrap;
    font-size: 0.82rem;
  }

  :global(.meta-item.is-studio) {
    color: var(--color-text-accent, #c49a5a);
  }

  :global(.meta-sep) {
    display: inline-block;
    width: 3px;
    height: 3px;
    margin: 0 0.5rem;
    background: var(--color-text-muted, #8a93a6);
    opacity: 0.5;
  }

  .position-badge {
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

  /* ── Credits section (inside afterBody) ── */

  .credits-section {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border, #1c2235);
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0 0 0.75rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted, #8a93a6);
  }

  .credits-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .credit-chip {
    padding: 0.22rem 0.55rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary, #c4c9d4);
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-3, #151a28);
    text-decoration: none;
    transition: border-color 0.15s, color 0.15s;
  }

  .credit-chip:hover {
    color: var(--color-text-accent, #c49a5a);
    border-color: rgba(196, 154, 90, 0.35);
  }

  /* ── Content sections (seasons, episodes, sub-series) ── */

  .content-section {
    display: grid;
    gap: 0.75rem;
  }

  .season-row {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(8.5rem, 11rem);
    gap: 0.75rem;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    padding-bottom: 0.35rem;
    scrollbar-width: thin;
  }

  .season-card {
    min-width: 0;
  }

  .content-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-family: var(--font-heading, Geist, sans-serif);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text-primary, #f2eed8);
  }

  .content-count {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-text-muted, #8a93a6);
    padding: 0.1rem 0.4rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-3, #151a28);
  }

  .empty-children {
    padding: 2rem;
    border: 1px solid var(--color-border-subtle, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-muted, #8a93a6);
    text-align: center;
    font-size: 0.85rem;
  }

  @media (min-width: 640px) {
    .credits-section {
      padding: 1rem 2rem;
    }
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 0.85; }
  }
</style>
