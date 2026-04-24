<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    AlertTriangle,
    Building2,
    Calendar,
    CheckCircle2,
    FileText,
    Image as ImageIcon,
    Loader2,
    Tag as TagIcon,
    Upload,
    User,
    X,
  } from "@lucide/svelte";
  import type { ImageDetailDto } from "@obscura/contracts";
  import type { PerformerItem, StudioItem, TagItem } from "$lib/api/types";
  import {
    resetImageThumbnail,
    updateImage,
    uploadImageThumbnail,
  } from "$lib/api/media";
  import { fetchPerformers, fetchStudios, fetchTags } from "$lib/api/entities";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import ImageThumbnail from "./thumbnails/ImageThumbnail.svelte";
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
    image: ImageDetailDto;
    onSaved?: () => void;
    onCancel?: () => void;
  }

  let { image, onSaved, onCancel }: Props = $props();

  const nsfw = useNsfw();

  let title = $state(untrack(() => image.title));
  let details = $state(untrack(() => image.details ?? ""));
  let date = $state(untrack(() => image.date ?? ""));
  let isNsfw = $state(untrack(() => image.isNsfw));
  let organized = $state(untrack(() => image.organized));
  let studioName = $state(untrack(() => image.studio?.name ?? ""));
  let performerNames = $state(untrack(() => image.performers.map((p) => p.name)));
  let tagNames = $state(untrack(() => image.tags.map((t) => t.name)));

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

  let thumbInput: HTMLInputElement | null = $state(null);
  let uploadingThumb = $state(false);

  const hasCustomThumb = $derived(
    // A custom thumbnail is stored as thumb-custom.jpg. The path itself doesn't
    // expose which variant served the request, so we best-effort the state off
    // the updatedAt marker — but the user can always just try Revert.
    image.thumbnailPath != null,
  );

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
      console.error("Failed to load entities for image edit", err);
    }
  }

  async function handleSave() {
    saving = true;
    error = null;
    message = null;
    try {
      await updateImage(image.id, {
        title: title.trim(),
        details: details.trim() || null,
        date: date.trim() || null,
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

  async function handleThumbPick() {
    const file = thumbInput?.files?.[0];
    if (!file) return;
    uploadingThumb = true;
    error = null;
    try {
      await uploadImageThumbnail(image.id, file);
      message = "Thumbnail updated";
      onSaved?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Upload failed";
    } finally {
      uploadingThumb = false;
      if (thumbInput) thumbInput.value = "";
    }
  }

  async function handleRevertThumb() {
    uploadingThumb = true;
    error = null;
    try {
      await resetImageThumbnail(image.id);
      message = "Reverted to generated thumbnail";
      onSaved?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to revert";
    } finally {
      uploadingThumb = false;
    }
  }
</script>

{#if message}
  <div class="surface-well p-2.5 text-sm border border-border-accent text-text-secondary">
    {message}
  </div>
{/if}

<div class="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
  <EditFormShell
    title="Edit image"
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
      placeholder="Image title"
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
    <DateField
      label="Date"
      icon={Calendar}
      value={date}
      onChange={(v) => (date = v)}
    />
    <TextAreaField
      label="Details"
      value={details}
      onChange={(v) => (details = v)}
      placeholder="Notes"
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
      Thumbnail
    </h4>
    <div class="surface-well overflow-hidden">
      <ImageThumbnail
        title={image.title}
        thumbnailPath={image.thumbnailPath}
        previewPath={image.previewPath}
        isVideo={image.isVideo}
        isNsfw={image.isNsfw}
        width={image.width}
        height={image.height}
        updatedAt={image.updatedAt}
        size="hero"
      />
    </div>
    <input
      bind:this={thumbInput}
      type="file"
      accept="image/*"
      class="hidden"
      onchange={handleThumbPick}
    />
    <div class="flex flex-col gap-2">
      <button
        type="button"
        onclick={() => thumbInput?.click()}
        disabled={uploadingThumb}
        class="flex items-center justify-center gap-1.5 border border-border-default px-3 py-1.5 text-[0.78rem] hover:border-border-accent hover:text-text-accent transition-colors disabled:opacity-60"
      >
        {#if uploadingThumb}
          <Loader2 class="h-3.5 w-3.5 animate-spin" />
        {:else}
          <Upload class="h-3.5 w-3.5" />
        {/if}
        Upload thumbnail
      </button>
      {#if hasCustomThumb}
        <button
          type="button"
          onclick={() => void handleRevertThumb()}
          disabled={uploadingThumb}
          class="flex items-center justify-center gap-1.5 border border-border-default px-3 py-1.5 text-[0.78rem] text-text-muted hover:border-error-text hover:text-error-text transition-colors disabled:opacity-60"
        >
          <X class="h-3.5 w-3.5" />
          Revert to generated
        </button>
      {/if}
    </div>
  </div>
</div>
