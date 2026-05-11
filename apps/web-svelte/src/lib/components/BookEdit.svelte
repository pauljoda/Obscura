<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    AlertTriangle,
    BookOpen,
    Building2,
    Calendar,
    CheckCircle2,
    FileText,
    Tag as TagIcon,
    User,
  } from "@lucide/svelte";
  import type { BookDetailDto } from "@obscura/contracts";
  import type { PerformerItem, StudioItem, TagItem } from "$lib/api/types";
  import { updateBook } from "$lib/api/media";
  import { fetchPerformers, fetchStudios, fetchTags } from "$lib/api/entities";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import BookChapterCoverEditor from "./BookChapterCoverEditor.svelte";
  import EntityThumbnail from "./thumbnails/EntityThumbnail.svelte";
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

    <div class="space-y-3">
      <h4 class="text-kicker flex items-center gap-2">
        <BookOpen class="h-3.5 w-3.5" />
        Cover
      </h4>
      <div class="surface-well overflow-hidden">
        <EntityThumbnail
          kind="book"
          title={book.title}
          coverImagePath={book.coverImagePath}
          previewImagePaths={book.previewImagePaths}
          pageCount={book.pageCount}
          isNsfw={book.isNsfw}
          size="hero"
          aspectClass="aspect-[2/3]"
          fit="contain"
        />
      </div>
    </div>
  </div>

  <BookChapterCoverEditor
    chapters={book.chapters}
    isNsfw={book.isNsfw}
    onChanged={onChanged}
  />
</div>
