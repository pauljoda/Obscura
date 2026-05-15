<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { ArrowLeft, Users, BookOpen } from "@lucide/svelte";
  import {
    fetchV2Book,
    updateV2EntityRating,
    updateV2EntityFlags,
    type V2BookDetail,
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
  let book = $state<V2BookDetail | null>(null);
  let errorMessage: string | null = $state(null);
  let ratingBusy = $state(false);

  const bookId = $derived(page.params.id ?? "");

  const card = $derived.by((): EntityDetailCardFull | null => {
    if (!book) return null;
    return entityCardToDetailCard(book);
  });

  const studio = $derived.by(() => {
    if (!book) return null;
    const cap = getCapability(book.capabilities, "studio");
    return cap?.value ?? null;
  });

  const credits = $derived.by(() => {
    if (!book) return [];
    const cap = getCapability(book.capabilities, "credits");
    return cap?.people ?? [];
  });

  const dates = $derived.by(() => {
    if (!book) return [];
    const cap = getCapability(book.capabilities, "dates");
    return cap?.items ?? [];
  });

  const progress = $derived.by(() => {
    if (!book) return null;
    const cap = getCapability(book.capabilities, "progress");
    if (!cap) return null;
    const index = typeof cap.index === "number" ? cap.index : Number(cap.index ?? 0);
    const total = typeof cap.total === "number" ? cap.total : Number(cap.total ?? 0);
    return { index, total, percent: total > 0 ? Math.round((index / total) * 100) : 0 };
  });

  onMount(() => {
    void loadBook();
  });

  async function loadBook() {
    loadState = "loading";
    errorMessage = null;
    try {
      book = await fetchV2Book(bookId);
      loadState = "ready";
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      loadState = "error";
    }
  }

  async function handleRatingChange(value: number | null) {
    if (!book || ratingBusy) return;
    const previous = book;
    ratingBusy = true;
    book = { ...book, capabilities: withRatingCapability(book.capabilities, value) };
    try {
      await updateV2EntityRating(book.id, value);
    } catch {
      book = previous;
    } finally {
      ratingBusy = false;
    }
  }

  async function handleFavoriteToggle() {
    if (!book) return;
    const previous = book;
    const flagsCap = getCapability(book.capabilities, "flags");
    const next = !(flagsCap?.isFavorite ?? false);
    book = { ...book, capabilities: withFlagCapability(book.capabilities, "isFavorite", next) };
    try {
      await updateV2EntityFlags(book.id, { isFavorite: next });
    } catch {
      book = previous;
    }
  }

  async function handleOrganizedToggle() {
    if (!book) return;
    const previous = book;
    const flagsCap = getCapability(book.capabilities, "flags");
    const next = !(flagsCap?.isOrganized ?? false);
    book = { ...book, capabilities: withFlagCapability(book.capabilities, "isOrganized", next) };
    try {
      await updateV2EntityFlags(book.id, { isOrganized: next });
    } catch {
      book = previous;
    }
  }
</script>

<svelte:head>
  <title>{book?.title ?? "Book"} · Obscura</title>
</svelte:head>

<div class="detail-page">
  <a href="/v2/books" class="back-link">
    <ArrowLeft class="h-4 w-4" />
    Books
  </a>

  {#if loadState === "loading"}
    <div class="loading-shell" aria-busy="true"></div>
  {:else if loadState === "error"}
    <div class="error-notice">
      <p>{errorMessage ?? "Failed to load book."}</p>
      <button type="button" onclick={() => void loadBook()}>Retry</button>
    </div>
  {:else if card && book}
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
        {#if book?.bookType}
          {#if studio}<span class="meta-sep"></span>{/if}
          <span class="meta-item">{book.bookType}</span>
        {/if}
        {#each dates as date, i (date.code)}
          <span class="meta-sep"></span>
          <span class="meta-item">{date.value}</span>
        {/each}
      {/snippet}

      {#snippet heroBadges()}
        {#if book?.bookType}
          <span class="type-badge">{book.bookType}</span>
        {/if}
        {#if progress}
          <span class="progress-badge">{progress.percent}%</span>
        {/if}
      {/snippet}

      {#snippet afterBody()}
        {#if credits.length > 0}
          <div class="credits-section">
            <h2 class="section-label">
              <Users class="h-4 w-4" />
              Creators
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

        {#if progress}
          <div class="progress-section">
            <h2 class="section-label">
              <BookOpen class="h-4 w-4" />
              Reading Progress
            </h2>
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: {progress.percent}%"></div>
            </div>
            <span class="progress-label">{progress.index} / {progress.total} pages · {progress.percent}%</span>
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

  :global(.meta-item) { white-space: nowrap; font-size: 0.82rem; }
  :global(.meta-item.is-studio) { color: var(--color-text-accent, #c49a5a); text-decoration: none; transition: opacity 0.15s; }
  :global(.meta-item.is-studio:hover) { opacity: 0.8; }
  :global(.meta-sep) { display: inline-block; width: 3px; height: 3px; margin: 0 0.5rem; background: var(--color-text-muted, #8a93a6); opacity: 0.5; }

  .type-badge, .progress-badge {
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

  .progress-section { padding: 1rem 1.5rem; border-top: 1px solid var(--color-border, #1c2235); }
  .progress-bar-container { height: 4px; background: var(--color-surface-3, #151a28); border: 1px solid var(--color-border, #1c2235); margin-bottom: 0.5rem; }
  .progress-bar { height: 100%; background: var(--color-text-accent, #c49a5a); transition: width 0.3s; }
  .progress-label { font-family: var(--font-mono, "JetBrains Mono", monospace); font-size: 0.7rem; color: var(--color-text-muted, #8a93a6); }

  @media (min-width: 640px) { .credits-section, .progress-section { padding: 1rem 2rem; } }
  @keyframes pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.85; } }
</style>
