<script lang="ts">
  import {
    AlertTriangle,
    Edit3,
    FileText,
    Film,
    Images,
    Image as ImageIcon,
    Loader2,
    Star,
    Tag as TagIcon,
    Trash2,
    Upload,
    X,
  } from "@lucide/svelte";
  import { invalidate } from "$app/navigation";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import {
    deleteTagImage,
    updateTag,
    uploadTagImage,
  } from "$lib/api/entities";
  import type { VideoListItem } from "$lib/api/types";
  import type { GalleryListItemDto, ImageListItemDto } from "@obscura/contracts";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import { videoListItemToCardData } from "$lib/video-card-data";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import {
    EditFormShell,
    FormField,
    TextAreaField,
    TextField,
    ToggleChip,
  } from "$lib/components/forms";
  import { buildTagEditPatch } from "$lib/entity-edit-patch";

  let { data } = $props();
  let localPatch = $state<Record<string, unknown>>({});
  let editing = $state(false);
  let savingEdit = $state(false);
  let editError = $state<string | null>(null);
  let editName = $state("");
  let editDescription = $state("");
  let editAliases = $state("");
  let editFavorite = $state(false);
  let editIsNsfw = $state(false);
  let editIgnoreAutoTag = $state(false);
  let imageInput = $state<HTMLInputElement | null>(null);
  let imageUploading = $state(false);
  let imageError = $state<string | null>(null);
  let imageCacheBust = $state<string>("");

  const baseTag = $derived(data.tag);
  const t = $derived({
    ...(baseTag as Record<string, unknown>),
    ...localPatch,
  } as typeof baseTag);
  const videos = $derived(data.videos as VideoListItem[]);
  const galleries = $derived(data.galleries as GalleryListItemDto[]);
  const images = $derived(data.images as ImageListItemDto[]);

  function beginEdit() {
    editName = t.name ?? "";
    editDescription = t.description ?? "";
    editAliases = t.aliases ?? "";
    editFavorite = t.favorite ?? false;
    editIsNsfw = t.isNsfw ?? false;
    editIgnoreAutoTag = t.ignoreAutoTag ?? false;
    editError = null;
    editing = true;
  }

  async function saveEdit() {
    if (!editName.trim() || savingEdit) return;
    savingEdit = true;
    editError = null;
    const patch = buildTagEditPatch({
      name: editName,
      description: editDescription,
      aliases: editAliases,
      favorite: editFavorite,
      isNsfw: editIsNsfw,
      ignoreAutoTag: editIgnoreAutoTag,
    });

    try {
      await updateTag(t.id, patch);
      localPatch = { ...localPatch, ...patch };
      editing = false;
    } catch (err) {
      editError = err instanceof Error ? err.message : "Failed to save tag";
    } finally {
      savingEdit = false;
    }
  }

  async function handleImageUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    imageUploading = true;
    imageError = null;
    try {
      const result = await uploadTagImage(t.id, file);
      localPatch = { ...localPatch, imagePath: result.imagePath };
      imageCacheBust = new Date().toISOString();
      await invalidate(`tags:${t.id}`);
    } catch (err) {
      imageError = err instanceof Error ? err.message : "Failed to upload image";
    } finally {
      imageUploading = false;
    }
  }

  async function handleImageClear() {
    imageUploading = true;
    imageError = null;
    try {
      await deleteTagImage(t.id);
      localPatch = { ...localPatch, imagePath: null };
      imageCacheBust = new Date().toISOString();
      await invalidate(`tags:${t.id}`);
    } catch (err) {
      imageError = err instanceof Error ? err.message : "Failed to clear image";
    } finally {
      imageUploading = false;
    }
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col sm:flex-row gap-4 items-start">
    {#if t.imagePath}
      <div class="w-24 h-24 shrink-0 bg-surface-1 border border-border-subtle overflow-hidden">
        <img src={toApiUrl(t.imagePath, imageCacheBust)} alt="" class="h-full w-full object-cover" />
      </div>
    {/if}
    <div class="flex-1 min-w-0 space-y-2">
      <div class="flex items-start justify-between gap-3">
        <h1 class="flex items-center gap-2.5 text-text-primary flex-wrap">
          <TagIcon class="h-5 w-5 text-text-accent" />
          {t.name}
          {#if t.favorite}
            <Star class="h-4 w-4 text-accent-500 fill-current" />
          {/if}
        </h1>

        <button
          type="button"
          aria-label={editing ? "Cancel tag edit" : "Edit tag"}
          title={editing ? "Cancel tag edit" : "Edit tag"}
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

      <div class="flex flex-wrap gap-1">
        {#if (t.videoCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {t.videoCount} {t.videoCount === 1 ? "video" : "videos"}
            {/snippet}
          </Badge>
        {/if}
        {#if (t.imageCount ?? 0) > 0}
          <Badge>
            {#snippet children()}
              {t.imageCount} {t.imageCount === 1 ? "image" : "images"}
            {/snippet}
          </Badge>
        {/if}
        {#if t.isNsfw}
          <Badge variant="warning">
            {#snippet children()}NSFW{/snippet}
          </Badge>
        {/if}
      </div>

      {#if t.description}
        <p class="mt-2 text-[0.82rem] text-text-secondary leading-relaxed whitespace-pre-wrap max-w-2xl">
          {t.description}
        </p>
      {/if}

      {#if t.aliases}
        <p class="text-[0.72rem] text-text-muted">Aliases: {t.aliases}</p>
      {/if}
    </div>
  </div>

  {#if editing}
    <div class="max-w-4xl">
      <EditFormShell
        title="Tag metadata"
        onSave={saveEdit}
        onCancel={() => (editing = false)}
        saving={savingEdit}
        saveDisabled={!editName.trim()}
        saveLabel="Save tag"
        error={editError}
      >
        <TextField label="Name" icon={TagIcon} value={editName} onChange={(v) => (editName = v)} required />
        <TextAreaField
          label="Description"
          icon={FileText}
          value={editDescription}
          onChange={(v) => (editDescription = v)}
          rows={4}
        />
        <TextField label="Aliases" value={editAliases} onChange={(v) => (editAliases = v)} />
        <FormField label="Image" icon={ImageIcon}>
          <div class="flex items-start gap-3">
            <div class="w-24 h-24 shrink-0 bg-surface-1 border border-border-subtle overflow-hidden flex items-center justify-center">
              {#if t.imagePath}
                <img
                  src={toApiUrl(t.imagePath, imageCacheBust)}
                  alt=""
                  class="h-full w-full object-cover"
                />
              {:else}
                <ImageIcon class="h-7 w-7 text-text-disabled" />
              {/if}
            </div>
            <div class="flex-1 min-w-0 space-y-2">
              <div class="flex flex-wrap gap-2">
                <input
                  bind:this={imageInput}
                  class="hidden"
                  type="file"
                  accept="image/*"
                  onchange={handleImageUpload}
                />
                <button
                  type="button"
                  onclick={() => imageInput?.click()}
                  disabled={imageUploading}
                  class="inline-flex items-center gap-1.5 border border-border-default px-3 py-1.5 text-[0.75rem] text-text-secondary transition-colors hover:border-border-accent hover:text-text-accent disabled:opacity-50"
                >
                  {#if imageUploading}
                    <Loader2 class="h-3.5 w-3.5 animate-spin" />
                  {:else}
                    <Upload class="h-3.5 w-3.5" />
                  {/if}
                  Upload
                </button>
                {#if t.imagePath}
                  <button
                    type="button"
                    onclick={() => void handleImageClear()}
                    disabled={imageUploading}
                    class="inline-flex items-center gap-1.5 border border-border-default px-3 py-1.5 text-[0.75rem] text-text-secondary transition-colors hover:border-error/40 hover:text-error-text disabled:opacity-50"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                    Remove
                  </button>
                {/if}
              </div>
              {#if imageError}
                <p class="text-[0.72rem] text-error-text">{imageError}</p>
              {:else}
                <p class="text-[0.7rem] text-text-disabled">
                  Upload a custom image to represent this tag in grids and detail pages.
                </p>
              {/if}
            </div>
          </div>
        </FormField>
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
            <ToggleChip
              value={editIgnoreAutoTag}
              onChange={(v) => (editIgnoreAutoTag = v)}
              onLabel="Ignored for auto-tag"
              offLabel="Ignore for auto-tag"
            />
          </div>
        </FormField>
      </EditFormShell>
    </div>
  {/if}

  {#if videos.length > 0}
    <HierarchySection title={`${data.totalVideos} ${data.totalVideos === 1 ? "video" : "videos"}`}>
      {#snippet children()}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {#each videos as v, i (v.id)}
            <VideoCard
              video={videoListItemToCardData(v, `/tags/${encodeURIComponent(t.name)}`)}
              variant="grid"
              index={i}
              imageLoading={i < 6 ? "eager" : "lazy"}
            />
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
                    <img src={toApiUrl(g.coverImagePath)} alt="" loading="lazy" class="h-full w-full object-cover" />
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
    <HierarchySection title="Images">
      {#snippet children()}
        <div class="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
          {#each images as img (img.id)}
            <a
              href={`/images/${img.id}`}
              class="aspect-square bg-surface-1 overflow-hidden block hover:ring-1 hover:ring-border-accent transition-all duration-fast"
            >
              <NsfwBlur isNsfw={img.isNsfw} class="block h-full w-full">
                {#if img.thumbnailPath}
                  <img
                    src={toApiUrl(img.thumbnailPath)}
                    alt={img.title}
                    loading="lazy"
                    class="h-full w-full object-cover"
                  />
                {:else}
                  <div class="flex h-full w-full items-center justify-center">
                    <ImageIcon class="h-6 w-6 text-text-disabled" />
                  </div>
                {/if}
              </NsfwBlur>
            </a>
          {/each}
        </div>
      {/snippet}
    </HierarchySection>
  {/if}

  {#if videos.length === 0 && galleries.length === 0 && images.length === 0}
    <div class="surface-panel p-8 text-center">
      <Film class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">
        Nothing tagged with “{t.name}” yet.
      </p>
    </div>
  {/if}
</div>
