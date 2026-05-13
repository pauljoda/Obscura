<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    AlertTriangle,
    Building2,
    Calendar,
    Camera,
    CheckCircle2,
    FileText,
    Image as ImageIcon,
    Loader2,
    Tag as TagIcon,
    Upload,
    User,
    X,
  } from "@lucide/svelte";
  import type { GalleryDetailDto } from "@obscura/contracts";
  import type { PerformerItem, StudioItem, TagItem } from "$lib/v1/api/types-v1";
  import { toApiUrl } from "$lib/v1/api/core-v1";
  import {
    deleteGalleryCover,
    setGalleryCoverFromImage,
    updateGallery,
    uploadGalleryCover,
  } from "$lib/v1/api/media-v1";
  import { fetchPerformers, fetchStudios, fetchTags } from "$lib/v1/api/entities-v1";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import NsfwBlur from "./nsfw/NsfwBlur.svelte";
  import {
    DateField,
    EditFormShell,
    SearchSelect,
    TagSelect,
    TextAreaField,
    TextField,
    ToggleChip,
    type SearchOption,
    type TagOption,
  } from "./forms";

  interface Props {
    gallery: GalleryDetailDto;
    onSaved?: () => void;
    onCancel?: () => void;
  }

  let { gallery, onSaved, onCancel }: Props = $props();

  const nsfw = useNsfw();

  let title = $state(untrack(() => gallery.title));
  let details = $state(untrack(() => gallery.details ?? ""));
  let date = $state(untrack(() => gallery.date ?? ""));
  let photographer = $state(untrack(() => gallery.photographer ?? ""));
  let isNsfw = $state(untrack(() => gallery.isNsfw));
  let organized = $state(untrack(() => gallery.organized));
  let studioName = $state(untrack(() => gallery.studio?.name ?? ""));
  let performerNames = $state(untrack(() => gallery.performers.map((p) => p.name)));
  let tagNames = $state(untrack(() => gallery.tags.map((t) => t.name)));

  let saving = $state(false);
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);

  let allTags = $state<TagItem[]>([]);
  let allPerformers = $state<PerformerItem[]>([]);
  let allStudios = $state<StudioItem[]>([]);

  const studioSuggestions = $derived<SearchOption[]>(
    allStudios.map((s) => ({ id: s.id, name: s.name })),
  );
  const performerSuggestions = $derived<TagOption[]>(
    allPerformers.map((p) => ({ name: p.name, count: p.videoCount })),
  );
  const tagSuggestions = $derived<TagOption[]>(
    allTags.map((t) => ({
      name: t.name,
      count: (t.videoCount ?? 0) + ((t.imageCount ?? 0) as number),
    })),
  );

  let coverInput: HTMLInputElement | null = $state(null);
  let uploadingCover = $state(false);
  let coverPickerOpen = $state(false);

  onMount(() => {
    void loadEntities();
  });

  async function loadEntities() {
    try {
      const [tagsData, performersData, studiosData] = await Promise.all([
        fetchTags({ nsfw: nsfw.mode }).catch(() => ({ tags: [] as TagItem[] })),
        fetchPerformers({ nsfw: nsfw.mode, limit: 100 }).catch(() => ({
          performers: [] as PerformerItem[],
          total: 0,
          limit: 100,
          offset: 0,
        })),
        fetchStudios({ nsfw: nsfw.mode }).catch(() => ({
          studios: [] as StudioItem[],
        })),
      ]);
      allTags = tagsData.tags;
      allPerformers = performersData.performers;
      allStudios = studiosData.studios;
    } catch (err) {
      console.error("Failed to load entities for gallery edit", err);
    }
  }

  async function handleSave() {
    saving = true;
    error = null;
    message = null;
    try {
      await updateGallery(gallery.id, {
        title: title.trim(),
        details: details.trim() || null,
        date: date.trim() || null,
        photographer: photographer.trim() || null,
        isNsfw,
        organized,
        studioName: studioName.trim() || null,
        performerNames,
        tagNames,
      });
      message = "Saved";
      onSaved?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save";
    } finally {
      saving = false;
    }
  }

  async function handleCoverPick() {
    const file = coverInput?.files?.[0];
    if (!file) return;
    uploadingCover = true;
    error = null;
    try {
      await uploadGalleryCover(gallery.id, file);
      message = "Cover updated";
      onSaved?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Upload failed";
    } finally {
      uploadingCover = false;
      if (coverInput) coverInput.value = "";
    }
  }

  async function handleChooseFromImages(imageId: string) {
    uploadingCover = true;
    error = null;
    try {
      await setGalleryCoverFromImage(gallery.id, imageId);
      message = "Cover updated";
      coverPickerOpen = false;
      onSaved?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to set cover";
    } finally {
      uploadingCover = false;
    }
  }

  async function handleClearCover() {
    uploadingCover = true;
    error = null;
    try {
      await deleteGalleryCover(gallery.id);
      message = "Cover cleared";
      onSaved?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to clear cover";
    } finally {
      uploadingCover = false;
    }
  }
</script>

{#if message}
  <div class="surface-well p-2.5 text-sm border border-border-accent text-text-secondary">
    {message}
  </div>
{/if}

<div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
  <EditFormShell
    title="Edit gallery"
    onSave={() => void handleSave()}
    onCancel={() => onCancel?.()}
    {saving}
    saveDisabled={!title.trim()}
    saveLabel="Save changes"
    {error}
  >
    <TextField
      label="Title"
      icon={FileText}
      value={title}
      onChange={(v) => (title = v)}
      placeholder="Gallery title"
      required
    />
    <SearchSelect
      label="Studio"
      icon={Building2}
      value={studioName}
      onChange={(v) => (studioName = v)}
      options={studioSuggestions}
      placeholder="Pick a studio…"
      canAddNew
    />
    <div class="grid gap-4 sm:grid-cols-2">
      <DateField
        label="Date"
        icon={Calendar}
        value={date}
        onChange={(v) => (date = v)}
      />
      <TextField
        label="Photographer"
        icon={Camera}
        value={photographer}
        onChange={(v) => (photographer = v)}
        placeholder="Credit"
      />
    </div>
    <TextAreaField
      label="Details"
      value={details}
      onChange={(v) => (details = v)}
      placeholder="Synopsis or notes"
    />
    <TagSelect
      label="Performers"
      icon={User}
      values={performerNames}
      onChange={(next) => (performerNames = next)}
      options={performerSuggestions}
      placeholder="Add performer…"
    />
    <TagSelect
      label="Tags"
      icon={TagIcon}
      values={tagNames}
      onChange={(next) => (tagNames = next)}
      options={tagSuggestions}
      placeholder="Add tag…"
    />
    <div class="grid gap-4 sm:grid-cols-2">
      <ToggleChip
        value={organized}
        onChange={(v) => (organized = v)}
        onLabel="Organized"
        offLabel="Mark organized"
        icon={CheckCircle2}
      />
      <ToggleChip
        value={isNsfw}
        onChange={(v) => (isNsfw = v)}
        onLabel="Marked NSFW"
        offLabel="Mark as NSFW"
        icon={AlertTriangle}
        variant="warning"
      />
    </div>
  </EditFormShell>

  <div class="space-y-3">
    <h4 class="text-kicker flex items-center gap-2">
      <ImageIcon class="h-3.5 w-3.5" />
      Cover
    </h4>
    <div class="surface-well overflow-hidden">
      <EntityThumbnail
        kind="gallery"
        title={gallery.title}
        coverImagePath={gallery.coverImagePath}
        previewImagePaths={gallery.images.map((i) => toApiUrl(i.thumbnailPath) ?? "").filter(Boolean).slice(0, 4)}
        imageCount={gallery.imageCount}
        isNsfw={gallery.isNsfw}
        isComic={gallery.isComic}
        updatedAt={gallery.updatedAt}
        size="hero"
      />
    </div>
    <input
      bind:this={coverInput}
      type="file"
      accept="image/*"
      class="hidden"
      onchange={handleCoverPick}
    />
    <div class="flex flex-col gap-2">
      <button
        type="button"
        onclick={() => coverInput?.click()}
        disabled={uploadingCover}
        class="flex items-center justify-center gap-1.5 border border-border-default px-3 py-1.5 text-[0.78rem] hover:border-border-accent hover:text-text-accent transition-colors disabled:opacity-60"
      >
        {#if uploadingCover}
          <Loader2 class="h-3.5 w-3.5 animate-spin" />
        {:else}
          <Upload class="h-3.5 w-3.5" />
        {/if}
        Upload cover image
      </button>
      <button
        type="button"
        onclick={() => (coverPickerOpen = true)}
        disabled={uploadingCover || gallery.images.length === 0}
        class="flex items-center justify-center gap-1.5 border border-border-default px-3 py-1.5 text-[0.78rem] hover:border-border-accent hover:text-text-accent transition-colors disabled:opacity-60"
      >
        <ImageIcon class="h-3.5 w-3.5" />
        Pick from gallery
      </button>
      {#if gallery.coverImageId || gallery.coverImagePath}
        <button
          type="button"
          onclick={() => void handleClearCover()}
          disabled={uploadingCover}
          class="flex items-center justify-center gap-1.5 border border-border-default px-3 py-1.5 text-[0.78rem] text-text-muted hover:border-error-text hover:text-error-text transition-colors disabled:opacity-60"
        >
          <X class="h-3.5 w-3.5" />
          Clear cover
        </button>
      {/if}
    </div>
  </div>
</div>

{#if coverPickerOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    onclick={() => (coverPickerOpen = false)}
  >
    <div
      class="surface-panel w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <h3 class="text-sm font-medium text-text-primary">Choose a cover image</h3>
        <button
          type="button"
          onclick={() => (coverPickerOpen = false)}
          class="text-text-muted hover:text-text-primary"
          aria-label="Close"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-3">
        <div class="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
          {#each gallery.images as img (img.id)}
            <button
              type="button"
              disabled={uploadingCover}
              onclick={() => void handleChooseFromImages(img.id)}
              class="aspect-square bg-surface-1 overflow-hidden hover:ring-2 hover:ring-border-accent transition-all duration-fast disabled:opacity-50"
              title={img.title}
            >
              <NsfwBlur isNsfw={img.isNsfw} class="block h-full w-full">
                {#if img.thumbnailPath}
                  <img
                    src={toApiUrl(img.thumbnailPath)}
                    alt={img.title}
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                {/if}
              </NsfwBlur>
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}
