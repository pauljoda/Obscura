<script lang="ts">
  import {
    Users,
    Star,
    Film,
    Images,
    Music,
    FolderOpen,
    Image as ImageIcon,
    Edit3,
    X,
    User,
    Globe,
    Calendar,
    Tag as TagIcon,
    FileText,
    Ruler,
  } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { updatePerformer } from "$lib/api/entities";
  import type { VideoListItem } from "$lib/api/types";
  import type {
    VideoSeriesListItemDto,
    GalleryListItemDto,
    ImageListItemDto,
    AudioLibraryListItemDto,
    AudioTrackListItemDto,
    PerformerKnownForDto,
  } from "@obscura/contracts";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import { videoListItemToCardData } from "$lib/video-card-data";
  import InlineRating from "$lib/components/InlineRating.svelte";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import SeriesCard from "$lib/components/SeriesCard.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import ImageThumbnail from "$lib/components/ImageThumbnail.svelte";
  import {
    DateField,
    EditFormShell,
    TextAreaField,
    TextField,
    ToggleChip,
  } from "$lib/components/forms";
  import { formatVideoCount } from "$lib/terminology";

  let { data } = $props();
  let overrideRating = $state<number | null | undefined>(undefined);
  let localPatch = $state<Record<string, unknown>>({});
  let editing = $state(false);
  let savingEdit = $state(false);
  let editError = $state<string | null>(null);
  let editName = $state("");
  let editDisambiguation = $state("");
  let editAliases = $state("");
  let editGender = $state("");
  let editCountry = $state("");
  let editBirthdate = $state("");
  let editEthnicity = $state("");
  let editHeight = $state("");
  let editWeight = $state("");
  let editEyeColor = $state("");
  let editHairColor = $state("");
  let editDetails = $state("");
  let editFavorite = $state(false);
  let editIsNsfw = $state(false);

  const p = $derived((overrideRating === undefined
    ? data.performer
    : { ...(data.performer as Record<string, unknown>), rating: overrideRating }) as Record<string, unknown> & {
    id: string;
    name: string;
    disambiguation?: string | null;
    aliases?: string | null;
    gender?: string | null;
    birthdate?: string | null;
    country?: string | null;
    ethnicity?: string | null;
    height?: string | null;
    weight?: string | null;
    eyeColor?: string | null;
    hairColor?: string | null;
    imagePath?: string | null;
    favorite?: boolean;
    rating?: number | null;
    isNsfw?: boolean;
    videoCount?: number;
    imageAppearanceCount?: number;
    audioLibraryCount?: number;
    details?: string | null;
    knownFor?: PerformerKnownForDto[];
  });
  const patchedP = $derived({ ...p, ...localPatch } as typeof p);

  const videos = $derived(data.videos as VideoListItem[]);
  const series = $derived(data.series as VideoSeriesListItemDto[]);
  const galleries = $derived(data.galleries as GalleryListItemDto[]);
  const images = $derived(data.images as ImageListItemDto[]);
  const audioLibraries = $derived(data.audioLibraries as AudioLibraryListItemDto[]);
  const audioTracks = $derived(data.audioTracks as AudioTrackListItemDto[]);

  function knownForHref(entry: PerformerKnownForDto) {
    return entry.sourceType === "series"
      ? `/series?series=${entry.sourceId}`
      : `/videos/${entry.sourceId}`;
  }

  function knownForContext(entry: PerformerKnownForDto) {
    if (entry.sourceType === "movie") return "Movie";
    if (entry.sourceType === "series") return "Series";

    const episodeNumber =
      entry.seasonNumber !== null && entry.episodeNumber !== null
        ? `S${entry.seasonNumber} E${entry.episodeNumber}`
        : null;
    return [entry.seriesTitle, episodeNumber].filter(Boolean).join(" · ");
  }

  async function handleRatingSave(next: number | null) {
    const previous = (data.performer as { rating?: number | null }).rating ?? null;
    overrideRating = next;
    try {
      await updatePerformer(patchedP.id, { rating: next });
    } catch {
      overrideRating = previous;
      throw new Error("Failed to update rating");
    }
  }

  function nullableTrim(value: string) {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function nullableNumber(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function beginEdit() {
    editName = patchedP.name ?? "";
    editDisambiguation = patchedP.disambiguation ?? "";
    editAliases = patchedP.aliases ?? "";
    editGender = patchedP.gender ?? "";
    editCountry = patchedP.country ?? "";
    editBirthdate = patchedP.birthdate ?? "";
    editEthnicity = patchedP.ethnicity ?? "";
    editHeight = patchedP.height === null || patchedP.height === undefined ? "" : String(patchedP.height);
    editWeight = patchedP.weight === null || patchedP.weight === undefined ? "" : String(patchedP.weight);
    editEyeColor = patchedP.eyeColor ?? "";
    editHairColor = patchedP.hairColor ?? "";
    editDetails = patchedP.details ?? "";
    editFavorite = patchedP.favorite ?? false;
    editIsNsfw = patchedP.isNsfw ?? false;
    editError = null;
    editing = true;
  }

  async function saveEdit() {
    if (!editName.trim() || savingEdit) return;
    savingEdit = true;
    editError = null;
    const patch = {
      name: editName.trim(),
      disambiguation: nullableTrim(editDisambiguation),
      aliases: nullableTrim(editAliases),
      gender: nullableTrim(editGender),
      country: nullableTrim(editCountry),
      birthdate: nullableTrim(editBirthdate),
      ethnicity: nullableTrim(editEthnicity),
      height: nullableNumber(editHeight),
      weight: nullableNumber(editWeight),
      eyeColor: nullableTrim(editEyeColor),
      hairColor: nullableTrim(editHairColor),
      details: nullableTrim(editDetails),
      favorite: editFavorite,
      isNsfw: editIsNsfw,
    };

    try {
      await updatePerformer(patchedP.id, patch);
      localPatch = { ...localPatch, ...patch };
      editing = false;
    } catch (err) {
      editError = err instanceof Error ? err.message : "Failed to save actor";
    } finally {
      savingEdit = false;
    }
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col sm:flex-row gap-4 items-start">
    <div class="w-32 sm:w-40 aspect-[3/4] shrink-0 bg-surface-1 border border-border-subtle overflow-hidden">
      {#if patchedP.imagePath}
        <NsfwBlur isNsfw={patchedP.isNsfw ?? false} class="block h-full w-full">
          <img src={toApiUrl(patchedP.imagePath)} alt={patchedP.name} class="h-full w-full object-cover" />
        </NsfwBlur>
      {:else}
        <div class="flex h-full items-center justify-center">
          <Users class="h-10 w-10 text-text-disabled" />
        </div>
      {/if}
    </div>
    <div class="flex-1 min-w-0 space-y-2">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="flex items-center gap-2.5 text-text-primary flex-wrap">
            <Users class="h-5 w-5 text-text-accent" />
            {patchedP.name}
            {#if patchedP.disambiguation}
              <span class="text-text-muted text-sm">({patchedP.disambiguation})</span>
            {/if}
            {#if patchedP.favorite}
              <Star class="h-4 w-4 text-accent-500 fill-current" />
            {/if}
          </h1>

          {#if patchedP.aliases}
            <p class="text-[0.72rem] text-text-muted mt-1">Aliases: {patchedP.aliases}</p>
          {/if}
        </div>

        <div class="shrink-0 pt-1 flex items-center gap-2">
          <InlineRating
            value={patchedP.rating ?? null}
            onSave={handleRatingSave}
            ariaLabelPrefix="Rate performer with"
          />
          <button
            type="button"
            aria-label={editing ? "Cancel actor edit" : "Edit actor"}
            title={editing ? "Cancel actor edit" : "Edit actor"}
            onclick={() => (editing ? (editing = false) : beginEdit())}
            class="flex h-8 w-8 items-center justify-center border border-border-subtle bg-surface-2 text-text-muted hover:border-border-accent hover:text-text-accent transition-colors duration-fast"
          >
            {#if editing}
              <X class="h-4 w-4" />
            {:else}
              <Edit3 class="h-4 w-4" />
            {/if}
          </button>
        </div>
      </div>

      <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[0.78rem] text-text-secondary mt-2">
        {#if patchedP.gender}
          <div class="flex gap-2">
            <dt class="text-text-muted">Gender:</dt>
            <dd>{patchedP.gender.replaceAll("_", " ")}</dd>
          </div>
        {/if}
        {#if patchedP.country}
          <div class="flex gap-2">
            <dt class="text-text-muted">Country:</dt>
            <dd>{patchedP.country}</dd>
          </div>
        {/if}
        {#if patchedP.birthdate}
          <div class="flex gap-2">
            <dt class="text-text-muted">Born:</dt>
            <dd>{patchedP.birthdate}</dd>
          </div>
        {/if}
        {#if patchedP.ethnicity}
          <div class="flex gap-2">
            <dt class="text-text-muted">Ethnicity:</dt>
            <dd>{patchedP.ethnicity}</dd>
          </div>
        {/if}
        {#if patchedP.height}
          <div class="flex gap-2">
            <dt class="text-text-muted">Height:</dt>
            <dd>{patchedP.height}</dd>
          </div>
        {/if}
        {#if patchedP.weight}
          <div class="flex gap-2">
            <dt class="text-text-muted">Weight:</dt>
            <dd>{patchedP.weight}</dd>
          </div>
        {/if}
        {#if patchedP.eyeColor}
          <div class="flex gap-2">
            <dt class="text-text-muted">Eyes:</dt>
            <dd>{patchedP.eyeColor}</dd>
          </div>
        {/if}
        {#if patchedP.hairColor}
          <div class="flex gap-2">
            <dt class="text-text-muted">Hair:</dt>
            <dd>{patchedP.hairColor}</dd>
          </div>
        {/if}
      </dl>

      <div class="flex flex-wrap gap-1 pt-1">
        {#if (patchedP.videoCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {patchedP.videoCount} {patchedP.videoCount === 1 ? "video" : "videos"}
            {/snippet}
          </Badge>
        {/if}
        {#if (patchedP.imageAppearanceCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {patchedP.imageAppearanceCount} {patchedP.imageAppearanceCount === 1 ? "image" : "images"}
            {/snippet}
          </Badge>
        {/if}
        {#if (patchedP.audioLibraryCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {patchedP.audioLibraryCount} {patchedP.audioLibraryCount === 1 ? "album" : "albums"}
            {/snippet}
          </Badge>
        {/if}
        {#if patchedP.isNsfw}
          <Badge variant="warning">
            {#snippet children()}NSFW{/snippet}
          </Badge>
        {/if}
      </div>

      {#if patchedP.details}
        <p class="mt-3 text-[0.82rem] text-text-secondary leading-relaxed max-w-2xl">
          {patchedP.details}
        </p>
      {/if}
    </div>
  </div>

  {#if editing}
    <div class="max-w-4xl">
      <EditFormShell
        title="Actor metadata"
        onSave={saveEdit}
        onCancel={() => (editing = false)}
        saving={savingEdit}
        saveDisabled={!editName.trim()}
        saveLabel="Save actor"
        error={editError}
      >
        <div class="grid gap-4 md:grid-cols-2">
          <TextField label="Name" icon={User} value={editName} onChange={(v) => (editName = v)} required />
          <TextField label="Disambiguation" value={editDisambiguation} onChange={(v) => (editDisambiguation = v)} />
        </div>
        <TextAreaField
          label="Details"
          icon={FileText}
          value={editDetails}
          onChange={(v) => (editDetails = v)}
          rows={4}
        />
        <div class="grid gap-4 md:grid-cols-2">
          <TextField label="Aliases" icon={TagIcon} value={editAliases} onChange={(v) => (editAliases = v)} />
          <TextField label="Gender" icon={Users} value={editGender} onChange={(v) => (editGender = v)} />
          <TextField label="Country" icon={Globe} value={editCountry} onChange={(v) => (editCountry = v)} />
          <DateField label="Birthdate" icon={Calendar} value={editBirthdate} onChange={(v) => (editBirthdate = v)} />
          <TextField label="Ethnicity" value={editEthnicity} onChange={(v) => (editEthnicity = v)} />
          <TextField label="Eyes" value={editEyeColor} onChange={(v) => (editEyeColor = v)} />
          <TextField label="Hair" value={editHairColor} onChange={(v) => (editHairColor = v)} />
          <TextField
            label="Height"
            icon={Ruler}
            type="number"
            value={editHeight}
            onChange={(v) => (editHeight = v)}
          />
          <TextField
            label="Weight"
            type="number"
            value={editWeight}
            onChange={(v) => (editWeight = v)}
          />
        </div>
        <div class="flex flex-wrap gap-2">
          <ToggleChip value={editFavorite} onChange={(v) => (editFavorite = v)} onLabel="Favorite" icon={Star} />
          <ToggleChip
            value={editIsNsfw}
            onChange={(v) => (editIsNsfw = v)}
            onLabel="NSFW"
            variant="warning"
          />
        </div>
      </EditFormShell>
    </div>
  {/if}

  {#if patchedP.knownFor && patchedP.knownFor.length > 0}
    <HierarchySection title="Known For">
      {#snippet children()}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {#each patchedP.knownFor as entry (`${entry.sourceType}:${entry.sourceId}`)}
            {@const href = knownForHref(entry)}
            <a
              {href}
              class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
            >
              <div class="aspect-[2/3] bg-surface-2">
                {#if entry.thumbnailPath || entry.cardThumbnailPath}
                  <img
                    src={toApiUrl(entry.cardThumbnailPath ?? entry.thumbnailPath)}
                    alt=""
                    loading="lazy"
                    class="h-full w-full object-cover"
                  />
                {:else}
                  <div class="flex h-full w-full items-center justify-center text-text-disabled">
                    <FolderOpen class="h-8 w-8" />
                  </div>
                {/if}
              </div>
              <div class="p-2 space-y-0.5">
                <h4 class="truncate text-[0.78rem] font-medium text-text-primary">
                  {entry.sourceTitle}
                </h4>
                <p class="truncate text-[0.65rem] text-text-disabled">
                  {knownForContext(entry)}
                </p>
                {#if entry.character}
                  <p class="truncate text-[0.65rem] text-text-muted">as {entry.character}</p>
                {/if}
              </div>
            </a>
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if videos.length > 0}
    <HierarchySection title={`${data.totalVideos} ${data.totalVideos === 1 ? "video" : "videos"}`}>
      {#snippet children()}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {#each videos as v, i (v.id)}
            <VideoCard
              video={videoListItemToCardData(v, `/performers/${patchedP.id}`)}
              variant="grid"
              index={i}
              imageLoading={i < 6 ? "eager" : "lazy"}
            />
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {:else}
    <HierarchySection title="Videos">
      {#snippet children()}
        <div class="surface-panel p-8 text-center">
          <Film class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
          <p class="text-body text-text-muted">No videos yet.</p>
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if series.length > 0}
    <HierarchySection title={`Series — ${formatVideoCount(data.totalSeries)}`}>
      {#snippet children()}
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {#each series as s (s.id)}
            <SeriesCard series={s} href={`/series?series=${s.id}`} compact />
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if galleries.length > 0}
    <HierarchySection title="Galleries">
      {#snippet children()}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {#each galleries as g (g.id)}
            <a
              href={`/galleries/${g.id}`}
              class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
            >
              <NsfwBlur isNsfw={g.isNsfw} class="block">
                <div class="aspect-[3/4] bg-surface-1 relative">
                  {#if g.coverImagePath}
                    <img
                      src={toApiUrl(g.coverImagePath)}
                      alt=""
                      loading="lazy"
                      class="h-full w-full object-cover"
                    />
                  {:else}
                    <div class="flex h-full items-center justify-center">
                      <Images class="h-8 w-8 text-text-disabled" />
                    </div>
                  {/if}
                </div>
              </NsfwBlur>
              <div class="p-2.5">
                <h3 class="truncate text-sm font-medium">{g.title}</h3>
                <p class="text-xs text-text-muted mt-0.5">
                  {g.imageCount} image{g.imageCount === 1 ? "" : "s"}
                </p>
              </div>
            </a>
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if images.length > 0}
    <HierarchySection title={`Images — ${data.totalImages}`}>
      {#snippet children()}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
          {#each images as img (img.id)}
            <a
              href={`/images/${img.id}`}
              class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
            >
              <ImageThumbnail
                title={img.title}
                thumbnailPath={img.thumbnailPath}
                previewPath={img.previewPath}
                isVideo={img.isVideo}
                isNsfw={img.isNsfw}
                width={img.width}
                height={img.height}
                size="grid"
              />
              <div class="p-2">
                <h3 class="truncate text-[0.78rem] font-medium text-text-primary">
                  {img.title}
                </h3>
              </div>
            </a>
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if audioLibraries.length > 0}
    <HierarchySection title="Audio">
      {#snippet children()}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {#each audioLibraries as a (a.id)}
            <a
              href={`/audio/${a.id}`}
              class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
            >
              <NsfwBlur isNsfw={a.isNsfw} class="block">
                <div class="aspect-square bg-surface-1">
                  {#if a.coverImagePath}
                    <img
                      src={toApiUrl(a.coverImagePath)}
                      alt=""
                      loading="lazy"
                      class="h-full w-full object-cover"
                    />
                  {:else}
                    <div class="flex h-full items-center justify-center">
                      <Music class="h-8 w-8 text-text-disabled" />
                    </div>
                  {/if}
                </div>
              </NsfwBlur>
              <div class="p-2.5">
                <h3 class="truncate text-sm font-medium">{a.title}</h3>
                <p class="text-xs text-text-muted mt-0.5">
                  {a.trackCount} track{a.trackCount === 1 ? "" : "s"}
                </p>
              </div>
            </a>
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if audioTracks.length > 0}
    <HierarchySection title={`Tracks — ${data.totalAudioTracks}`}>
      {#snippet children()}
        <div class="surface-panel divide-y divide-border-subtle overflow-hidden">
          {#each audioTracks as track (track.id)}
            <a
              href={`/audio/tracks/${track.id}`}
              class="flex items-center gap-3 px-3 py-2 hover:bg-surface-2 transition-colors duration-fast"
            >
              <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-surface-2 text-text-accent">
                <Music class="h-4 w-4" />
              </span>
              <div class="min-w-0 flex-1">
                <h3 class="truncate text-[0.82rem] font-medium text-text-primary">
                  {track.title}
                </h3>
                <p class="truncate text-[0.65rem] text-text-muted">
                  {track.embeddedAlbum ?? "Audio track"}
                </p>
              </div>
            </a>
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}
</div>
