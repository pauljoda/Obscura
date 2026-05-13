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
    Star,
    Tag as TagIcon,
    Upload,
    User,
    X,
  } from "@lucide/svelte";
  import type { VideoSeriesDetailDto } from "@obscura/contracts";
  import type { PerformerItem, StudioItem, TagItem } from "$lib/v1/api/types-v1";
  import { toApiUrl } from "$lib/v1/api/core-v1";
  import { fetchPerformers, fetchStudios, fetchTags } from "$lib/v1/api/entities-v1";
  import {
    deleteSeriesBackdrop,
    deleteSeriesCover,
    updateSeries,
    uploadSeriesBackdrop,
    uploadSeriesCover,
  } from "$lib/v1/api/videos-v1";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import StarRatingPicker from "./StarRatingPicker.svelte";
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
    series: VideoSeriesDetailDto;
    onSaved?: () => void | Promise<void>;
    onChanged?: () => void | Promise<void>;
    onCancel?: () => void;
  }

  let { series, onSaved, onChanged, onCancel }: Props = $props();

  const nsfw = useNsfw();

  let customName = $state(untrack(() => series.customName ?? series.displayTitle));
  let details = $state(untrack(() => series.details ?? ""));
  let date = $state(untrack(() => series.date ?? ""));
  let rating = $state<number | null>(untrack(() => series.rating ?? null));
  let isNsfw = $state(untrack(() => series.isNsfw));
  let organized = $state(untrack(() => series.organized));
  let studioName = $state(untrack(() => series.studio?.name ?? series.studioName ?? ""));
  let performerNames = $state(untrack(() => series.performers.map((performer) => performer.name)));
  let tagNames = $state(untrack(() => series.tags.map((tag) => tag.name)));

  let saving = $state(false);
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);

  let allTags = $state<TagItem[]>([]);
  let allPerformers = $state<PerformerItem[]>([]);
  let allStudios = $state<StudioItem[]>([]);

  let coverInput: HTMLInputElement | null = $state(null);
  let backdropInput: HTMLInputElement | null = $state(null);
  let coverBusy = $state(false);
  let backdropBusy = $state(false);

  const studioSuggestions = $derived<SearchOption[]>(
    allStudios.map((studio) => ({ id: studio.id, name: studio.name })),
  );
  const performerSuggestions = $derived<TagOption[]>(
    allPerformers.map((performer) => ({ name: performer.name, count: performer.videoCount })),
  );
  const tagSuggestions = $derived<TagOption[]>(
    allTags.map((tag) => ({
      name: tag.name,
      count: (tag.videoCount ?? 0) + ((tag.imageCount ?? 0) as number),
    })),
  );

  const backdropUrl = $derived(toApiUrl(series.backdropImagePath, series.updatedAt));

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
        fetchStudios({ nsfw: nsfw.mode }).catch(() => ({ studios: [] as StudioItem[] })),
      ]);
      allTags = tagsData.tags;
      allPerformers = performersData.performers;
      allStudios = studiosData.studios;
    } catch (err) {
      console.error("Failed to load entities for series edit", err);
    }
  }

  async function handleSave() {
    saving = true;
    error = null;
    message = null;
    try {
      await updateSeries(series.id, {
        customName: customName.trim() || null,
        details: details.trim() || null,
        date: date.trim() || null,
        rating,
        isNsfw,
        organized,
        studioName: studioName.trim() || null,
        performerNames,
        tagNames,
      });
      message = "Saved";
      await onSaved?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save";
    } finally {
      saving = false;
    }
  }

  async function handleCoverUpload() {
    const file = coverInput?.files?.[0];
    if (!file) return;
    coverBusy = true;
    error = null;
    message = null;
    try {
      await uploadSeriesCover(series.id, file);
      message = "Cover updated";
      await onChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Upload failed";
    } finally {
      coverBusy = false;
      if (coverInput) coverInput.value = "";
    }
  }

  async function handleBackdropUpload() {
    const file = backdropInput?.files?.[0];
    if (!file) return;
    backdropBusy = true;
    error = null;
    message = null;
    try {
      await uploadSeriesBackdrop(series.id, file);
      message = "Backdrop updated";
      await onChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Upload failed";
    } finally {
      backdropBusy = false;
      if (backdropInput) backdropInput.value = "";
    }
  }

  async function handleClearCover() {
    coverBusy = true;
    error = null;
    message = null;
    try {
      await deleteSeriesCover(series.id);
      message = "Cover cleared";
      await onChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to clear cover";
    } finally {
      coverBusy = false;
    }
  }

  async function handleClearBackdrop() {
    backdropBusy = true;
    error = null;
    message = null;
    try {
      await deleteSeriesBackdrop(series.id);
      message = "Backdrop cleared";
      await onChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to clear backdrop";
    } finally {
      backdropBusy = false;
    }
  }
</script>

{#if message}
  <div class="surface-well border border-border-accent p-2.5 text-sm text-text-secondary">
    {message}
  </div>
{/if}

<div class="space-y-5">
  <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
    <EditFormShell
      title="Edit series"
      onSave={() => void handleSave()}
      onCancel={() => onCancel?.()}
      {saving}
      saveDisabled={!customName.trim()}
      saveLabel="Save changes"
      {error}
    >
      <TextField
        label="Display title"
        icon={FileText}
        value={customName}
        onChange={(value) => (customName = value)}
        placeholder={series.title}
        required
      />
      <SearchSelect
        label="Studio"
        icon={Building2}
        value={studioName}
        onChange={(value) => (studioName = value)}
        options={studioSuggestions}
        placeholder="Pick a studio..."
        canAddNew
      />
      <DateField
        label="Date"
        icon={Calendar}
        value={date}
        onChange={(value) => (date = value)}
      />
      <div class="space-y-1.5">
        <div class="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.14em] text-text-muted">
          <Star class="h-3.5 w-3.5" />
          Rating
        </div>
        <StarRatingPicker
          value={rating}
          onChange={(value) => (rating = value)}
          ariaLabelPrefix="Rate series with"
        />
      </div>
      <TextAreaField
        label="Details"
        value={details}
        onChange={(value) => (details = value)}
        placeholder="Synopsis or notes"
      />
      <TagSelect
        label="Performers"
        icon={User}
        values={performerNames}
        onChange={(next) => (performerNames = next)}
        options={performerSuggestions}
        placeholder="Add performer..."
      />
      <TagSelect
        label="Tags"
        icon={TagIcon}
        values={tagNames}
        onChange={(next) => (tagNames = next)}
        options={tagSuggestions}
        placeholder="Add tag..."
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <ToggleChip
          value={organized}
          onChange={(value) => (organized = value)}
          onLabel="Organized"
          offLabel="Mark organized"
          icon={CheckCircle2}
        />
        <ToggleChip
          value={isNsfw}
          onChange={(value) => (isNsfw = value)}
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
          kind="video-series"
          title={series.displayTitle}
          coverImagePath={series.coverImagePath}
          previewThumbnailPaths={series.previewThumbnailPaths}
          updatedAt={series.updatedAt}
          isNsfw={series.isNsfw}
          videoCount={series.visibleSfwVideoCount}
          rating={series.rating}
        />
      </div>
      <input
        bind:this={coverInput}
        aria-label="Cover file"
        type="file"
        accept="image/*"
        class="hidden"
        onchange={() => void handleCoverUpload()}
      />
      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          onclick={() => coverInput?.click()}
          disabled={coverBusy}
          class="inline-flex items-center gap-1.5 border border-border-default px-2 py-1 text-[0.68rem] text-text-secondary transition-colors hover:border-border-accent hover:text-text-accent disabled:opacity-60"
        >
          {#if coverBusy}
            <Loader2 class="h-3 w-3 animate-spin" />
          {:else}
            <Upload class="h-3 w-3" />
          {/if}
          Upload cover
        </button>
        {#if series.coverImagePath}
          <button
            type="button"
            onclick={() => void handleClearCover()}
            disabled={coverBusy}
            class="inline-flex items-center gap-1.5 border border-border-default px-2 py-1 text-[0.68rem] text-text-muted transition-colors hover:border-error-text hover:text-error-text disabled:opacity-60"
          >
            <X class="h-3 w-3" />
            Clear cover
          </button>
        {/if}
      </div>
    </div>
  </div>

  <div class="space-y-3">
    <h4 class="text-kicker flex items-center gap-2">
      <ImageIcon class="h-3.5 w-3.5" />
      Backdrop
    </h4>
    <div class="surface-well overflow-hidden">
      {#if backdropUrl}
        <img
          src={backdropUrl}
          alt={`${series.displayTitle} backdrop`}
          class="aspect-video w-full object-cover"
        />
      {:else}
        <div class="flex aspect-video w-full items-center justify-center bg-surface-2 text-text-disabled">
          <ImageIcon class="h-8 w-8" />
        </div>
      {/if}
    </div>
    <input
      bind:this={backdropInput}
      aria-label="Backdrop file"
      type="file"
      accept="image/*"
      class="hidden"
      onchange={() => void handleBackdropUpload()}
    />
    <div class="flex flex-wrap gap-1.5">
      <button
        type="button"
        onclick={() => backdropInput?.click()}
        disabled={backdropBusy}
        class="inline-flex items-center gap-1.5 border border-border-default px-2 py-1 text-[0.68rem] text-text-secondary transition-colors hover:border-border-accent hover:text-text-accent disabled:opacity-60"
      >
        {#if backdropBusy}
          <Loader2 class="h-3 w-3 animate-spin" />
        {:else}
          <Upload class="h-3 w-3" />
        {/if}
        Upload backdrop
      </button>
      {#if series.backdropImagePath}
        <button
          type="button"
          onclick={() => void handleClearBackdrop()}
          disabled={backdropBusy}
          class="inline-flex items-center gap-1.5 border border-border-default px-2 py-1 text-[0.68rem] text-text-muted transition-colors hover:border-error-text hover:text-error-text disabled:opacity-60"
        >
          <X class="h-3 w-3" />
          Clear backdrop
        </button>
      {/if}
    </div>
  </div>
</div>
