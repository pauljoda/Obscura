<script lang="ts">
  import { Music } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import AudioPlayer from "$lib/components/AudioPlayer.svelte";
  import { usePlaylist } from "$lib/stores/playlist.svelte";

  let { data } = $props();
  const t = $derived(data.track);
  const playlist = usePlaylist();
  const trackList = $derived([t]);
  const isCurrentPlaylistItem = $derived(
    playlist.isActive && playlist.isPlaylistItem("audio-track", t.id),
  );
  let activeTrackId = $state<string | null>(null);

  function formatDuration(sec: number | null | undefined) {
    if (!sec) return null;
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  $effect(() => {
    if (isCurrentPlaylistItem) activeTrackId = t.id;
  });
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="max-w-3xl space-y-5">
  <div class="flex items-start gap-3">
    <div class="flex-1 min-w-0 space-y-1">
      <h1 class="flex items-center gap-2.5 text-text-primary">
        <Music class="h-5 w-5 text-text-accent" />
        {t.title}
      </h1>
      <div class="flex flex-wrap items-center gap-2 text-[0.78rem] text-text-muted">
        {#if t.embeddedArtist}<span>{t.embeddedArtist}</span>{/if}
        {#if t.embeddedAlbum}<span>· {t.embeddedAlbum}</span>{/if}
        {#if t.libraryId}
          <a
            href={`/audio/${t.libraryId}`}
            class="text-text-accent hover:text-accent-300 transition-colors"
          >
            · in library
          </a>
        {/if}
        {#if t.isNsfw}
          <Badge variant="warning">NSFW</Badge>
        {/if}
      </div>
    </div>
  </div>

  <section class="surface-panel p-4">
    <AudioPlayer
      tracks={trackList}
      {activeTrackId}
      onTrackChange={(trackId) => (activeTrackId = trackId)}
      onPlaybackComplete={() => {
        if (isCurrentPlaylistItem) playlist.reportContentEnded("audio-track", t.id);
      }}
    />
  </section>

  <section class="surface-panel p-5 space-y-2">
    <h2 class="text-label text-text-muted">Technical</h2>
    <dl class="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-body-sm text-text-secondary">
      {#if t.duration}
        <div class="flex gap-2"><dt class="text-text-muted">Length:</dt><dd>{formatDuration(t.duration)}</dd></div>
      {/if}
      {#if t.codec}
        <div class="flex gap-2"><dt class="text-text-muted">Codec:</dt><dd class="font-mono">{t.codec}</dd></div>
      {/if}
      {#if t.bitRate}
        <div class="flex gap-2"><dt class="text-text-muted">Bitrate:</dt><dd>{Math.round(t.bitRate / 1000)} kbps</dd></div>
      {/if}
      {#if t.sampleRate}
        <div class="flex gap-2"><dt class="text-text-muted">Sample:</dt><dd>{t.sampleRate} Hz</dd></div>
      {/if}
      {#if t.channels}
        <div class="flex gap-2"><dt class="text-text-muted">Channels:</dt><dd>{t.channels}</dd></div>
      {/if}
      {#if t.container}
        <div class="flex gap-2"><dt class="text-text-muted">Container:</dt><dd>{t.container}</dd></div>
      {/if}
      {#if t.filePath}
        <div class="flex gap-2 col-span-full"><dt class="text-text-muted">Path:</dt><dd class="font-mono break-all">{t.filePath}</dd></div>
      {/if}
    </dl>
  </section>

  {#if t.details}
    <section class="surface-panel p-5 space-y-2">
      <h2 class="text-label text-text-muted">Details</h2>
      <p class="text-body text-text-secondary whitespace-pre-wrap break-words">{t.details}</p>
    </section>
  {/if}
</div>
