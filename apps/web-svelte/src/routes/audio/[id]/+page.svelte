<script lang="ts">
  import { onMount } from "svelte";
  import {
    Music,
    Play,
    Pause,
    Shuffle,
    Star,
    Calendar,
    Building2,
    HardDrive,
  } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import { PUBLIC_API_URL } from "$env/static/public";

  let { data } = $props();
  const a = $derived(data.library);

  function formatDuration(sec: number | null | undefined) {
    if (!sec) return null;
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    const h = Math.floor(m / 60);
    if (h > 0)
      return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  const ratingStars = $derived(a.rating ? Math.round(a.rating / 20) : 0);

  let audioEl: HTMLAudioElement | null = $state(null);
  let activeTrackId = $state<string | null>(null);
  let playing = $state(false);

  function playTrack(id: string) {
    if (!audioEl) return;
    if (activeTrackId === id) {
      if (playing) audioEl.pause();
      else void audioEl.play();
      return;
    }
    activeTrackId = id;
    const base = PUBLIC_API_URL ?? "http://localhost:4000";
    audioEl.src = `${base}/audio-stream/${id}`;
    void audioEl.play().catch(() => {});
  }

  onMount(() => {
    if (!audioEl) return;
    const onPlay = () => (playing = true);
    const onPause = () => (playing = false);
    audioEl.addEventListener("play", onPlay);
    audioEl.addEventListener("pause", onPause);
    return () => {
      audioEl?.removeEventListener("play", onPlay);
      audioEl?.removeEventListener("pause", onPause);
    };
  });
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col sm:flex-row gap-4 items-start">
    <div class="w-48 h-48 shrink-0 bg-surface-1 border border-border-subtle overflow-hidden shadow-lg">
      {#if a.coverImagePath}
        <img src={toApiUrl(a.coverImagePath)} alt={a.title} class="h-full w-full object-cover" />
      {:else}
        <div class="flex h-full items-center justify-center">
          <Music class="h-16 w-16 text-text-disabled" />
        </div>
      {/if}
    </div>
    <div class="flex-1 min-w-0 space-y-2">
      <h1 class="flex items-center gap-2.5 text-text-primary">
        <Music class="h-5 w-5 text-text-accent" />
        {a.title}
      </h1>

      <div class="flex flex-wrap items-center gap-2 text-[0.78rem] text-text-muted">
        <span>{a.trackCount} track{a.trackCount === 1 ? "" : "s"}</span>
        {#if a.totalDuration}
          <span>· {formatDuration(a.totalDuration)}</span>
        {/if}
        {#if a.studio}
          <span class="inline-flex items-center gap-1">
            · <Building2 class="h-3 w-3" />
            <a
              href={`/studios/${encodeURIComponent(a.studio.name)}`}
              class="text-text-accent hover:text-text-accent-bright transition-colors"
            >
              {a.studio.name}
            </a>
          </span>
        {/if}
        {#if a.date}
          <span class="inline-flex items-center gap-1">
            · <Calendar class="h-3 w-3" />{a.date}
          </span>
        {/if}
        {#if a.isNsfw}
          <Badge variant="warning">
            {#snippet children()}NSFW{/snippet}
          </Badge>
        {/if}
      </div>

      <div class="flex items-center gap-0.5 pt-1">
        {#each Array.from({ length: 5 }) as _, i}
          <Star
            class={`h-4 w-4 ${
              i < ratingStars
                ? "fill-accent-500 text-accent-500"
                : "text-text-disabled"
            }`}
          />
        {/each}
      </div>

      {#if a.details}
        <p class="mt-2 text-[0.82rem] text-text-secondary leading-relaxed whitespace-pre-wrap max-w-2xl">
          {a.details}
        </p>
      {/if}

      <div class="flex items-center gap-2 pt-2">
        <button
          type="button"
          onclick={() => a.tracks[0] && playTrack(a.tracks[0].id)}
          disabled={a.tracks.length === 0}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.78rem] font-medium bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900 text-accent-200 border border-border-accent shadow-[var(--shadow-glow-accent)] hover:shadow-[var(--shadow-glow-accent-strong)] hover:border-border-accent-strong transition-all duration-normal disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play class="h-3 w-3" />
          Play All
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.78rem] text-text-muted border border-border-subtle hover:text-text-primary hover:border-border-accent transition-colors"
          title="Shuffle (coming soon)"
        >
          <Shuffle class="h-3 w-3" />
          Shuffle
        </button>
      </div>
    </div>
  </div>

  <audio bind:this={audioEl} controls class="w-full" preload="none"></audio>

  <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
    <div class="min-w-0 space-y-2">
      <HierarchySection title={`Tracks — ${a.trackCount}`}>
        {#snippet children()}
          <ul class="surface-panel divide-y divide-border-subtle">
            {#each a.tracks as t (t.id)}
              {@const isActive = activeTrackId === t.id}
              <li
                class={`flex items-center gap-3 px-4 py-2 transition-colors duration-fast ${
                  isActive ? "bg-accent-950" : "hover:bg-surface-2"
                }`}
              >
                <button
                  type="button"
                  onclick={() => playTrack(t.id)}
                  class="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-accent transition-colors"
                  aria-label={isActive && playing ? "Pause" : "Play"}
                >
                  {#if isActive && playing}
                    <Pause class="h-3.5 w-3.5" fill="currentColor" />
                  {:else}
                    <Play class="h-3.5 w-3.5" fill="currentColor" />
                  {/if}
                </button>
                <span class="w-6 text-[0.72rem] text-text-disabled text-right font-mono">
                  {t.trackNumber ?? ""}
                </span>
                <a
                  href={`/audio/tracks/${t.id}`}
                  class={`flex-1 min-w-0 text-[0.82rem] truncate transition-colors ${
                    isActive ? "text-text-accent" : "text-text-primary hover:text-text-accent"
                  }`}
                >
                  {t.title}
                </a>
                {#if t.embeddedArtist}
                  <span class="text-[0.72rem] text-text-muted truncate max-w-[240px]">
                    {t.embeddedArtist}
                  </span>
                {/if}
                <span class="text-[0.72rem] text-text-disabled font-mono w-16 text-right">
                  {formatDuration(t.duration) ?? "—"}
                </span>
              </li>
            {/each}
          </ul>
          {#if a.trackTotal > a.tracks.length}
            <p class="text-[0.78rem] text-text-muted mt-2 text-center">
              Showing {a.tracks.length} of {a.trackTotal}.
            </p>
          {/if}
        {/snippet}
      </HierarchySection>
    </div>

    <aside class="space-y-4 lg:sticky lg:top-5 lg:self-start">
      <div class="surface-well p-4 space-y-4">
        {#if a.performers && a.performers.length > 0}
          <div class="space-y-2">
            <h2 class="text-kicker">Artists</h2>
            <div class="flex flex-wrap gap-1.5">
              {#each a.performers as p (p.id)}
                <a
                  href={`/performers/${p.id}`}
                  class="inline-flex items-center gap-1.5 tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                >
                  {#if p.imagePath}
                    <img
                      src={toApiUrl(p.imagePath)}
                      alt=""
                      class="h-4 w-3 object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  {/if}
                  {p.name}
                </a>
              {/each}
            </div>
          </div>
        {/if}

        {#if a.tags && a.tags.length > 0}
          <div class="space-y-2">
            <h2 class="text-kicker">Tags / Genres</h2>
            <div class="flex flex-wrap gap-1.5">
              {#each a.tags as t (t.id)}
                <a
                  href={`/tags/${encodeURIComponent(t.name)}`}
                  class="tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                >
                  {t.name}
                </a>
              {/each}
            </div>
          </div>
        {/if}

        {#if a.folderPath}
          <div class="space-y-1">
            <h2 class="text-kicker flex items-center gap-1.5">
              <HardDrive class="h-3 w-3" /> Path
            </h2>
            <p
              class="text-[0.7rem] text-text-disabled break-all font-mono"
              title={a.folderPath}
            >
              {a.folderPath}
            </p>
          </div>
        {/if}
      </div>
    </aside>
  </div>
</div>
