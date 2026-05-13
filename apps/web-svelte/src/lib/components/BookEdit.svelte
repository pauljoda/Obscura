<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    AlertTriangle,
    Building2,
    Calendar,
    CheckCircle2,
    FileText,
    Star,
    Tag as TagIcon,
    User,
  } from "@lucide/svelte";
  import type { BookDetailDto } from "@obscura/contracts";
  import type { PerformerItem, StudioItem, TagItem } from "$lib/v1/api/types-v1";
  import { updateBook } from "$lib/v1/api/media-v1";
  import { fetchPerformers, fetchStudios, fetchTags } from "$lib/v1/api/entities-v1";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import BookChapterCoverEditor from "./BookChapterCoverEditor.svelte";
  import BookRootCoverEditor from "./BookRootCoverEditor.svelte";
  import BookVolumeCoverEditor from "./BookVolumeCoverEditor.svelte";
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
    book: BookDetailDto;
    onSaved?: () => void;
    onChanged?: () => void;
    onCancel?: () => void;
  }

  let { book, onSaved, onChanged, onCancel }: Props = $props();

  const nsfw = useNsfw();

  let title = $state(untrack(() => book.title));
  let details = $state(untrack(() => book.details ?? ""));
  let date = $state(untrack(() => book.date ?? ""));
  let rating = $state<number | null>(untrack(() => book.rating ?? null));
  let isNsfw = $state(untrack(() => book.isNsfw));
  let organized = $state(untrack(() => book.organized));
  let studioName = $state(untrack(() => book.studio?.name ?? ""));
  let artistNames = $state(untrack(() => book.performers.map((performer) => performer.name)));
  let tagNames = $state(untrack(() => book.tags.map((tag) => tag.name)));

  let saving = $state(false);
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);

  let allTags = $state<TagItem[]>([]);
  let allPerformers = $state<PerformerItem[]>([]);
  let allStudios = $state<StudioItem[]>([]);

  const studioSuggestions = $derived<SearchOption[]>(
    allStudios.map((studio) => ({ id: studio.id, name: studio.name })),
  );
  const artistSuggestions = $derived<TagOption[]>(
    allPerformers.map((performer) => ({ name: performer.name, count: performer.videoCount })),
  );
  const tagSuggestions = $derived<TagOption[]>(
    allTags.map((tag) => ({
      name: tag.name,
      count: (tag.videoCount ?? 0) + ((tag.imageCount ?? 0) as number),
    })),
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
        fetchStudios({ nsfw: nsfw.mode }).catch(() => ({ studios: [] as StudioItem[] })),
      ]);
      allTags = tagsData.tags;
      allPerformers = performersData.performers;
      allStudios = studiosData.studios;
    } catch (err) {
      console.error("Failed to load entities for book edit", err);
    }
  }

  async function handleSave() {
    saving = true;
    error = null;
    message = null;
    try {
      await updateBook(book.id, {
        title: title.trim(),
        details: details.trim() || null,
        date: date.trim() || null,
        rating,
        isNsfw,
        organized,
        studioName: studioName.trim() || null,
        performerNames: artistNames,
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
</script>

{#if message}
  <div class="surface-well border border-border-accent p-2.5 text-sm text-text-secondary">
    {message}
  </div>
{/if}

<div class="space-y-5">
  <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
    <EditFormShell
      title="Edit book"
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
        onChange={(value) => (title = value)}
        placeholder="Book title"
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
          ariaLabelPrefix="Rate book with"
        />
      </div>
      <TextAreaField
        label="Details"
        value={details}
        onChange={(value) => (details = value)}
        placeholder="Synopsis or notes"
      />
      <TagSelect
        label="Artists"
        icon={User}
        values={artistNames}
        onChange={(next) => (artistNames = next)}
        options={artistSuggestions}
        placeholder="Add artist..."
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

    <BookRootCoverEditor {book} onChanged={onChanged} />
  </div>

  <BookVolumeCoverEditor
    volumes={book.volumes}
    isNsfw={book.isNsfw}
    onChanged={onChanged}
  />

  <BookChapterCoverEditor
    chapters={book.chapters}
    isNsfw={book.isNsfw}
    onChanged={onChanged}
  />
</div>
