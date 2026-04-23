<script lang="ts">
  import {
    Music,
    Disc3,
    FolderPlus,
    Pencil,
    Save,
    XCircle,
    CheckCircle2,
    Clock,
    Headphones,
    Radio,
    Gauge,
    PlayCircle,
    FileAudio,
    Building2,
    Library as LibraryIcon,
    Calendar,
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { fetchPerformers, fetchTags } from "$lib/api/entities";
  import { updateAudioTrack } from "$lib/api/media";
  import { toApiUrl } from "$lib/api/core";
  import { tagsVisibleInNsfwMode } from "$lib/nsfw-tags";
  import { entityTerms } from "$lib/terminology";
  import AddToCollectionModal from "$lib/components/AddToCollectionModal.svelte";
  import AudioPlayer from "$lib/components/AudioPlayer.svelte";
  import ChipInput from "$lib/components/ChipInput.svelte";
  import NsfwChip from "$lib/components/NsfwChip.svelte";
  import StarRatingPicker from "$lib/components/StarRatingPicker.svelte";
  import { useAppChrome } from "$lib/stores/app-chrome.svelte";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import { usePlaylist } from "$lib/stores/playlist.svelte";

  let { data } = $props();
  const playlist = usePlaylist();
  const nsfw = useNsfw();
  const appChrome = useAppChrome();
  let overrideTrack = $state<typeof data.track | null>(null);
  const track = $derived(overrideTrack ?? data.track);
  const trackList = $derived([track]);
  const libraryCoverUrl = $derived(
    data.libraryCoverImagePath ? toApiUrl(data.libraryCoverImagePath) : undefined,
  );
  const isCurrentPlaylistItem = $derived(
    playlist.isActive && playlist.isPlaylistItem("audio-track", track.id),
  );
  const visibleTags = $derived(tagsVisibleInNsfwMode(track.tags, nsfw.mode));
  let activeTrackId = $state<string | null>(null);
  let editing = $state(false);
  let saving = $state(false);
  let collectionModalOpen = $state(false);
  let editRating = $state<number | null>(null);
  let editOrganized = $state(false);
  let editIsNsfw = $state(false);
  let editTags = $state<string[]>([]);
  let editPerformers = $state<string[]>([]);
  let tagSuggestions = $state<{ name: string; count?: number }[]>([]);
  let performerSuggestions = $state<{ name: string; count?: number }[]>([]);

  $effect(() => {
    data.track.id;
    data.track.updatedAt;
    overrideTrack = null;
    resetEditState(data.track);
  });

  function formatDuration(sec: number | null | undefined) {
    if (!sec) return null;
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes) return "—";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }

  function formatBitRate(bps: number | null | undefined): string {
    if (!bps) return "—";
    return `${Math.round(bps / 1000)} kbps`;
  }

  function resetEditState(source = track) {
    editRating = source.rating;
    editOrganized = source.organized;
    editIsNsfw = source.isNsfw ?? false;
    editTags = source.tags.map((tag) => tag.name);
    editPerformers = source.performers.map((performer) => performer.name);
  }

  $effect(() => {
    if (isCurrentPlaylistItem) activeTrackId = track.id;
  });

  async function startEdit() {
    resetEditState();
    editing = true;
    try {
      const [tagsResponse, performersResponse] = await Promise.all([
        fetchTags({ nsfw: nsfw.mode }),
        fetchPerformers({ nsfw: nsfw.mode, limit: 500 }),
      ]);
      tagSuggestions = tagsResponse.tags.map((tag) => ({
        name: tag.name,
        count: tag.videoCount + (tag.imageCount ?? 0),
      }));
      performerSuggestions = performersResponse.performers.map((performer) => ({
        name: performer.name,
        count: performer.videoCount,
      }));
    } catch {
      tagSuggestions = [];
      performerSuggestions = [];
    }
  }

  function buildTagEmbeds(names: string[]) {
    return names.map((name) => {
      const existing = track.tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
      return {
        id: existing?.id ?? `local-tag-${name.toLowerCase()}`,
        name,
        isNsfw: existing?.isNsfw ?? false,
      };
    });
  }

  function buildPerformerEmbeds(names: string[]) {
    return names.map((name) => {
      const existing = track.performers.find(
        (performer) => performer.name.toLowerCase() === name.toLowerCase(),
      );
      return {
        id: existing?.id ?? `local-performer-${name.toLowerCase()}`,
        name,
      };
    });
  }

  async function handleSave() {
    saving = true;
    try {
      await updateAudioTrack(track.id, {
        rating: editRating,
        organized: editOrganized,
        isNsfw: editIsNsfw,
        tagNames: [...editTags],
        performerNames: [...editPerformers],
      });
      overrideTrack = {
        ...track,
        rating: editRating,
        organized: editOrganized,
        isNsfw: editIsNsfw,
        tags: buildTagEmbeds(editTags),
        performers: buildPerformerEmbeds(editPerformers),
        updatedAt: new Date().toISOString(),
      };
      editing = false;
    } finally {
      saving = false;
    }
  }

  async function handleRatingChange(nextRating: number | null) {
    if (editing) {
      editRating = nextRating;
      return;
    }

    const previousRating = track.rating;
    overrideTrack = { ...track, rating: nextRating };
    try {
      await updateAudioTrack(track.id, { rating: nextRating });
    } catch {
      overrideTrack = { ...track, rating: previousRating };
    }
  }
</script>

<svelte:head>
  <title>{track.title} — Audio Track — Obscura</title>
</svelte:head>

<div class="space-y-6 pb-64 md:pb-60">
  <!-- ─── Hero ─────────────────────────────────────────────────── -->
  <section class="relative isolate overflow-hidden border border-border-subtle">
    <!-- Blurred cover backdrop -->
    <div class="pointer-events-none absolute inset-0 -z-10">
      {#if libraryCoverUrl}
        <img
          src={libraryCoverUrl}
          alt=""
          aria-hidden="true"
          class="h-full w-full object-cover scale-110 blur-3xl opacity-35"
          decoding="async"
        />
      {:else}
        <div class="h-full w-full bg-gradient-to-br from-accent-900 via-surface-1 to-surface-bg"></div>
      {/if}
      <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-[var(--color-surface-bg)]"></div>
    </div>

    <div class="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:gap-7 sm:p-7">
      <!-- Cover artwork -->
      <div class="relative h-36 w-36 flex-shrink-0 overflow-hidden border border-border-default bg-surface-2 shadow-[0_20px_60px_rgba(0,0,0,0.55)] sm:h-44 sm:w-44 md:h-48 md:w-48">
        {#if libraryCoverUrl}
          <img
            src={libraryCoverUrl}
            alt={track.title}
            class="h-full w-full object-cover"
            decoding="async"
          />
        {:else}
          <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent-800/40 via-surface-2 to-surface-3">
            <Disc3 class="h-20 w-20 text-accent-400/40 animate-[spin_16s_linear_infinite]" />
          </div>
        {/if}
        {#if track.isNsfw}
          <div class="absolute top-1.5 right-1.5">
            <NsfwChip />
          </div>
        {/if}
      </div>

      <!-- Title + meta -->
      <div class="min-w-0 flex-1 space-y-3">
        <div class="flex items-center gap-2 text-kicker">
          <Radio class="h-3 w-3" />
          {#if track.libraryId}
            <a href={`/audio/${track.libraryId}`} class="transition-colors hover:text-accent-200">Audio Track</a>
          {:else}
            <span>Audio Track</span>
          {/if}
        </div>
        <h1 class="font-heading text-3xl font-semibold leading-tight text-text-primary drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] sm:text-4xl md:text-5xl">
          {track.title}
        </h1>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.82rem] text-text-secondary">
          {#if track.embeddedArtist}
            <span class="font-medium text-text-primary">{track.embeddedArtist}</span>
          {/if}
          {#if track.embeddedArtist && track.embeddedAlbum}<span class="text-text-disabled">•</span>{/if}
          {#if track.embeddedAlbum}
            <span class="italic">{track.embeddedAlbum}</span>
          {/if}
          {#if (track.embeddedArtist || track.embeddedAlbum) && track.date}<span class="text-text-disabled">•</span>{/if}
          {#if track.date}
            <span class="inline-flex items-center gap-1 text-text-muted">
              <Calendar class="h-3 w-3" />
              {track.date.slice(0, 10)}
            </span>
          {/if}
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <StarRatingPicker value={editing ? editRating : track.rating} onChange={handleRatingChange} />
          {#if track.organized}
            <span class="inline-flex items-center gap-1 text-[0.72rem] text-accent-300">
              <CheckCircle2 class="h-3.5 w-3.5" />
              Organized
            </span>
          {/if}
        </div>

        <!-- Tech meta strip -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[0.72rem] text-text-muted">
          {#if track.duration != null}
            <span class="inline-flex items-center gap-1 font-mono tabular-nums">
              <Clock class="h-3 w-3" />
              {formatDuration(track.duration)}
            </span>
          {/if}
          {#if track.codec}
            <span class="inline-flex items-center gap-1 font-mono uppercase">
              <Disc3 class="h-3 w-3" />
              {track.codec}
            </span>
          {/if}
          {#if track.bitRate}
            <span class="inline-flex items-center gap-1 font-mono">
              <Gauge class="h-3 w-3" />
              {formatBitRate(track.bitRate)}
            </span>
          {/if}
          {#if track.channels}
            <span class="inline-flex items-center gap-1 font-mono">
              <Headphones class="h-3 w-3" />
              {track.channels === 1 ? "Mono" : track.channels === 2 ? "Stereo" : `${track.channels}ch`}
            </span>
          {/if}
          {#if track.sampleRate}
            <span class="font-mono">{(track.sampleRate / 1000).toFixed(1)} kHz</span>
          {/if}
          {#if track.fileSize}
            <span class="font-mono">{formatFileSize(track.fileSize)}</span>
          {/if}
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            type="button"
            onclick={() => (collectionModalOpen = true)}
            class="inline-flex items-center gap-1.5 border border-border-subtle bg-surface-2/70 px-3 py-1.5 text-[0.75rem] text-text-muted backdrop-blur-sm transition-colors hover:border-border-accent hover:text-text-primary"
          >
            <FolderPlus class="h-3.5 w-3.5" />
            Add to collection
          </button>
          {#if !editing}
            <button
              type="button"
              onclick={() => void startEdit()}
              class="inline-flex items-center gap-1.5 border border-border-subtle bg-surface-2/70 px-3 py-1.5 text-[0.75rem] text-text-muted backdrop-blur-sm transition-colors hover:border-border-accent hover:text-text-primary"
            >
              <Pencil class="h-3.5 w-3.5" />
              Edit track
            </button>
          {/if}
          {#if track.playCount > 0}
            <span class="inline-flex items-center gap-1.5 border border-border-subtle bg-surface-2/50 px-3 py-1.5 text-[0.72rem] text-text-muted backdrop-blur-sm">
              <PlayCircle class="h-3.5 w-3.5 text-accent-400" />
              {track.playCount} play{track.playCount === 1 ? "" : "s"}
              {#if track.lastPlayedAt}
                <span class="text-text-disabled">· last {new Date(track.lastPlayedAt).toLocaleDateString()}</span>
              {/if}
            </span>
          {/if}
        </div>
      </div>
    </div>
  </section>

  <!-- ─── Details grid ──────────────────────────────────────────── -->
  <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <!-- Main column -->
    <div class="space-y-5">
      <!-- Description / details -->
      {#if track.details || editing}
        <section class="surface-panel p-5">
          <h2 class="text-kicker mb-2">About this track</h2>
          {#if track.details}
            <p class="whitespace-pre-wrap text-[0.85rem] leading-relaxed text-text-secondary">
              {track.details}
            </p>
          {:else}
            <p class="text-[0.78rem] text-text-disabled italic">No description</p>
          {/if}
        </section>
      {/if}

      <!-- Performers -->
      <section class="surface-panel p-5">
        <h2 class="text-kicker mb-3 flex items-center gap-2">
          <Music class="h-3 w-3" />
          {entityTerms.performers}
        </h2>
        {#if editing}
          <ChipInput
            values={editPerformers}
            onChange={(next) => (editPerformers = next)}
            suggestions={performerSuggestions}
            placeholder={`Add ${entityTerms.performer.toLowerCase()}...`}
          />
        {:else if track.performers.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each track.performers as performer (performer.id)}
              <a
                href={`/performers/${performer.id}`}
                class="inline-flex items-center gap-1.5 border border-border-subtle bg-surface-2 px-2.5 py-1 text-[0.78rem] text-text-primary transition-colors hover:border-border-accent hover:text-text-accent"
              >
                {performer.name}
              </a>
            {/each}
          </div>
        {:else}
          <p class="text-[0.72rem] text-text-disabled italic">No {entityTerms.performers.toLowerCase()} attached</p>
        {/if}
      </section>

      <!-- Tags -->
      <section class="surface-panel p-5">
        <h2 class="text-kicker mb-3">Tags</h2>
        {#if editing}
          <ChipInput
            values={editTags}
            onChange={(next) => (editTags = next)}
            suggestions={tagSuggestions}
            placeholder="Add tag..."
          />
        {:else if visibleTags.length > 0}
          <div class="flex flex-wrap gap-1.5">
            {#each visibleTags as tag (tag.id)}
              <a
                href={`/tags/${encodeURIComponent(tag.name)}`}
                class="tag-chip tag-chip-default transition-colors hover:tag-chip-accent"
              >
                {tag.name}
              </a>
            {/each}
          </div>
        {:else}
          <p class="text-[0.72rem] text-text-disabled italic">No tags</p>
        {/if}
      </section>

      <!-- Edit mode toggles + save row -->
      {#if editing}
        <section class="surface-panel p-5 space-y-4">
          <h2 class="text-kicker">Flags</h2>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              onclick={() => (editOrganized = !editOrganized)}
              class={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-[0.78rem] transition-colors",
                editOrganized
                  ? "bg-accent-950 text-accent-300 border border-border-accent"
                  : "bg-surface-2 text-text-muted border border-border-subtle hover:text-text-primary",
              )}
            >
              <CheckCircle2 class="h-4 w-4" />
              {editOrganized ? "Organized" : "Mark as organized"}
            </button>
            <button
              type="button"
              onclick={() => (editIsNsfw = !editIsNsfw)}
              class={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-[0.78rem] transition-colors",
                editIsNsfw
                  ? "bg-error-muted/60 text-error-text border border-error/40"
                  : "bg-surface-2 text-text-muted border border-border-subtle hover:text-text-primary",
              )}
            >
              {editIsNsfw ? "Marked NSFW" : "Mark as NSFW"}
            </button>
          </div>
          <div class="flex gap-2 pt-1">
            <button
              type="button"
              onclick={() => void handleSave()}
              disabled={saving}
              aria-label="Save track changes"
              class="inline-flex flex-1 items-center justify-center gap-1.5 border border-border-accent bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900 px-3 py-2 text-[0.78rem] font-medium text-accent-100 shadow-[var(--shadow-glow-accent)] transition-all disabled:opacity-50 hover:shadow-[var(--shadow-glow-accent-strong)]"
            >
              <Save class="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onclick={() => {
                resetEditState();
                editing = false;
              }}
              class="inline-flex items-center justify-center gap-1.5 border border-border-subtle px-3 py-2 text-[0.78rem] text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              <XCircle class="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </section>
      {/if}
    </div>

    <!-- Sidebar -->
    <aside class="space-y-4">
      <!-- Context links -->
      <section class="surface-well p-4 space-y-3">
        <h2 class="text-kicker">Context</h2>
        {#if track.libraryId}
          <a
            href={`/audio/${track.libraryId}`}
            class="group/info flex items-center gap-3 border border-border-subtle bg-surface-2/60 p-2.5 transition-colors hover:border-border-accent"
          >
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden bg-surface-3">
              {#if libraryCoverUrl}
                <img src={libraryCoverUrl} alt="" class="h-full w-full object-cover" />
              {:else}
                <LibraryIcon class="h-4 w-4 text-text-disabled" />
              {/if}
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[0.62rem] uppercase tracking-wider text-text-disabled">Library</div>
              <div class="truncate text-[0.8rem] text-text-primary transition-colors group-hover/info:text-text-accent">
                View library
              </div>
            </div>
          </a>
        {/if}
        {#if track.studio}
          <a
            href={`/studios/${track.studio.id}`}
            class="group/info flex items-center gap-3 border border-border-subtle bg-surface-2/60 p-2.5 transition-colors hover:border-border-accent"
          >
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-surface-3">
              <Building2 class="h-4 w-4 text-accent-400" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[0.62rem] uppercase tracking-wider text-text-disabled">Studio</div>
              <div class="truncate text-[0.8rem] text-text-primary transition-colors group-hover/info:text-text-accent">
                {track.studio.name}
              </div>
            </div>
          </a>
        {/if}
        {#if !track.libraryId && !track.studio}
          <p class="text-[0.72rem] text-text-disabled italic">Standalone track</p>
        {/if}
      </section>

      <!-- Technical -->
      <section class="surface-well p-4">
        <h2 class="text-kicker mb-3 flex items-center gap-2">
          <FileAudio class="h-3 w-3" />
          Technical
        </h2>
        <dl class="space-y-1.5 text-[0.75rem]">
          {#if track.duration}
            <div class="flex justify-between gap-3">
              <dt class="text-text-muted">Length</dt>
              <dd class="font-mono tabular-nums text-text-secondary">{formatDuration(track.duration)}</dd>
            </div>
          {/if}
          {#if track.codec}
            <div class="flex justify-between gap-3">
              <dt class="text-text-muted">Codec</dt>
              <dd class="font-mono uppercase text-text-secondary">{track.codec}</dd>
            </div>
          {/if}
          {#if track.container}
            <div class="flex justify-between gap-3">
              <dt class="text-text-muted">Container</dt>
              <dd class="font-mono uppercase text-text-secondary">{track.container}</dd>
            </div>
          {/if}
          {#if track.bitRate}
            <div class="flex justify-between gap-3">
              <dt class="text-text-muted">Bitrate</dt>
              <dd class="font-mono tabular-nums text-text-secondary">{Math.round(track.bitRate / 1000)} kbps</dd>
            </div>
          {/if}
          {#if track.sampleRate}
            <div class="flex justify-between gap-3">
              <dt class="text-text-muted">Sample</dt>
              <dd class="font-mono tabular-nums text-text-secondary">{track.sampleRate} Hz</dd>
            </div>
          {/if}
          {#if track.channels}
            <div class="flex justify-between gap-3">
              <dt class="text-text-muted">Channels</dt>
              <dd class="font-mono text-text-secondary">{track.channels}</dd>
            </div>
          {/if}
          {#if track.fileSize}
            <div class="flex justify-between gap-3">
              <dt class="text-text-muted">Size</dt>
              <dd class="font-mono text-text-secondary">{formatFileSize(track.fileSize)}</dd>
            </div>
          {/if}
        </dl>

        {#if track.filePath}
          <div class="mt-3 border-t border-border-subtle/60 pt-3">
            <div class="text-[0.62rem] uppercase tracking-wider text-text-disabled">Path</div>
            <p class="mt-1 break-all font-mono text-[0.68rem] text-text-muted" title={track.filePath}>
              {track.filePath}
            </p>
          </div>
        {/if}
      </section>
    </aside>
  </div>

  <AddToCollectionModal
    open={collectionModalOpen}
    onClose={() => (collectionModalOpen = false)}
    entityType="audio-track"
    entityId={track.id}
    entityTitle={track.title}
  />
</div>

<div
  class={cn(
    "pointer-events-none fixed left-0 right-0 z-[35] max-w-[100vw] px-2 pt-1",
    "bottom-[calc(3.5rem+6px)] md:bottom-4 md:px-5",
    appChrome.sidebarCollapsed ? "md:left-14" : "md:left-60",
  )}
  role="region"
  aria-label="Audio playback"
>
  <div class="pointer-events-auto surface-elevated overflow-hidden">
    <AudioPlayer
      tracks={trackList}
      {activeTrackId}
      onTrackChange={(trackId) => (activeTrackId = trackId)}
      onPlaybackComplete={() => {
        if (isCurrentPlaylistItem) playlist.reportContentEnded("audio-track", track.id);
      }}
      libraryCoverUrl={libraryCoverUrl}
      class="border-0 bg-transparent shadow-none"
    />
  </div>
</div>
