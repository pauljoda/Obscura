<script lang="ts">
  import { onMount } from "svelte";
  import { Film, Star } from "@lucide/svelte";
  import {
    fetchV2Entities,
    updateV2EntityRating,
    type V2EntityCard,
  } from "$lib/api/v2";

  type LoadState = "loading" | "ready" | "error";

  let loadState: LoadState = $state("loading");
  let items: V2EntityCard[] = $state.raw([]);
  let prefetchedItems: V2EntityCard[] | null = $state.raw(null);
  let nextCursor: string | null = $state(null);
  let prefetchedNextCursor: string | null = $state(null);
  let errorMessage: string | null = $state(null);
  let loadingMore = $state(false);
  let ratingBusy: string | null = $state(null);

  const totalLabel = $derived(
    items.length === 1 ? "1 video" : `${items.length.toLocaleString()} videos`,
  );

  function ratingValue(item: V2EntityCard): number {
    const value = item.capabilities.rating?.value;
    return typeof value === "number" ? value : Number(value ?? 0);
  }

  onMount(() => {
    void loadInitial();
  });

  async function loadInitial() {
    loadState = "loading";
    errorMessage = null;

    try {
      const response = await fetchV2Entities({ kind: "video" });
      items = response.items;
      nextCursor = response.nextCursor;
      loadState = "ready";
      void prefetchNext();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      loadState = "error";
    }
  }

  async function prefetchNext() {
    if (!nextCursor || prefetchedItems) return;

    try {
      const response = await fetchV2Entities({
        kind: "video",
        cursor: nextCursor,
      });
      prefetchedItems = response.items;
      prefetchedNextCursor = response.nextCursor;
    } catch {
      prefetchedItems = null;
      prefetchedNextCursor = null;
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    loadingMore = true;

    try {
      if (prefetchedItems) {
        items = [...items, ...prefetchedItems];
        nextCursor = prefetchedNextCursor;
        prefetchedItems = null;
        prefetchedNextCursor = null;
      } else {
        const response = await fetchV2Entities({
          kind: "video",
          cursor: nextCursor,
        });
        items = [...items, ...response.items];
        nextCursor = response.nextCursor;
      }

      void prefetchNext();
    } finally {
      loadingMore = false;
    }
  }

  async function setRating(item: V2EntityCard, value: number) {
    if (ratingBusy) return;
    const previousItems = items;
    const nextValue = item.capabilities.rating?.value === value ? null : value;

    ratingBusy = item.id;
    items = items.map((candidate: V2EntityCard) =>
      candidate.id === item.id
        ? {
            ...candidate,
            capabilities: {
              ...candidate.capabilities,
              rating: nextValue == null ? null : { value: nextValue },
            },
          }
        : candidate,
    );

    try {
      await updateV2EntityRating(item.id, nextValue);
    } catch {
      items = previousItems;
    } finally {
      ratingBusy = null;
    }
  }
</script>

<svelte:head>
  <title>Obscura · v2 Videos</title>
</svelte:head>

<section class="space-y-5">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <Film class="h-5 w-5 text-text-accent" />
        v2 Videos
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">
        Global entity projection
      </p>
    </div>
    <span class="text-mono-sm text-text-disabled">{totalLabel}</span>
  </div>

  {#if loadState === "loading"}
    <div class="video-grid" aria-busy="true">
      {#each Array.from({ length: 12 }) as _, index (index)}
        <div class="skeleton-tile"></div>
      {/each}
    </div>
  {:else if loadState === "error"}
    <div class="notice surface-error">
      <p>{errorMessage ?? "The v2 video library could not be loaded."}</p>
      <button type="button" onclick={() => void loadInitial()}>Retry</button>
    </div>
  {:else if items.length === 0}
    <div class="notice">
      <p>No v2 video entities are available yet.</p>
    </div>
  {:else}
    <div class="video-grid">
      {#each items as item (item.id)}
        <article class="video-tile">
          <a href={`/v2/videos/${item.id}`} class="thumb" aria-label={item.title}>
            {#if item.capabilities.thumbnailUrl}
              <img src={item.capabilities.thumbnailUrl} alt="" loading="lazy" />
            {:else}
              <Film class="h-8 w-8 text-text-disabled" />
            {/if}
          </a>

          <div class="tile-body">
            <a href={`/v2/videos/${item.id}`} class="title">{item.title}</a>
            <div class="meta-row">
              <span>{item.capabilities.tags.slice(0, 2).join(", ") || item.kind}</span>
              {#if item.capabilities.isNsfw}
                <span>NSFW</span>
              {/if}
            </div>
            <div class="rating-row" aria-label={`Rating for ${item.title}`}>
              {#each [1, 2, 3, 4, 5] as value (value)}
                <button
                  type="button"
                  class:active={ratingValue(item) >= value}
                  disabled={ratingBusy === item.id}
                  aria-label={`Rate ${value}`}
                  onclick={() => void setRating(item, value)}
                >
                  <Star class="h-3.5 w-3.5" />
                </button>
              {/each}
            </div>
          </div>
        </article>
      {/each}
    </div>

    {#if nextCursor}
      <div class="load-row">
        <button type="button" disabled={loadingMore} onclick={() => void loadMore()}>
          {loadingMore ? "Loading" : "Load more"}
        </button>
      </div>
    {/if}
  {/if}
</section>

<style>
  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 0.75rem;
  }

  .video-tile,
  .skeleton-tile,
  .notice {
    border: 1px solid color-mix(in srgb, var(--color-border, #2a2a2a) 80%, transparent);
    background: color-mix(in srgb, var(--color-surface-2, #151515) 88%, transparent);
    border-radius: 0;
  }

  .skeleton-tile {
    min-height: 15rem;
    animation: pulse 1.2s ease-in-out infinite;
  }

  .thumb {
    display: grid;
    aspect-ratio: 16 / 10;
    place-items: center;
    overflow: hidden;
    background: var(--color-surface-1, #101010);
  }

  .thumb img {
    height: 100%;
    width: 100%;
    object-fit: cover;
  }

  .tile-body {
    display: grid;
    gap: 0.5rem;
    padding: 0.7rem;
  }

  .title {
    color: var(--color-text, #f2f2f2);
    font-size: 0.84rem;
    font-weight: 600;
    line-height: 1.25;
    text-decoration: none;
  }

  .meta-row {
    display: flex;
    min-height: 1rem;
    justify-content: space-between;
    gap: 0.5rem;
    color: var(--color-text-muted, #a0a0a0);
    font-size: 0.68rem;
    text-transform: uppercase;
  }

  .rating-row {
    display: flex;
    gap: 0.2rem;
  }

  .rating-row button,
  .notice button,
  .load-row button {
    border: 1px solid var(--color-border, #2a2a2a);
    background: var(--color-surface-3, #1d1d1d);
    color: var(--color-text-muted, #a0a0a0);
    border-radius: 0;
  }

  .rating-row button {
    display: grid;
    height: 1.6rem;
    width: 1.6rem;
    place-items: center;
  }

  .rating-row button.active {
    border-color: #c49a5a;
    color: #c49a5a;
    box-shadow: 0 0 16px color-mix(in srgb, #c49a5a 30%, transparent);
  }

  .notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    color: var(--color-text-muted, #a0a0a0);
  }

  .surface-error {
    border-color: color-mix(in srgb, #ef4444 50%, var(--color-border, #2a2a2a));
  }

  .notice button,
  .load-row button {
    min-height: 2rem;
    padding: 0 0.8rem;
  }

  .load-row {
    display: flex;
    justify-content: center;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.85;
    }
  }
</style>
