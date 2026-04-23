<script lang="ts">
  import { cn } from "@obscura/ui-svelte";
  import {
    Music,
    Play,
    Shuffle,
    Calendar,
    Building2,
    HardDrive,
    Edit2,
    Save,
    XCircle,
    CheckCircle2,
    FolderPlus,
    MoreVertical,
    Loader2,
  } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import {
    deleteAudioTrack,
    updateAudioLibrary,
    updateAudioTrack,
  } from "$lib/api/media";
  import {
    fetchPerformers,
    fetchStudios,
    fetchTags,
  } from "$lib/api/entities";
  import AudioPlayer from "$lib/components/AudioPlayer.svelte";
  import AddToCollectionModal from "$lib/components/AddToCollectionModal.svelte";
  import ChipInput from "$lib/components/ChipInput.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import NsfwShowModeChip from "$lib/components/NsfwShowModeChip.svelte";
  import PerformersSection from "$lib/components/PerformersSection.svelte";
  import StarRatingPicker from "$lib/components/StarRatingPicker.svelte";
  import TagsSection from "$lib/components/TagsSection.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import TrackListRow from "$lib/components/TrackListRow.svelte";
  import { useAppChrome } from "$lib/stores/app-chrome.svelte";
  import { useNsfw } from "$lib/stores/nsfw.svelte";

  let { data } = $props();
  const appChrome = useAppChrome();
  const nsfw = useNsfw();
  let overrideLibrary = $state<typeof data.library | null>(null);
  const library = $derived(overrideLibrary ?? data.library);

  $effect(() => {
    data.library.id;
    data.library.updatedAt;
    overrideLibrary = null;
    resetFormFromLibrary(data.library);
    if (activeTrackId && !data.library.tracks.some((track) => track.id === activeTrackId)) {
      activeTrackId = null;
      playing = false;
    }
  });

  function formatDuration(sec: number | null | undefined) {
    if (!sec) return null;
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    const h = Math.floor(m / 60);
    if (h > 0) {
      return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  let activeTrackId = $state<string | null>(null);
  let playing = $state(false);
  let shufflePlayKey = $state(0);
  let editMode = $state(false);
  let saving = $state(false);
  let loadError = $state<string | null>(null);
  let editError = $state<string | null>(null);
  let moreActionsOpen = $state(false);
  let collectionModalOpen = $state(false);
  let suggestionsReady = $state(false);
  let trackDeleteLoading = $state(false);
  let trackDeleteTarget = $state<{
    id: string;
    title: string;
    duration: number | null;
  } | null>(null);
  let title = $state("");
  let details = $state("");
  let date = $state("");
  let rating = $state<number | null>(null);
  let isNsfw = $state(false);
  let organized = $state(false);
  let studioName = $state("");
  let performerNames = $state<string[]>([]);
  let tagNames = $state<string[]>([]);
  let performerOptions = $state<
    { id: string; name: string; videoCount: number; imagePath?: string | null; gender?: string | null }[]
  >([]);
  let tagOptions = $state<
    { id: string; name: string; isNsfw: boolean; videoCount: number; imageCount?: number | null }[]
  >([]);
  let studioOptions = $state<{ id: string; name: string; url: string | null }[]>([]);

  const visibleTracks = $derived(
    library.tracks.filter((track) => nsfw.mode !== "off" || !track.isNsfw),
  );
  const visibleTrackCount = $derived(visibleTracks.length);
  const visibleDuration = $derived(
    visibleTracks.reduce((sum, track) => sum + (track.duration ?? 0), 0),
  );
  const collectionItems = $derived(
    visibleTracks.map((track) => ({ entityType: "audio-track" as const, entityId: track.id })),
  );
  const performerSuggestions = $derived(
    performerOptions.map((performer) => ({
      name: performer.name,
      count: performer.videoCount,
    })),
  );
  const tagSuggestions = $derived(
    tagOptions.map((tag) => ({
      name: tag.name,
      count: tag.videoCount + (tag.imageCount ?? 0),
    })),
  );

  function resetFormFromLibrary(source = library) {
    title = source.title;
    details = source.details ?? "";
    date = source.date ?? "";
    rating = source.rating;
    isNsfw = source.isNsfw;
    organized = source.organized;
    studioName = source.studio?.name ?? "";
    performerNames = source.performers.map((performer) => performer.name);
    tagNames = source.tags.map((tag) => tag.name);
  }

  function playTrack(id: string) {
    activeTrackId = id;
    playing = true;
  }

  async function beginEdit() {
    editMode = true;
    editError = null;
    loadError = null;
    suggestionsReady = false;
    resetFormFromLibrary();

    try {
      const [tagsResponse, performersResponse, studiosResponse] = await Promise.all([
        fetchTags({ nsfw: nsfw.mode }),
        fetchPerformers({ nsfw: nsfw.mode, limit: 500 }),
        fetchStudios({ nsfw: nsfw.mode }),
      ]);
      tagOptions = tagsResponse.tags;
      performerOptions = performersResponse.performers;
      studioOptions = studiosResponse.studios;
      suggestionsReady = true;
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Failed to load suggestions";
      suggestionsReady = true;
    }
  }

  function cancelEdit() {
    editMode = false;
    editError = null;
    loadError = null;
    resetFormFromLibrary();
  }

  function buildPerformerEmbeds(names: string[]) {
    return names.map((name) => {
      const existing =
        library.performers.find((performer) => performer.name.toLowerCase() === name.toLowerCase()) ??
        performerOptions.find((performer) => performer.name.toLowerCase() === name.toLowerCase());
      return {
        id: existing?.id ?? `local-performer-${name.toLowerCase()}`,
        name,
        gender: existing?.gender ?? null,
        imagePath: existing?.imagePath ?? null,
      };
    });
  }

  function buildTagEmbeds(names: string[]) {
    return names.map((name) => {
      const existing =
        library.tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase()) ??
        tagOptions.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
      return {
        id: existing?.id ?? `local-tag-${name.toLowerCase()}`,
        name,
        isNsfw: existing?.isNsfw ?? false,
      };
    });
  }

  function buildStudioEmbed(name: string) {
    if (!name.trim()) return null;

    const existing: { id: string; name: string; url: string | null } | null =
      library.studio?.name.toLowerCase() === name.toLowerCase()
        ? library.studio
        : studioOptions.find((studio) => studio.name.toLowerCase() === name.toLowerCase()) ?? null;

    return existing
      ? { id: existing.id, name: existing.name, url: "url" in existing ? existing.url : null }
      : { id: `local-studio-${name.toLowerCase()}`, name, url: null };
  }

  async function handleSave() {
    if (!title.trim()) return;
    saving = true;
    editError = null;
    const nextTitle = title.trim();
    const nextDetails = details.trim() || null;
    const nextDate = date.trim() || null;
    const nextStudioName = studioName.trim();
    const nextPerformerNames = [...performerNames];
    const nextTagNames = [...tagNames];

    try {
      await updateAudioLibrary(library.id, {
        title: nextTitle,
        details: nextDetails,
        date: nextDate,
        rating,
        organized,
        isNsfw,
        studioName: nextStudioName || null,
        performerNames: nextPerformerNames,
        tagNames: nextTagNames,
      });
      overrideLibrary = {
        ...library,
        title: nextTitle,
        details: nextDetails,
        date: nextDate,
        rating,
        organized,
        isNsfw,
        studio: buildStudioEmbed(nextStudioName),
        performers: buildPerformerEmbeds(nextPerformerNames),
        tags: buildTagEmbeds(nextTagNames),
        updatedAt: new Date().toISOString(),
      };
      editMode = false;
    } catch (error) {
      editError = error instanceof Error ? error.message : "Failed to save library changes";
    } finally {
      saving = false;
    }
  }

  async function handleTrackRating(trackId: string, nextRating: number | null) {
    const previousTrack = library.tracks.find((track) => track.id === trackId);
    if (!previousTrack) return;

      overrideLibrary = {
        ...library,
        tracks: library.tracks.map((track) =>
          track.id === trackId ? { ...track, rating: nextRating } : track,
        ),
      };

    try {
      await updateAudioTrack(trackId, { rating: nextRating });
    } catch {
      overrideLibrary = {
        ...library,
        tracks: library.tracks.map((track) =>
          track.id === trackId ? { ...track, rating: previousTrack.rating } : track,
        ),
      };
    }
  }

  async function confirmTrackDelete(deleteFromDisk: boolean) {
    if (!trackDeleteTarget) return;
    trackDeleteLoading = true;
    const deleteId = trackDeleteTarget.id;
    const deleteDuration = trackDeleteTarget.duration ?? 0;
    const nextTracks = library.tracks.filter((track) => track.id !== deleteId);

    try {
      await deleteAudioTrack(deleteId, deleteFromDisk);
      overrideLibrary = {
        ...library,
        tracks: nextTracks,
        trackCount: Math.max(0, library.trackCount - 1),
        trackTotal: Math.max(0, library.trackTotal - 1),
        totalDuration:
          library.totalDuration == null ? null : Math.max(0, library.totalDuration - deleteDuration),
        updatedAt: new Date().toISOString(),
      };
      if (activeTrackId === deleteId) {
        activeTrackId = playing ? (nextTracks[0]?.id ?? null) : null;
        if (nextTracks.length === 0) playing = false;
      }
      trackDeleteTarget = null;
    } finally {
      trackDeleteLoading = false;
    }
  }
</script>

<svelte:head>
  <title>{library.title} — Audio — Obscura</title>
</svelte:head>

<div class="space-y-6 pb-64 md:pb-60">
  <!-- ─── Hero ─────────────────────────────────────────────────── -->
  <section class="relative isolate overflow-hidden border border-border-subtle">
    <!-- Blurred cover backdrop -->
    <div class="pointer-events-none absolute inset-0 -z-10">
      {#if library.coverImagePath}
        <img
          src={toApiUrl(library.coverImagePath)}
          alt=""
          aria-hidden="true"
          class="h-full w-full object-cover scale-110 blur-3xl opacity-40"
          decoding="async"
        />
      {:else}
        <div class="h-full w-full bg-gradient-to-br from-accent-900 via-surface-1 to-surface-bg"></div>
      {/if}
      <div class="absolute inset-0 bg-gradient-to-b from-black/35 via-black/60 to-[var(--color-surface-bg)]"></div>
    </div>

    <div class="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:gap-7 sm:p-7">
      <!-- Cover art -->
      <div class="relative h-36 w-36 flex-shrink-0 overflow-hidden border border-border-default bg-surface-2 shadow-[0_20px_60px_rgba(0,0,0,0.55)] sm:h-44 sm:w-44 md:h-48 md:w-48">
        <NsfwBlur isNsfw={library.isNsfw} class="h-full w-full">
          <div class="relative h-full w-full">
            {#if library.coverImagePath}
              <img
                src={toApiUrl(library.coverImagePath)}
                alt={library.title}
                class="h-full w-full object-cover"
                decoding="async"
              />
            {:else}
              <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent-800/40 via-surface-2 to-surface-3">
                <Music class="h-14 w-14 text-accent-400/40" />
              </div>
            {/if}
            <div class="pointer-events-none absolute bottom-1 right-1 z-10 flex flex-col items-end gap-1">
              <NsfwShowModeChip isNsfw={library.isNsfw} />
            </div>
          </div>
        </NsfwBlur>
      </div>

      <!-- Title + meta -->
      <div class="min-w-0 flex-1 space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1 space-y-2">
            <div class="flex items-center gap-2 text-kicker">
              <Music class="h-3 w-3" />
              Audio Library
              {#if library.isNsfw}
                <span class="ml-1"><Badge variant="warning">NSFW</Badge></span>
              {/if}
            </div>
            {#if editMode}
              <input
                bind:value={title}
                class="w-full min-w-0 border border-border-subtle bg-surface-2/70 px-3 py-2 text-2xl font-heading font-semibold text-text-primary backdrop-blur-sm focus:border-border-accent focus:outline-none sm:text-3xl"
                placeholder="Library title"
              />
            {:else}
              <h1 class="font-heading text-3xl font-semibold leading-tight text-text-primary drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] sm:text-4xl md:text-5xl">
                {library.title}
              </h1>
            {/if}
          </div>

          <div class="relative flex flex-shrink-0 items-center gap-1">
            {#if editMode}
              <button
                type="button"
                onclick={cancelEdit}
                disabled={saving}
                class="inline-flex items-center gap-1.5 border border-border-subtle bg-surface-2/70 px-3 py-2 text-[0.78rem] text-text-muted backdrop-blur-sm transition-colors hover:text-text-primary disabled:opacity-50"
              >
                <XCircle class="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                onclick={() => void handleSave()}
                disabled={saving || !title.trim()}
                aria-label="Save changes"
                class="inline-flex items-center gap-1.5 border border-border-accent bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900 px-3 py-2 text-[0.78rem] text-accent-100 shadow-[var(--shadow-glow-accent)] transition-all disabled:opacity-50"
              >
                {#if saving}
                  <Loader2 class="h-4 w-4 animate-spin" />
                {:else}
                  <Save class="h-4 w-4" />
                {/if}
                Save
              </button>
            {:else}
              <button
                type="button"
                onclick={() => void beginEdit()}
                aria-label="Edit library"
                class="inline-flex items-center gap-1.5 border border-border-subtle bg-surface-2/70 px-3 py-2 text-[0.78rem] text-text-muted backdrop-blur-sm transition-colors hover:border-border-accent hover:text-text-primary"
              >
                <Edit2 class="h-4 w-4" />
                <span class="hidden sm:inline">Edit</span>
              </button>
              {#if visibleTracks.length > 0}
                <button
                  type="button"
                  onclick={() => (moreActionsOpen = !moreActionsOpen)}
                  aria-label="More library actions"
                  class="inline-flex items-center gap-1.5 border border-border-subtle bg-surface-2/70 px-2.5 py-2 text-[0.78rem] text-text-muted backdrop-blur-sm transition-colors hover:border-border-accent hover:text-text-primary"
                >
                  <MoreVertical class="h-4 w-4" />
                </button>
              {/if}
              {#if moreActionsOpen}
                <button
                  type="button"
                  class="fixed inset-0 z-40 cursor-default bg-transparent"
                  onclick={() => (moreActionsOpen = false)}
                  aria-label="Close library actions"
                ></button>
                <div class="absolute right-0 top-full z-50 mt-1 min-w-56 surface-elevated py-1">
                  <button
                    type="button"
                    onclick={() => {
                      moreActionsOpen = false;
                      collectionModalOpen = true;
                    }}
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-[0.78rem] text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
                  >
                    <FolderPlus class="h-4 w-4" />
                    Add tracks to collection
                  </button>
                </div>
              {/if}
            {/if}
          </div>
        </div>

        {#if !editMode}
          <!-- Meta strip -->
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem] text-text-secondary">
            <span class="inline-flex items-center gap-1 font-medium text-text-primary">
              <Music class="h-3 w-3" />
              {visibleTrackCount} track{visibleTrackCount === 1 ? "" : "s"}
            </span>
            {#if visibleDuration > 0}
              <span class="text-text-disabled">•</span>
              <span class="inline-flex items-center gap-1 font-mono tabular-nums text-text-muted">
                {formatDuration(visibleDuration)}
              </span>
            {/if}
            {#if library.studio}
              <span class="text-text-disabled">•</span>
              <a
                href={`/studios/${encodeURIComponent(library.studio.name)}`}
                class="inline-flex items-center gap-1 text-text-accent transition-colors hover:text-accent-200"
              >
                <Building2 class="h-3 w-3" />
                {library.studio.name}
              </a>
            {/if}
            {#if library.date}
              <span class="text-text-disabled">•</span>
              <span class="inline-flex items-center gap-1 text-text-muted">
                <Calendar class="h-3 w-3" />
                {library.date.slice(0, 10)}
              </span>
            {/if}
            {#if library.organized}
              <span class="text-text-disabled">•</span>
              <span class="inline-flex items-center gap-1 text-accent-300">
                <CheckCircle2 class="h-3 w-3" />
                Organized
              </span>
            {/if}
          </div>

          {#if library.rating != null || library.details}
            <div class="space-y-2">
              {#if library.rating != null}
                <StarRatingPicker value={library.rating} readOnly />
              {/if}
              {#if library.details}
                <p class="max-w-2xl whitespace-pre-wrap text-[0.82rem] leading-relaxed text-text-secondary">
                  {library.details}
                </p>
              {/if}
            </div>
          {/if}

          <!-- Action strip -->
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onclick={() => visibleTracks[0] && playTrack(visibleTracks[0].id)}
              disabled={visibleTracks.length === 0}
              class="inline-flex items-center gap-2 border border-border-accent bg-gradient-to-br from-accent-500 to-accent-700 px-5 py-2 text-[0.82rem] font-medium text-bg shadow-[var(--shadow-glow-accent-strong)] transition-all duration-normal disabled:cursor-not-allowed disabled:opacity-40 hover:from-accent-400 hover:to-accent-600"
            >
              <Play class="h-4 w-4" fill="currentColor" />
              Play All
            </button>
            <button
              type="button"
              onclick={() => {
                if (visibleTracks.length > 0) shufflePlayKey += 1;
              }}
              disabled={visibleTracks.length === 0}
              class="inline-flex items-center gap-1.5 border border-border-subtle bg-surface-2/60 px-4 py-2 text-[0.78rem] text-text-muted backdrop-blur-sm transition-colors hover:border-border-accent hover:text-text-primary disabled:opacity-40"
            >
              <Shuffle class="h-3.5 w-3.5" />
              Shuffle
            </button>
          </div>
        {/if}
      </div>
    </div>
  </section>

  {#if editMode}
    <!-- Edit form below hero -->
    <section class="surface-panel p-5 space-y-4">
      <div>
        <div class="mb-1.5 text-kicker">Description</div>
        <textarea
          bind:value={details}
          rows="4"
          class="min-h-[5rem] w-full resize-y border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-border-accent focus:outline-none"
        ></textarea>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <label class="space-y-1.5">
          <span class="text-kicker inline-flex items-center gap-2">
            <Calendar class="h-3.5 w-3.5" />
            Date
          </span>
          <input
            type="date"
            bind:value={date}
            class="w-full border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-border-accent focus:outline-none"
          />
        </label>
        <label class="space-y-1.5">
          <span class="text-kicker inline-flex items-center gap-2">
            <Building2 class="h-3.5 w-3.5" />
            Studio
          </span>
          <input
            bind:value={studioName}
            list="audio-library-studio-options"
            class="w-full border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-border-accent focus:outline-none"
            placeholder="Studio name"
            disabled={!suggestionsReady}
          />
          <datalist id="audio-library-studio-options">
            {#each studioOptions as studio (studio.id)}
              <option value={studio.name}></option>
            {/each}
          </datalist>
        </label>
      </div>
      <div class="space-y-1.5">
        <div class="text-kicker">Rating</div>
        <StarRatingPicker value={rating} onChange={(next) => (rating = next)} />
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          onclick={() => (organized = !organized)}
          class={cn(
            "inline-flex items-center gap-2 px-3 py-2 text-[0.78rem] transition-colors",
            organized
              ? "bg-accent-950 text-accent-300 border border-border-accent"
              : "bg-surface-2 text-text-muted border border-border-subtle hover:text-text-primary",
          )}
        >
          <CheckCircle2 class="h-4 w-4" />
          {organized ? "Marked organized" : "Mark as organized"}
        </button>
        <button
          type="button"
          onclick={() => (isNsfw = !isNsfw)}
          class={cn(
            "inline-flex items-center gap-2 px-3 py-2 text-[0.78rem] transition-colors",
            isNsfw
              ? "bg-error-muted/60 text-error-text border border-error/40"
              : "bg-surface-2 text-text-muted border border-border-subtle hover:text-text-primary",
          )}
        >
          {isNsfw ? "Marked NSFW" : "Mark as NSFW"}
        </button>
      </div>
      {#if loadError}
        <p class="text-[0.72rem] text-amber-300">{loadError}</p>
      {/if}
      {#if editError}
        <p class="text-[0.72rem] text-error-text">{editError}</p>
      {/if}
    </section>
  {/if}

  {#if library.folderPath}
    <p class="flex items-center gap-2 break-all font-mono text-[0.68rem] text-text-disabled" title={library.folderPath}>
      <HardDrive class="h-3 w-3 flex-shrink-0" />
      {library.folderPath}
    </p>
  {/if}

  {#if editMode}
    <section class="space-y-3">
      <div>
        <h2 class="mb-2 text-kicker">Artists</h2>
        <ChipInput
          values={performerNames}
          onChange={(next) => (performerNames = next)}
          suggestions={performerSuggestions}
          placeholder="Add artist..."
        />
      </div>
      <div>
        <h2 class="mb-2 text-kicker">Tags</h2>
        <ChipInput
          values={tagNames}
          onChange={(next) => (tagNames = next)}
          suggestions={tagSuggestions}
          placeholder="Add tag..."
        />
      </div>
    </section>
  {:else}
    <div class="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <PerformersSection
        performers={library.performers}
        parentIsNsfw={library.isNsfw}
        headingLabel="Artists"
      />
      <TagsSection tags={library.tags} />
    </div>
  {/if}

  {#if library.children.length > 0}
    <section class="space-y-3">
      <h2 class="text-kicker">Sub-Libraries</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {#each library.children.filter((child) => nsfw.mode !== "off" || !child.isNsfw) as child (child.id)}
          <a
            href={`/audio/${child.id}`}
            class="overflow-hidden surface-card-sharp transition-colors hover:border-border-accent"
          >
            <NsfwBlur isNsfw={child.isNsfw} class="relative aspect-square overflow-hidden">
              {#if child.coverImagePath}
                <img
                  src={toApiUrl(child.coverImagePath)}
                  alt={child.title}
                  class="h-full w-full object-cover"
                  loading="lazy"
                />
              {:else}
                <div class="flex h-full w-full items-center justify-center bg-surface-2">
                  <Music class="h-10 w-10 text-text-disabled" />
                </div>
              {/if}
              <div class="pointer-events-none absolute bottom-1 right-1 z-10 flex flex-col items-end gap-1">
                <NsfwShowModeChip isNsfw={child.isNsfw} />
              </div>
            </NsfwBlur>
            <div class="space-y-1 p-2">
              <h3 class="truncate text-sm font-medium text-text-primary">{child.title}</h3>
              <p class="text-[0.68rem] text-text-muted">
                {child.trackCount} track{child.trackCount === 1 ? "" : "s"}
              </p>
            </div>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <div class="grid grid-cols-1 gap-5">
    <div class="min-w-0 space-y-2">
      <HierarchySection title={`Tracks — ${visibleTrackCount}`}>
        {#if visibleTracks.length === 0}
          <div class="surface-panel p-8 text-center text-sm text-text-muted">
            No tracks in this library
          </div>
        {:else}
          <div class="surface-panel overflow-hidden">
            <div class="grid grid-cols-[2rem_minmax(0,1fr)_auto_3rem_1.75rem] items-center gap-3 border-b border-border-subtle/80 px-3 py-2 text-[0.62rem] uppercase tracking-[0.18em] text-text-disabled sm:px-4">
              <span class="text-center">#</span>
              <span>Title</span>
              <span class="justify-self-end">Rating</span>
              <span class="justify-self-end">Time</span>
              <span class="sr-only">Actions</span>
            </div>
            <div class="divide-y divide-border-subtle/60">
              {#each visibleTracks as track, index (track.id)}
                <TrackListRow
                  {track}
                  {index}
                  isActive={activeTrackId === track.id}
                  isPlaying={activeTrackId === track.id && playing}
                  onPlay={playTrack}
                  onRatingChange={(id, value) => void handleTrackRating(id, value)}
                  onDelete={(t) =>
                    (trackDeleteTarget = {
                      id: t.id,
                      title: t.title,
                      duration: t.duration ?? null,
                    })}
                  trackHref={`/audio/tracks/${track.id}`}
                  ratingAriaPrefix={index === 0 ? "Set" : `Rate ${track.title} with`}
                />
              {/each}
            </div>
          </div>
        {/if}

        {#if library.trackTotal > visibleTracks.length}
          <p class="mt-2 text-center text-[0.78rem] text-text-muted">
            Showing {visibleTracks.length} of {library.trackTotal}.
          </p>
        {/if}
      </HierarchySection>
    </div>
  </div>

  {#if trackDeleteTarget}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        class="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onclick={() => {
          if (!trackDeleteLoading) trackDeleteTarget = null;
        }}
        aria-label="Close delete track dialog"
      ></button>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete track"
        class="relative z-10 w-full max-w-md surface-elevated p-6"
      >
        <div class="space-y-2">
          <h2 class="text-base font-heading font-semibold text-text-primary">
            Delete {trackDeleteTarget.title}
          </h2>
          <p class="text-[0.8rem] leading-relaxed text-text-muted">
            Remove this track from the library, or delete the source file from disk as well. This
            action cannot be undone.
          </p>
        </div>

        <div class="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onclick={() => void confirmTrackDelete(false)}
            disabled={trackDeleteLoading}
            class="inline-flex w-full items-center justify-center gap-2 bg-error-muted/60 px-3 py-2 text-sm font-medium text-error-text transition-colors hover:bg-error-muted disabled:opacity-50"
          >
            {#if trackDeleteLoading}
              <Loader2 class="h-4 w-4 animate-spin" />
            {/if}
            Remove from library
          </button>
          <button
            type="button"
            onclick={() => void confirmTrackDelete(true)}
            disabled={trackDeleteLoading}
            class="inline-flex w-full items-center justify-center gap-2 border border-error/40 px-3 py-2 text-sm font-medium text-error-text transition-colors hover:bg-error-muted/20 disabled:opacity-50"
          >
            Delete from disk
          </button>
          <button
            type="button"
            onclick={() => (trackDeleteTarget = null)}
            disabled={trackDeleteLoading}
            class="inline-flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if visibleTracks.length > 0}
    <AddToCollectionModal
      open={collectionModalOpen}
      onClose={() => (collectionModalOpen = false)}
      entityType="audio-track"
      entityId={visibleTracks[0]?.id ?? ""}
      entityTitle={library.title}
      items={collectionItems}
    />
  {/if}
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
      tracks={visibleTracks}
      {activeTrackId}
      onTrackChange={(trackId) => {
        activeTrackId = trackId;
        playing = true;
      }}
      onPlayingChange={(isPlaying) => (playing = isPlaying)}
      libraryCoverUrl={toApiUrl(library.coverImagePath)}
      {shufflePlayKey}
      class="border-0 bg-transparent shadow-none"
    />
  </div>
</div>
