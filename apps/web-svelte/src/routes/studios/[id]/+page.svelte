<script lang="ts">
  import {
    AlertTriangle,
    Building2,
    Edit3,
    ExternalLink,
    FileText,
    Film,
    Images,
    Link,
    Music,
    Star,
    Tag as TagIcon,
    X,
  } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { updateStudio } from "$lib/api/entities";
  import type { VideoListItem } from "$lib/api/types";
  import type {
    VideoSeriesListItemDto,
    GalleryListItemDto,
    AudioLibraryListItemDto,
  } from "@obscura/contracts";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import GalleryThumbnail from "$lib/components/GalleryThumbnail.svelte";
  import { videoListItemToCardData } from "$lib/video-card-data";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import SeriesCard from "$lib/components/SeriesCard.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import {
    EditFormShell,
    FormField,
    SearchSelect,
    TextAreaField,
    TextField,
    ToggleChip,
  } from "$lib/components/forms";
  import { buildStudioEditPatch } from "$lib/entity-edit-patch";

  type StudioPageStudio = {
    id: string;
    name: string;
    description?: string | null;
    url?: string | null;
    imagePath?: string | null;
    imageUrl?: string | null;
    aliases?: string | null;
    favorite?: boolean;
    rating?: number | null;
    isNsfw?: boolean;
    videoCount?: number;
    imageAppearanceCount?: number;
    audioLibraryCount?: number;
    parentId?: string | null;
    parent?: { id: string; name: string } | null;
  };

  let { data } = $props();
  let localPatch = $state<Record<string, unknown>>({});
  let editing = $state(false);
  let savingEdit = $state(false);
  let editError = $state<string | null>(null);
  let editName = $state("");
  let editDescription = $state("");
  let editAliases = $state("");
  let editUrl = $state("");
  let editParentId = $state<string | null>(null);
  let editParentName = $state("");
  let editFavorite = $state(false);
  let editIsNsfw = $state(false);

  const baseStudio = $derived(data.studio);
  const s = $derived({
    ...(baseStudio as Record<string, unknown>),
    ...localPatch,
  } as StudioPageStudio);
  const studioOptions = $derived(
    (data.allStudios as Array<{ id: string; name: string; videoCount?: number }>).map((studio) => ({
      id: studio.id,
      name: studio.name,
      count: studio.videoCount,
    })),
  );

  const videos = $derived(data.videos as VideoListItem[]);
  const series = $derived(data.series as VideoSeriesListItemDto[]);
  const galleries = $derived(data.galleries as GalleryListItemDto[]);
  const audioLibraries = $derived(data.audioLibraries as AudioLibraryListItemDto[]);

  function beginEdit() {
    editName = s.name ?? "";
    editDescription = s.description ?? "";
    editAliases = s.aliases ?? "";
    editUrl = s.url ?? "";
    editParentId = s.parentId ?? null;
    editParentName = s.parent?.name ?? "";
    editFavorite = s.favorite ?? false;
    editIsNsfw = s.isNsfw ?? false;
    editError = null;
    editing = true;
  }

  function handleParentChange(name: string) {
    editParentName = name;
    editParentId = studioOptions.find((option) => option.name === name)?.id ?? null;
  }

  async function saveEdit() {
    if (!editName.trim() || savingEdit) return;
    savingEdit = true;
    editError = null;
    const patch = buildStudioEditPatch({
      name: editName,
      description: editDescription,
      aliases: editAliases,
      url: editUrl,
      parentId: editParentId,
      favorite: editFavorite,
      isNsfw: editIsNsfw,
    });

    try {
      await updateStudio(s.id, patch);
      localPatch = {
        ...localPatch,
        ...patch,
        parentId: patch.parentId,
        parent: patch.parentId
          ? {
              id: patch.parentId,
              name: editParentName,
              imagePath: null,
              imageUrl: null,
            }
          : null,
      };
      editing = false;
    } catch (err) {
      editError = err instanceof Error ? err.message : "Failed to save studio";
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
    <div class="w-48 aspect-video shrink-0 bg-surface-1 border border-border-subtle overflow-hidden">
      {#if s.imagePath || s.imageUrl}
        <img
          src={toApiUrl(s.imagePath) ?? s.imageUrl ?? undefined}
          alt=""
          class="h-full w-full object-contain"
        />
      {:else}
        <div class="flex h-full items-center justify-center">
          <Building2 class="h-10 w-10 text-text-disabled" />
        </div>
      {/if}
    </div>
    <div class="flex-1 min-w-0 space-y-2">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="flex items-center gap-2.5 text-text-primary">
            <Building2 class="h-5 w-5 text-text-accent" />
            {s.name}
            {#if s.favorite}
              <Star class="h-4 w-4 text-accent-500 fill-current" />
            {/if}
          </h1>
          {#if s.parent}
            <p class="mt-1 text-[0.72rem] text-text-muted">
              Parent studio: <a href={`/studios/${s.parent.id}`} class="text-text-accent hover:text-accent-400">{s.parent.name}</a>
            </p>
          {/if}
        </div>

        <button
          type="button"
          aria-label={editing ? "Cancel studio edit" : "Edit studio"}
          title={editing ? "Cancel studio edit" : "Edit studio"}
          onclick={() => (editing ? (editing = false) : beginEdit())}
          class="flex h-8 w-8 shrink-0 items-center justify-center border border-border-subtle bg-surface-2 text-text-muted transition-colors duration-fast hover:border-border-accent hover:text-text-accent"
        >
          {#if editing}
            <X class="h-4 w-4" />
          {:else}
            <Edit3 class="h-4 w-4" />
          {/if}
        </button>
      </div>

      {#if s.url}
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-[0.78rem] text-text-accent hover:text-accent-400 transition-colors duration-fast"
        >
          <ExternalLink class="h-3 w-3" />
          {s.url}
        </a>
      {/if}

      <div class="flex flex-wrap gap-1 pt-1">
        {#if (s.videoCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {s.videoCount} {s.videoCount === 1 ? "video" : "videos"}
            {/snippet}
          </Badge>
        {/if}
        {#if (s.imageAppearanceCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {s.imageAppearanceCount} {s.imageAppearanceCount === 1 ? "image" : "images"}
            {/snippet}
          </Badge>
        {/if}
        {#if (s.audioLibraryCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {s.audioLibraryCount} {s.audioLibraryCount === 1 ? "album" : "albums"}
            {/snippet}
          </Badge>
        {/if}
        {#if s.isNsfw}
          <Badge variant="warning">
            {#snippet children()}NSFW{/snippet}
          </Badge>
        {/if}
      </div>

      {#if s.description}
        <p class="mt-3 text-[0.82rem] text-text-secondary leading-relaxed whitespace-pre-wrap max-w-2xl">
          {s.description}
        </p>
      {/if}
      {#if s.aliases}
        <p class="text-[0.72rem] text-text-muted">Aliases: {s.aliases}</p>
      {/if}
    </div>
  </div>

  {#if editing}
    <div class="max-w-4xl">
      <EditFormShell
        title="Studio metadata"
        onSave={saveEdit}
        onCancel={() => (editing = false)}
        saving={savingEdit}
        saveDisabled={!editName.trim()}
        saveLabel="Save studio"
        error={editError}
      >
        <div class="grid gap-4 md:grid-cols-2">
          <TextField label="Name" icon={Building2} value={editName} onChange={(v) => (editName = v)} required />
          <TextField label="URL" icon={Link} value={editUrl} onChange={(v) => (editUrl = v)} type="url" />
        </div>
        <TextAreaField
          label="Description"
          icon={FileText}
          value={editDescription}
          onChange={(v) => (editDescription = v)}
          rows={4}
        />
        <div class="grid gap-4 md:grid-cols-2">
          <TextField label="Aliases" icon={TagIcon} value={editAliases} onChange={(v) => (editAliases = v)} />
          <SearchSelect
            label="Parent Studio"
            icon={Building2}
            value={editParentName}
            onChange={handleParentChange}
            options={studioOptions}
            placeholder="No parent studio"
            emptyText="No matching studios"
          />
        </div>
        <FormField label="Flags">
          <div class="flex flex-wrap gap-2">
            <ToggleChip value={editFavorite} onChange={(v) => (editFavorite = v)} onLabel="Favorite" icon={Star} />
            <ToggleChip
              value={editIsNsfw}
              onChange={(v) => (editIsNsfw = v)}
              onLabel="NSFW"
              icon={AlertTriangle}
              variant="warning"
            />
          </div>
        </FormField>
      </EditFormShell>
    </div>
  {/if}

  {#if series.length > 0}
    <HierarchySection title="Series">
      {#snippet children()}
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {#each series as sItem (sItem.id)}
            <SeriesCard series={sItem} href={`/series?series=${sItem.id}`} compact />
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
              video={videoListItemToCardData(v, `/studios/${encodeURIComponent(s.name)}`)}
              variant="grid"
              index={i}
              imageLoading={i < 6 ? "eager" : "lazy"}
            />
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {:else if !series.length && !galleries.length && !audioLibraries.length}
    <HierarchySection title="Videos">
      {#snippet children()}
        <div class="surface-panel p-8 text-center">
          <Film class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
          <p class="text-body text-text-muted">
            Nothing from this studio yet — run Identify to hydrate.
          </p>
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
              <GalleryThumbnail
                title={g.title}
                coverImagePath={g.coverImagePath}
                imageCount={g.imageCount}
                isNsfw={g.isNsfw}
              />
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
</div>
