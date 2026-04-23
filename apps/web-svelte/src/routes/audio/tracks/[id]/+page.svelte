<script lang="ts">
  import {
    Music,
    FolderPlus,
    Pencil,
    Save,
    XCircle,
    CheckCircle2,
    Clock,
    Disc3,
    Headphones,
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { fetchPerformers, fetchTags } from "$lib/api/entities";
  import { updateAudioTrack } from "$lib/api/media";
  import { tagsVisibleInNsfwMode } from "$lib/nsfw-tags";
  import { entityTerms } from "$lib/terminology";
  import AddToCollectionModal from "$lib/components/AddToCollectionModal.svelte";
  import AudioPlayer from "$lib/components/AudioPlayer.svelte";
  import ChipInput from "$lib/components/ChipInput.svelte";
  import NsfwChip from "$lib/components/NsfwChip.svelte";
  import StarRatingPicker from "$lib/components/StarRatingPicker.svelte";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import { usePlaylist } from "$lib/stores/playlist.svelte";

  let { data } = $props();
  const playlist = usePlaylist();
  const nsfw = useNsfw();
  let overrideTrack = $state<typeof data.track | null>(null);
  const track = $derived(overrideTrack ?? data.track);
  const trackList = $derived([track]);
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
    if (!bytes) return "Unknown";
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

<div class="max-w-3xl space-y-5">
  <section class="surface-panel p-4">
    <AudioPlayer
      tracks={trackList}
      {activeTrackId}
      onTrackChange={(trackId) => (activeTrackId = trackId)}
      onPlaybackComplete={() => {
        if (isCurrentPlaylistItem) playlist.reportContentEnded("audio-track", track.id);
      }}
    />
  </section>

  <div class="flex items-start justify-between gap-4">
    <div class="flex-1 min-w-0 space-y-2">
      <h1 class="flex items-center gap-2.5 text-text-primary">
        <Music class="h-5 w-5 text-text-accent" />
        {track.title}
      </h1>
      <div class="flex flex-wrap items-center gap-2 text-[0.78rem] text-text-muted">
        {#if track.embeddedArtist}<span>{track.embeddedArtist}</span>{/if}
        {#if track.embeddedAlbum}<span>· {track.embeddedAlbum}</span>{/if}
        {#if track.libraryId}
          <a
            href={`/audio/${track.libraryId}`}
            class="text-text-accent hover:text-accent-300 transition-colors"
          >
            · in library
          </a>
        {/if}
        {#if track.isNsfw}
          <NsfwChip />
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-1.5">
      <button
        type="button"
        onclick={() => (collectionModalOpen = true)}
        aria-label="Add to collection"
        class="inline-flex items-center gap-1.5 px-2.5 py-2 text-[0.78rem] text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
      >
        <FolderPlus class="h-4 w-4" />
      </button>
      {#if !editing}
        <button
          type="button"
          onclick={() => void startEdit()}
          aria-label="Edit track"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-[0.78rem] text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
        >
          <Pencil class="h-4 w-4" />
          Edit track
        </button>
      {/if}
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-4 text-[0.75rem] text-text-muted">
    {#if track.duration != null}
      <span class="inline-flex items-center gap-1 font-mono">
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
      <span class="font-mono">{formatBitRate(track.bitRate)}</span>
    {/if}
    {#if track.sampleRate}
      <span class="font-mono">{(track.sampleRate / 1000).toFixed(1)} kHz</span>
    {/if}
    {#if track.channels}
      <span class="inline-flex items-center gap-1 font-mono">
        <Headphones class="h-3 w-3" />
        {track.channels === 1 ? "Mono" : track.channels === 2 ? "Stereo" : `${track.channels}ch`}
      </span>
    {/if}
    {#if track.fileSize}
      <span class="font-mono">{formatFileSize(track.fileSize)}</span>
    {/if}
  </div>

  <div class="flex gap-0.5">
    <StarRatingPicker value={editing ? editRating : track.rating} onChange={handleRatingChange} />
  </div>

  <section class="surface-panel p-5 space-y-4">
    {#if editing}
      <button
        type="button"
        onclick={() => (editOrganized = !editOrganized)}
        class={cn(
          "inline-flex items-center gap-2 px-3 py-2 text-[0.78rem] transition-colors",
          editOrganized
            ? "bg-accent-950 text-accent-300"
            : "bg-surface-2 text-text-muted hover:text-text-primary",
        )}
      >
        <CheckCircle2 class="h-4 w-4" />
        {editOrganized ? "Organized" : "Mark as organized"}
      </button>
    {:else if track.organized}
      <div class="inline-flex items-center gap-2 bg-accent-950 px-3 py-2 text-[0.78rem] text-accent-300">
        <CheckCircle2 class="h-4 w-4" />
        Organized
      </div>
    {/if}

    {#if editing}
      <button
        type="button"
        onclick={() => (editIsNsfw = !editIsNsfw)}
        class={cn(
          "inline-flex items-center gap-2 px-3 py-2 text-[0.78rem] transition-colors",
          editIsNsfw
            ? "bg-error-muted/60 text-error-text"
            : "bg-surface-2 text-text-muted hover:text-text-primary",
        )}
      >
        {editIsNsfw ? "Marked NSFW" : "Mark as NSFW"}
      </button>
    {/if}

    {#if track.studio}
      <div>
        <div class="text-kicker mb-1">Studio</div>
        <a
          href={`/studios/${track.studio.id}`}
          class="text-[0.78rem] text-text-primary transition-colors hover:text-text-accent"
        >
          {track.studio.name}
        </a>
      </div>
    {/if}

    {#if track.libraryId}
      <div>
        <div class="text-kicker mb-1">Library</div>
        <a
          href={`/audio/${track.libraryId}`}
          class="text-[0.78rem] text-text-accent transition-colors hover:text-accent-300"
        >
          View library
        </a>
      </div>
    {/if}

    <div>
      <div class="text-kicker mb-1">{entityTerms.performers}</div>
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
              class="text-[0.78rem] text-text-primary transition-colors hover:text-text-accent"
            >
              {performer.name}
            </a>
          {/each}
        </div>
      {:else}
        <span class="text-[0.68rem] text-text-disabled">None</span>
      {/if}
    </div>

    <div>
      <div class="text-kicker mb-1">Tags</div>
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
        <span class="text-[0.68rem] text-text-disabled">No tags</span>
      {/if}
    </div>

    {#if track.details}
      <div>
        <div class="text-kicker mb-1">Details</div>
        <p class="whitespace-pre-wrap text-[0.78rem] text-text-secondary">{track.details}</p>
      </div>
    {/if}

    {#if track.playCount > 0}
      <div>
        <div class="text-kicker mb-1">Plays</div>
        <p class="font-mono text-[0.75rem] text-text-muted">
          {track.playCount}
          {#if track.lastPlayedAt}
            — last {new Date(track.lastPlayedAt).toLocaleDateString()}
          {/if}
        </p>
      </div>
    {/if}

    <div class="border-t border-border-subtle pt-3">
      <div class="text-kicker mb-1">File</div>
      <div class="space-y-1 text-[0.74rem] text-text-muted">
        {#if track.container}
          <p>Container: <span class="font-mono text-text-secondary">{track.container}</span></p>
        {/if}
        {#if track.filePath}
          <p class="break-all font-mono">{track.filePath}</p>
        {/if}
      </div>
    </div>

    {#if editing}
      <div class="flex gap-2 pt-2">
        <button
          type="button"
          onclick={() => void handleSave()}
          disabled={saving}
          aria-label="Save track changes"
          class="inline-flex flex-1 items-center justify-center gap-1.5 bg-accent-800 px-3 py-2 text-[0.78rem] text-accent-100 transition-colors hover:bg-accent-700 disabled:opacity-50"
        >
          <Save class="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onclick={() => {
            resetEditState();
            editing = false;
          }}
          class="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[0.78rem] text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
        >
          <XCircle class="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    {/if}
  </section>

  <section class="surface-panel p-5 space-y-2">
    <h2 class="text-label text-text-muted">Technical</h2>
    <dl class="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-body-sm text-text-secondary">
      {#if track.duration}
        <div class="flex gap-2"><dt class="text-text-muted">Length:</dt><dd>{formatDuration(track.duration)}</dd></div>
      {/if}
      {#if track.codec}
        <div class="flex gap-2"><dt class="text-text-muted">Codec:</dt><dd class="font-mono">{track.codec}</dd></div>
      {/if}
      {#if track.bitRate}
        <div class="flex gap-2"><dt class="text-text-muted">Bitrate:</dt><dd>{Math.round(track.bitRate / 1000)} kbps</dd></div>
      {/if}
      {#if track.sampleRate}
        <div class="flex gap-2"><dt class="text-text-muted">Sample:</dt><dd>{track.sampleRate} Hz</dd></div>
      {/if}
      {#if track.channels}
        <div class="flex gap-2"><dt class="text-text-muted">Channels:</dt><dd>{track.channels}</dd></div>
      {/if}
      {#if track.container}
        <div class="flex gap-2"><dt class="text-text-muted">Container:</dt><dd>{track.container}</dd></div>
      {/if}
      {#if track.filePath}
        <div class="flex gap-2 col-span-full"><dt class="text-text-muted">Path:</dt><dd class="font-mono break-all">{track.filePath}</dd></div>
      {/if}
    </dl>
  </section>

  <AddToCollectionModal
    open={collectionModalOpen}
    onClose={() => (collectionModalOpen = false)}
    entityType="audio-track"
    entityId={track.id}
    entityTitle={track.title}
  />
</div>
