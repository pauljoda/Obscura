<script lang="ts">
  import { Music, Play } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";

  let { data } = $props();
  const a = data.library;

  function formatDuration(sec: number | null | undefined) {
    if (!sec) return null;
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
</script>

<svelte:head>
  <title>{a.title} — Audio — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex flex-col sm:flex-row gap-4 items-start">
    <div class="w-48 h-48 shrink-0 bg-surface-1 border border-border-subtle overflow-hidden">
      {#if a.coverImagePath}
        <img src={toApiUrl(a.coverImagePath)} alt="" class="h-full w-full object-cover" />
      {:else}
        <div class="flex h-full items-center justify-center">
          <Music class="h-12 w-12 text-text-disabled" />
        </div>
      {/if}
    </div>
    <div class="flex-1 space-y-1.5">
      <p class="text-kicker text-text-muted">Audio library</p>
      <h1 class="text-h1 text-text-primary">{a.title}</h1>
      <div class="flex flex-wrap items-center gap-2 text-body-sm text-text-muted">
        <span>{a.trackCount} track{a.trackCount === 1 ? "" : "s"}</span>
        {#if a.totalDuration}<span>· {formatDuration(a.totalDuration)}</span>{/if}
        {#if a.studio}<span class="text-text-accent">· {a.studio.name}</span>{/if}
        {#if a.date}<span>· {a.date}</span>{/if}
        {#if a.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
      </div>
    </div>
  </header>

  {#if a.details}
    <section class="surface-panel p-5 space-y-2">
      <h2 class="text-label text-text-muted">Details</h2>
      <p class="text-body text-text-secondary whitespace-pre-wrap break-words">{a.details}</p>
    </section>
  {/if}

  <section class="space-y-2">
    <h2 class="text-label text-text-muted">Tracks</h2>
    <ul class="surface-panel divide-y divide-border-subtle">
      {#each a.tracks as t (t.id)}
        <li class="flex items-center gap-3 px-4 py-2 hover:bg-surface-2 transition-colors duration-fast">
          <span class="w-6 text-body-sm text-text-disabled text-right font-mono">{t.trackNumber ?? ""}</span>
          <a
            href={`/audio/tracks/${t.id}`}
            class="flex-1 min-w-0 text-body text-text-primary hover:text-text-accent truncate"
          >
            {t.title}
          </a>
          {#if t.embeddedArtist}
            <span class="text-body-sm text-text-muted truncate max-w-[240px]">{t.embeddedArtist}</span>
          {/if}
          <span class="text-body-sm text-text-disabled font-mono w-16 text-right">
            {formatDuration(t.duration) ?? "—"}
          </span>
        </li>
      {/each}
    </ul>
    {#if a.trackTotal > a.tracks.length}
      <p class="text-body-sm text-text-muted">
        Showing {a.tracks.length} of {a.trackTotal}. <span class="text-text-disabled">Pagination + queue lands in APP-74.</span>
      </p>
    {/if}
  </section>
</div>
