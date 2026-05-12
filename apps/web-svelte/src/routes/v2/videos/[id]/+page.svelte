<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { ArrowLeft, Film, Star } from "@lucide/svelte";
  import {
    fetchV2Video,
    updateV2EntityRating,
    type V2VideoDetailDto,
  } from "$lib/api/v2";

  type LoadState = "loading" | "ready" | "error";

  let loadState: LoadState = $state("loading");
  let video = $state<V2VideoDetailDto | null>(null);
  let errorMessage: string | null = $state(null);
  let ratingBusy = $state(false);

  const streamSrc = $derived.by(() => (video ? `/api/videos/${video.id}/stream` : ""));
  const dimensions = $derived.by(() =>
    video?.width && video?.height ? `${video.width} x ${video.height}` : "Unknown resolution",
  );

  function ratingValue(current: V2VideoDetailDto): number {
    const value = current.capabilities.rating?.value;
    return typeof value === "number" ? value : Number(value ?? 0);
  }

  onMount(() => {
    void loadVideo();
  });

  async function loadVideo() {
    loadState = "loading";
    errorMessage = null;

    try {
      video = await fetchV2Video(page.params.id ?? "");
      loadState = "ready";
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      loadState = "error";
    }
  }

  async function setRating(value: number) {
    if (!video || ratingBusy) return;
    const previous = video;
    const nextValue = video.capabilities.rating?.value === value ? null : value;

    ratingBusy = true;
    video = {
      ...video,
      capabilities: {
        ...video.capabilities,
        rating: nextValue == null ? null : { value: nextValue },
      },
    };

    try {
      await updateV2EntityRating(video.id, nextValue);
    } catch {
      video = previous;
    } finally {
      ratingBusy = false;
    }
  }
</script>

<svelte:head>
  <title>{video?.title ?? "v2 Video"} · Obscura</title>
</svelte:head>

<section class="space-y-5">
  <a href="/v2/videos" class="back-link">
    <ArrowLeft class="h-4 w-4" />
    Videos
  </a>

  {#if loadState === "loading"}
    <div class="detail-shell loading" aria-busy="true"></div>
  {:else if loadState === "error"}
    <div class="notice surface-error">
      <p>{errorMessage ?? "The v2 video could not be loaded."}</p>
      <button type="button" onclick={() => void loadVideo()}>Retry</button>
    </div>
  {:else if video}
    <div class="detail-shell">
      <div class="player-surface">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video controls playsinline preload="metadata" src={streamSrc}>
        </video>
      </div>

      <div class="detail-meta">
        <div>
          <h1 class="flex items-center gap-2.5">
            <Film class="h-5 w-5 text-text-accent" />
            {video.title}
          </h1>
          <p>{video.summary ?? "No summary yet."}</p>
        </div>

        <div class="stats">
          <span>{dimensions}</span>
          <span>{video.duration ?? "Unknown duration"}</span>
          <span>{video.capabilities.tags.join(", ") || "No tags"}</span>
        </div>

        <div class="rating-row" aria-label={`Rating for ${video.title}`}>
          {#each [1, 2, 3, 4, 5] as value (value)}
            <button
              type="button"
              class:active={ratingValue(video) >= value}
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

  .player-surface {
    background: #050505;
  }

  video {
    display: block;
    width: 100%;
    max-height: 70vh;
  }

  .detail-meta {
    display: grid;
    gap: 0.9rem;
  }

  .detail-meta p,
  .stats {
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
