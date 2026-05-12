<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { ArrowLeft, Film, Layers, Star } from "@lucide/svelte";
  import {
    fetchV2Series,
    updateV2EntityRating,
    type V2VideoSeriesDetail,
  } from "$lib/api/v2";
  import {
    getRatingValue,
    getTags,
    getThumbnailUrl,
    withRatingCapability,
  } from "$lib/api/capabilities";

  type LoadState = "loading" | "ready" | "error";

  let loadState: LoadState = $state("loading");
  let series = $state<V2VideoSeriesDetail | null>(null);
  let errorMessage: string | null = $state(null);
  let ratingBusy = $state(false);

  const childCount = $derived((series?.children.length ?? 0) + (series?.videos.length ?? 0));

  function ratingValue(current: V2VideoSeriesDetail): number {
    return getRatingValue(current.capabilities);
  }

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

  async function setRating(value: number) {
    if (!series || ratingBusy) return;
    const previous = series;
    const nextValue = getRatingValue(series.capabilities) === value ? null : value;

    ratingBusy = true;
    series = {
      ...series,
      capabilities: withRatingCapability(series.capabilities, nextValue),
    };

    try {
      await updateV2EntityRating(series.id, nextValue);
    } catch {
      series = previous;
    } finally {
      ratingBusy = false;
    }
  }
</script>

<svelte:head>
  <title>{series?.title ?? "v2 Series"} · Obscura</title>
</svelte:head>

<section class="space-y-5">
  <a href="/v2/series" class="back-link">
    <ArrowLeft class="h-4 w-4" />
    Series
  </a>

  {#if loadState === "loading"}
    <div class="detail-shell loading" aria-busy="true"></div>
  {:else if loadState === "error"}
    <div class="notice surface-error">
      <p>{errorMessage ?? "The v2 series could not be loaded."}</p>
      <button type="button" onclick={() => void loadSeries()}>Retry</button>
    </div>
  {:else if series}
    <div class="detail-shell">
      <div class="poster-surface">
        {#if getThumbnailUrl(series.capabilities)}
          <img src={getThumbnailUrl(series.capabilities)} alt="" />
        {:else}
          <Layers class="h-10 w-10 text-text-disabled" />
        {/if}
      </div>

      <div class="detail-meta">
        <div>
          <h1 class="flex items-center gap-2.5">
            <Layers class="h-5 w-5 text-text-accent" />
            {series.title}
          </h1>
          <p>{series.summary ?? "No summary yet."}</p>
        </div>

        <div class="stats">
          <span>{childCount} linked items</span>
          <span>{series.renderingMode}</span>
          <span>{getTags(series.capabilities).join(", ") || "No tags"}</span>
        </div>

        <div class="rating-row" aria-label={`Rating for ${series.title}`}>
          {#each [1, 2, 3, 4, 5] as value (value)}
            <button
              type="button"
              class:active={ratingValue(series) >= value}
              disabled={ratingBusy}
              aria-label={`Rate ${value}`}
              onclick={() => void setRating(value)}
            >
              <Star class="h-4 w-4" />
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="children-shell">
      {#if childCount === 0}
        <p>No linked v2 episodes or child series yet.</p>
      {:else}
        {#each series.children as child (child.id)}
          <a href={`/v2/series/${child.id}`}>
            <Layers class="h-4 w-4" />
            {child.title}
          </a>
        {/each}
        {#each series.videos as video (video.id)}
          <a href={`/v2/videos/${video.id}`}>
            <Film class="h-4 w-4" />
            {video.title}
          </a>
        {/each}
      {/if}
    </div>
  {/if}
</section>

<style>
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-text-muted, #a0a0a0);
    font-size: 0.78rem;
    text-decoration: none;
  }

  .detail-shell,
  .children-shell,
  .notice {
    border: 1px solid var(--color-border, #2a2a2a);
    background: var(--color-surface-2, #151515);
    border-radius: 0;
  }

  .detail-shell {
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }

  .detail-shell.loading {
    min-height: 24rem;
    animation: pulse 1.2s ease-in-out infinite;
  }

  .poster-surface {
    display: grid;
    min-height: 14rem;
    place-items: center;
    overflow: hidden;
    background: #050505;
  }

  .poster-surface img {
    height: 100%;
    width: 100%;
    object-fit: cover;
  }

  .detail-meta {
    display: grid;
    gap: 0.9rem;
  }

  .detail-meta p,
  .stats,
  .children-shell {
    color: var(--color-text-muted, #a0a0a0);
    font-size: 0.82rem;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    text-transform: uppercase;
  }

  .rating-row {
    display: flex;
    gap: 0.25rem;
  }

  .rating-row button,
  .notice button {
    border: 1px solid var(--color-border, #2a2a2a);
    background: var(--color-surface-3, #1d1d1d);
    color: var(--color-text-muted, #a0a0a0);
    border-radius: 0;
  }

  .rating-row button {
    display: grid;
    height: 2rem;
    width: 2rem;
    place-items: center;
  }

  .rating-row button.active {
    border-color: #c49a5a;
    color: #c49a5a;
    box-shadow: 0 0 16px color-mix(in srgb, #c49a5a 30%, transparent);
  }

  .children-shell {
    display: grid;
    gap: 0.6rem;
    padding: 1rem;
  }

  .children-shell a {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--color-text, #f2f2f2);
    text-decoration: none;
  }

  .notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    color: var(--color-text-muted, #a0a0a0);
  }

  .notice button {
    min-height: 2rem;
    padding: 0 0.8rem;
  }

  .surface-error {
    border-color: color-mix(in srgb, #ef4444 50%, var(--color-border, #2a2a2a));
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
