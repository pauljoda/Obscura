<script lang="ts">
  import { Edit, Captions, Star } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import VideoPlayer from "$lib/components/VideoPlayer.svelte";

  let { data } = $props();
  const v = data.video;

  const subtitleTracks = (
    (v as { subtitleTracks?: Array<{ id: string; label?: string; language?: string | null; format?: string }> }).subtitleTracks ?? []
  )
    .filter((t) => !t.format || t.format === "vtt")
    .map((t) => ({
      id: t.id,
      label: t.label ?? t.language ?? "Captions",
      language: t.language,
      src: toApiUrl(`/videos/${v.id}/subtitles/${t.id}/source`) ?? "",
    }));
</script>

<svelte:head>
  <title>{v.title} — Video — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-start justify-between gap-4 flex-wrap">
    <div class="flex-1 min-w-0 space-y-1.5">
      <p class="text-kicker text-text-muted">Video</p>
      <h1 class="text-h1 text-text-primary">{v.title}</h1>
      {#if v.videoSeriesTitle}
        <p class="text-body text-text-accent">
          <a href={`/videos?series=${v.videoSeriesId}`} class="hover:text-accent-300">
            {v.videoSeriesTitle}
          </a>
          {#if v.seasonNumber !== null && v.episodeNumber !== null}
            <span class="text-text-disabled">
              · S{String(v.seasonNumber).padStart(2, "0")}E{String(v.episodeNumber).padStart(2, "0")}
            </span>
          {/if}
        </p>
      {/if}
    </div>
    <a href={`/videos/${v.id}/edit`}>
      <Button variant="secondary" size="md">
        <Edit class="h-3.5 w-3.5" />
        Edit
      </Button>
    </a>
  </header>

  <section class="surface-panel overflow-hidden">
    <VideoPlayer
      src={toApiUrl(v.streamUrl)}
      directSrc={toApiUrl(v.directStreamUrl)}
      poster={toApiUrl(v.thumbnailPath)}
      trickplaySprite={toApiUrl(v.spritePath)}
      trickplayVtt={toApiUrl(v.trickplayVttPath)}
      subtitles={subtitleTracks}
    />

    <div class="p-4 flex flex-wrap items-center gap-3 text-body-sm text-text-muted">
      {#if v.durationFormatted}<span>⏱ {v.durationFormatted}</span>{/if}
      {#if v.resolution}<span>{v.resolution}</span>{/if}
      {#if v.codec}<span class="font-mono">{v.codec}</span>{/if}
      {#if v.fileSizeFormatted}<span>💾 {v.fileSizeFormatted}</span>{/if}
      {#if v.playCount > 0}<span>▶ {v.playCount}</span>{/if}
      {#if v.hasSubtitles}
        <span class="inline-flex items-center gap-1">
          <Captions class="h-3 w-3 text-accent-500" />
          CC
        </span>
      {/if}
      {#if v.rating && v.rating > 0}
        <span class="inline-flex items-center gap-1 text-accent-300">
          <Star class="h-3 w-3 fill-current" />
          {Math.round(v.rating / 20)}
        </span>
      {/if}
      {#if v.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
    </div>
  </section>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <div class="lg:col-span-2 space-y-4">
      {#if v.details}
        <section class="surface-panel p-5 space-y-2">
          <h2 class="text-label text-text-muted">Details</h2>
          <p class="text-body text-text-secondary whitespace-pre-wrap break-words">{v.details}</p>
        </section>
      {/if}

      {#if v.performers && v.performers.length > 0}
        <section class="surface-panel p-5 space-y-3">
          <h2 class="text-label text-text-muted">Cast</h2>
          <div class="flex flex-wrap gap-3">
            {#each v.performers as p (p.id)}
              <a
                href={`/performers/${p.id}`}
                class="flex items-center gap-2 surface-well px-2.5 py-1.5 hover:border-border-accent transition-colors duration-fast"
              >
                {#if p.imagePath}
                  <img src={toApiUrl(p.imagePath)} alt="" class="h-7 w-6 object-cover" />
                {/if}
                <div class="leading-tight">
                  <div class="text-body-sm text-text-primary">{p.name}</div>
                  {#if p.character}
                    <div class="text-[0.62rem] text-text-muted truncate max-w-[180px]" title={p.character}>
                      {p.character}
                    </div>
                  {/if}
                </div>
              </a>
            {/each}
          </div>
        </section>
      {/if}
    </div>

    <aside class="space-y-4">
      <section class="surface-panel p-5 space-y-2">
        <h2 class="text-label text-text-muted">File</h2>
        <dl class="text-body-sm text-text-secondary space-y-1">
          {#if v.filePath}
            <div class="flex gap-2"><dt class="text-text-muted">Path:</dt><dd class="font-mono break-all">{v.filePath}</dd></div>
          {/if}
          {#if v.container}
            <div class="flex gap-2"><dt class="text-text-muted">Container:</dt><dd>{v.container}</dd></div>
          {/if}
          {#if v.width && v.height}
            <div class="flex gap-2"><dt class="text-text-muted">Dimensions:</dt><dd>{v.width} × {v.height}</dd></div>
          {/if}
          {#if v.date}
            <div class="flex gap-2"><dt class="text-text-muted">Date:</dt><dd>{v.date}</dd></div>
          {/if}
        </dl>
      </section>

      {#if v.tags && v.tags.length > 0}
        <section class="surface-panel p-5 space-y-2">
          <h2 class="text-label text-text-muted">Tags</h2>
          <div class="flex flex-wrap gap-1.5">
            {#each v.tags as t (t.id)}
              <a
                href={`/tags/${encodeURIComponent(t.name)}`}
                class="tag-chip tag-chip-default hover:border-border-accent"
              >
                {t.name}
              </a>
            {/each}
          </div>
        </section>
      {/if}
    </aside>
  </div>
</div>
