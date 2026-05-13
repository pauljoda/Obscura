<script lang="ts">
  import { goto, invalidate, invalidateAll } from "$app/navigation";
  import { BookOpen, Check, HardDrive, Pencil, Play, Trash2 } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import type { BookPageDto, ImageListItemDto } from "@obscura/contracts";
  import type { PageData } from "./$types";
  import { deleteBook, updateBook, updateBookProgress } from "$lib/v1/api/media-v1";
  import BookEdit from "$lib/components/BookEdit.svelte";
  import ComicReader from "$lib/components/ComicReader.svelte";
  import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte";
  import HierarchyBreadcrumbs from "$lib/components/shared/HierarchyBreadcrumbs.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import HierarchyShell from "$lib/components/shared/HierarchyShell.svelte";
  import IdentifyButton from "$lib/components/IdentifyButton.svelte";
  import ImportButton from "$lib/components/ImportButton.svelte";
  import InlineRating from "$lib/components/InlineRating.svelte";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import NsfwTagLabel from "$lib/components/nsfw/NsfwTagLabel.svelte";
  import UploadDropZone from "$lib/components/UploadDropZone.svelte";
  import { toApiUrl } from "$lib/v1/api/core-v1";
  import { getChapterProgressDisplay, getCurrentChapterProgressDisplay } from "$lib/book-progress";
  import { useAppChrome, type AppBreadcrumb } from "$lib/stores/app-chrome.svelte";

  let { data }: { data: PageData } = $props();
  let overrideRating = $state<number | null | undefined>(undefined);
  const book = $derived(
    overrideRating === undefined ? data.book : { ...data.book, rating: overrideRating },
  );
  const appChrome = useAppChrome();

  // svelte-ignore state_referenced_locally
  const initialChapterId = data.chapterId ?? data.book.progress?.chapterId ?? data.book.chapters[0]?.id ?? null;
  let selectedChapterId = $state(initialChapterId);
  let readerOpen = $state(false);
  let editing = $state(false);
  let deleteDialogOpen = $state(false);
  let deleteBusy = $state(false);
  // svelte-ignore state_referenced_locally
  let readerIndex = $state(book.progress?.pageIndex ?? 0);
  // svelte-ignore state_referenced_locally
  let readerMode = $state<"paged" | "webtoon">(book.progress?.readerMode ?? "paged");

  const hasVolumes = $derived(book.volumes.length > 0);
  const looseChapters = $derived(book.chapters.filter((chapter) => !chapter.volumeId));
  const visibleChapters = $derived(hasVolumes ? looseChapters : book.chapters);
  const selectedChapter = $derived(
    visibleChapters.find((chapter) => chapter.id === selectedChapterId) ??
      book.chapters.find((chapter) => chapter.id === selectedChapterId) ??
      book.chapters[0] ??
      null,
  );
  const selectedChapterIndex = $derived(
    selectedChapter ? book.chapters.findIndex((chapter) => chapter.id === selectedChapter.id) : -1,
  );
  const nextChapter = $derived(
    selectedChapterIndex >= 0 ? book.chapters[selectedChapterIndex + 1] ?? null : null,
  );
  const readerChapters = $derived(selectedChapter ? [selectedChapter] : []);
  const readerPages = $derived(readerChapters.flatMap((chapter) => chapter.pages.map(pageToImage)));
  const currentProgress = $derived(getCurrentChapterProgressDisplay(book));
  const currentProgressChapter = $derived(
    currentProgress ? book.chapters.find((chapter) => chapter.id === currentProgress.chapterId) ?? null : null,
  );
  const selectedChapterProgress = $derived(
    selectedChapter ? getChapterProgressDisplay(book, selectedChapter) : null,
  );
  const primaryReadLabel = $derived(
    selectedChapterProgress
      ? selectedChapterProgress.isComplete
        ? "Re-read"
        : "Resume"
      : "Read",
  );

  function pageToImage(page: BookPageDto): ImageListItemDto {
    return {
      id: page.id,
      title: page.title,
      date: null,
      rating: null,
      organized: true,
      isNsfw: book.isNsfw,
      width: page.width,
      height: page.height,
      format: page.format,
      isVideo: false,
      fileSize: null,
      thumbnailPath: page.thumbnailPath,
      previewPath: null,
      fullPath: page.fullPath,
      galleryId: null,
      sortOrder: page.sortOrder,
      studioId: book.studioId,
      performers: [],
      tags: [],
      createdAt: book.createdAt,
    };
  }

  function positionForReaderIndex(index: number) {
    let offset = 0;
    for (const chapter of readerChapters) {
      const nextOffset = offset + chapter.pages.length;
      if (index < nextOffset) {
        return { chapter, pageIndex: index - offset, pageCount: chapter.pages.length };
      }
      offset = nextOffset;
    }
    const chapter = readerChapters.at(-1) ?? selectedChapter;
    return { chapter, pageIndex: Math.max(0, (chapter?.pages.length ?? 1) - 1), pageCount: chapter?.pages.length ?? 0 };
  }

  function openReaderAt(index: number) {
    readerIndex = Math.max(0, Math.min(index, Math.max(0, readerPages.length - 1)));
    readerOpen = true;
  }

  function resumeCurrentChapter() {
    if (!book.progress?.chapterId || !currentProgressChapter) return;
    selectedChapterId = currentProgressChapter.id;
    readerIndex = Math.max(0, Math.min(book.progress.pageIndex, Math.max(0, currentProgressChapter.pageCount - 1)));
    readerOpen = true;
  }

  async function saveProgress(index = readerIndex, completedAt?: string | null) {
    if (readerPages.length === 0) return;
    const position = positionForReaderIndex(index);
    if (!position.chapter) return;
    const nextCompletedAt =
      completedAt === undefined &&
      book.progress?.chapterId === position.chapter.id &&
      book.progress.completedAt
        ? book.progress.completedAt
        : completedAt;
    await updateBookProgress(book.id, {
      chapterId: position.chapter.id,
      pageIndex: position.pageIndex,
      pageCount: position.pageCount,
      readerMode,
      completedAt: nextCompletedAt,
    });
    if (nextCompletedAt) await invalidate(`books:${book.id}`);
  }

  function handleIndexChange(index: number) {
    readerIndex = index;
    const reachedEnd = readerPages.length > 0 && index >= readerPages.length - 1;
    void saveProgress(index, reachedEnd ? new Date().toISOString() : undefined);
  }

  function handleModeChange(mode: "paged" | "webtoon") {
    readerMode = mode;
    void saveProgress(readerIndex);
  }

  async function handleNextChapter() {
    if (!selectedChapter || !nextChapter) return;
    await updateBookProgress(book.id, {
      chapterId: selectedChapter.id,
      pageIndex: Math.max(0, readerPages.length - 1),
      pageCount: readerPages.length,
      readerMode,
      completedAt: new Date().toISOString(),
    });
    await invalidate(`books:${book.id}`);
    selectedChapterId = nextChapter.id;
    readerIndex = 0;
  }

  async function markSelectedChapterRead() {
    if (!selectedChapter || readerPages.length === 0) return;
    const lastIndex = Math.max(0, readerPages.length - 1);
    readerIndex = lastIndex;
    await updateBookProgress(book.id, {
      chapterId: selectedChapter.id,
      pageIndex: lastIndex,
      pageCount: readerPages.length,
      readerMode,
      completedAt: new Date().toISOString(),
    });
    await invalidate(`books:${book.id}`);
  }

  async function closeReader() {
    readerOpen = false;
    const reachedEnd = readerPages.length > 0 && readerIndex >= readerPages.length - 1;
    await saveProgress(readerIndex, reachedEnd ? new Date().toISOString() : undefined);
  }

  async function refreshBook(closeEditor = true) {
    await invalidate(`books:${book.id}`);
    if (closeEditor) editing = false;
  }

  async function handleRatingSave(next: number | null) {
    const previous = book.rating ?? null;
    overrideRating = next;
    try {
      await updateBook(book.id, { rating: next });
      await invalidate(`books:${book.id}`);
    } catch {
      overrideRating = previous;
      throw new Error("Failed to update rating");
    }
  }

  async function confirmDelete(deleteFromDisk: boolean) {
    if (deleteBusy) return;
    deleteBusy = true;
    try {
      await deleteBook(book.id, deleteFromDisk);
      deleteDialogOpen = false;
      await goto("/books");
    } finally {
      deleteBusy = false;
    }
  }

  $effect(() => {
    const crumbs: AppBreadcrumb[] = [
      { label: "Books", href: "/books" },
      { label: book.title },
    ];
    return appChrome.setBreadcrumbs(crumbs);
  });
</script>

<svelte:head>
  <title>{book.title} — Books — Obscura</title>
</svelte:head>

<UploadDropZone target={{ kind: "book", bookId: book.id }} onUploaded={() => invalidateAll()}>
<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <BookOpen class="h-5 w-5 text-text-accent" />
        Books
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">
        Browse comic books by chapter.
      </p>
    </div>
    <ImportButton target={{ kind: "book", bookId: book.id }} onUploaded={() => invalidateAll()} />
  </div>

  <HierarchyShell>
    {#snippet breadcrumbs()}
      <HierarchyBreadcrumbs
        items={[
          { id: "root", title: "Books", href: "/books" },
        ]}
      />
    {/snippet}

      <div class="relative min-h-[240px] overflow-hidden border border-border-subtle bg-surface-1 sm:min-h-[260px] lg:min-h-[280px]">
        <div
          class="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-[var(--color-surface-bg)]"
          aria-hidden="true"
        ></div>

        <div class="relative flex min-h-full w-full flex-col justify-start gap-5 p-4 sm:p-6 lg:flex-row lg:items-start lg:gap-8 lg:p-8">
          <div class="relative w-[124px] flex-shrink-0 sm:w-[190px] lg:w-[230px]">
            <div class="border border-white/15 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
              <EntityThumbnail
                aspectClass="aspect-[2/3]"
                coverImagePath={book.coverImagePath}
                fit="contain"
                isNsfw={book.isNsfw}
                kind="book"
                loading="eager"
                pageCount={book.pageCount}
                previewImagePaths={book.previewImagePaths}
                size="hero"
                title={book.title}
              />
            </div>
          </div>

          <div class="min-w-0 flex-1 lg:max-w-4xl">
            <div class="flex flex-wrap items-center gap-2">
              {#if book.relativePath}
                <div class="inline-flex min-w-0 items-center gap-1.5 border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-white/60 backdrop-blur-md">
                  <HardDrive class="h-3 w-3 flex-shrink-0" />
                  <span class="min-w-0 break-words normal-case tracking-normal">{book.relativePath}</span>
                </div>
              {/if}
              <span class="border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-white/60 backdrop-blur-md">
                {book.chapterCount} chapter{book.chapterCount === 1 ? "" : "s"}
              </span>
              {#if book.readCompleted}<Badge variant="accent">Read</Badge>{/if}
            </div>

            <h1 class="mt-4 max-w-4xl font-heading text-3xl font-semibold leading-tight text-text-primary sm:text-5xl">
              {book.title}
            </h1>

            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.86rem] text-white/70">
              {#if book.studio}
                <a
                  href={`/studios/${book.studio.id}`}
                  class="font-medium text-text-accent transition-colors hover:text-text-accent-bright"
                >
                  {book.studio.name}
                </a>
              {/if}
              {#if book.date}<span>{book.date}</span>{/if}
              <span>{book.pageCount} page{book.pageCount === 1 ? "" : "s"}</span>
              {#if currentProgress}<span>{currentProgress.summaryLabel}</span>{/if}
            </div>

            <div class="mt-3">
              <InlineRating
                value={book.rating}
                onSave={handleRatingSave}
                ariaLabelPrefix="Rate book with"
              />
            </div>

            <div class="mt-5 flex flex-wrap items-center gap-2">
              <IdentifyButton
                entityKind="book"
                entityId={book.id}
                title={book.title}
                label="Identify Book"
              />
              {#if !editing}
                <button
                  type="button"
                  onclick={() => (editing = true)}
                  class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
                >
                  <Pencil class="h-3.5 w-3.5" />
                  Edit
                </button>
              {/if}
              {#if readerPages.length > 0}
                <button
                  type="button"
                  onclick={() => openReaderAt(readerIndex)}
                  class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
                >
                  <Play class="h-3.5 w-3.5" />
                  {primaryReadLabel}
                </button>
                {#if !selectedChapterProgress?.isComplete}
                  <button
                    type="button"
                    onclick={() => void markSelectedChapterRead()}
                    class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
                  >
                    <Check class="h-3.5 w-3.5" />
                    Mark read
                  </button>
                {/if}
              {/if}
              <button
                type="button"
                onclick={() => (deleteDialogOpen = true)}
                class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium text-error-text transition-colors hover:border-status-error/60"
              >
                <Trash2 class="h-3.5 w-3.5" />
                Delete
              </button>
            </div>

            {#if book.details}
              <p class="mt-5 max-w-3xl whitespace-pre-wrap text-[0.95rem] leading-relaxed text-white/80">
                {book.details}
              </p>
            {/if}

            {#if currentProgress?.showMeter}
              <button
                type="button"
                onclick={resumeCurrentChapter}
                class="mt-5 block w-full max-w-xl border border-border-subtle bg-glass-1 p-3 text-left shadow-[0_0_24px_rgba(196,154,90,0.08)] backdrop-blur-md transition-colors duration-fast hover:border-border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50"
                aria-label={`Resume ${currentProgress.chapterLabel}`}
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-[0.62rem] uppercase tracking-[0.14em] text-text-muted">
                      Current chapter
                    </div>
                    <div class="mt-1 truncate text-[0.86rem] font-medium text-text-primary">
                      {currentProgress.chapterLabel}
                    </div>
                  </div>
                  <div class="flex-shrink-0 font-mono text-[0.72rem] text-text-accent">
                    {currentProgress.percent}%
                  </div>
                </div>
                <div class="mt-2 flex items-center justify-between gap-3 text-[0.72rem] text-text-muted">
                  <span>{currentProgress.pageLabel}</span>
                  <span>Resume</span>
                </div>
                <div class="mt-2 h-1 border border-white/10 bg-black/40">
                  <div
                    class="h-full bg-gradient-to-r from-[#7a5228] via-[#c49a5a] to-[#f3d69c] shadow-[0_0_14px_rgba(196,154,90,0.55)]"
                    style:width={`${currentProgress.percent}%`}
                  ></div>
                </div>
              </button>
            {/if}

            {#if book.tags.length > 0}
              <div class="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span class="text-[0.65rem] uppercase tracking-[0.14em] text-white/50">Tags:</span>
                {#each book.tags as tag (tag.id)}
                  <a
                    href={`/tags/${encodeURIComponent(tag.name)}`}
                    class="tag-chip tag-chip-default cursor-pointer transition-colors hover:tag-chip-accent"
                  >
                    <NsfwTagLabel isNsfw={tag.isNsfw} text={tag.name} />
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>

      {#if editing}
        <BookEdit
          {book}
          onSaved={() => void refreshBook()}
          onChanged={() => void refreshBook(false)}
          onCancel={() => (editing = false)}
        />
      {/if}

      {#if book.performers.length > 0}
        <div>
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-kicker">Artists</h4>
          </div>
          <div class="scrollbar-hidden flex gap-3 overflow-x-auto pb-2">
            {#each book.performers as performer (performer.id)}
              {@const img = toApiUrl(performer.imagePath)}
              <a href={`/performers/${performer.id}`} class="group w-[110px] flex-shrink-0">
                <div class="aspect-[3/4] w-full overflow-hidden border border-border-subtle bg-surface-2">
                  {#if img}
                    <img
                      src={img}
                      alt={performer.name}
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  {:else}
                    <div class="flex h-full w-full items-center justify-center text-text-disabled">
                      <BookOpen class="h-8 w-8" />
                    </div>
                  {/if}
                </div>
                <div class="mt-1.5 text-center">
                  <div class="truncate text-[0.72rem] text-text-primary transition-colors group-hover:text-text-accent">
                    {performer.name}
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      {#if hasVolumes}
        <HierarchySection title="Volumes">
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {#each book.volumes as volume (volume.id)}
                <a
                  href={`/books/${book.id}/volumes/${volume.id}`}
                  class="group surface-card overflow-hidden text-left transition-colors duration-fast hover:border-border-accent"
                >
                  <div class="relative aspect-[2/3] bg-surface-2">
                    <EntityThumbnail
                      kind="book"
                      title={volume.title}
                      coverImagePath={volume.coverImagePath ?? volume.chapters[0]?.coverImagePath ?? null}
                      pageCount={volume.chapterCount}
                      isNsfw={book.isNsfw}
                      aspectClass="aspect-[2/3]"
                      fit="contain"
                      showCount={false}
                    />
                  </div>
                  <div class="space-y-1 px-2.5 py-2">
                    <h3 class="truncate text-[0.82rem] font-medium text-text-primary">{volume.title}</h3>
                    <div class="text-[0.68rem] text-text-muted">
                      {volume.chapterCount} chapter{volume.chapterCount === 1 ? "" : "s"} · {volume.pageCount} page{volume.pageCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </a>
              {/each}
            </div>
        </HierarchySection>
      {/if}

      {#if visibleChapters.length > 0}
        <HierarchySection title={hasVolumes ? "Loose chapters" : "Chapters"}>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {#each visibleChapters as chapter (chapter.id)}
                {@const chapterProgress = getChapterProgressDisplay(book, chapter)}
                <a
                  href={`/books/${book.id}/chapters/${chapter.id}`}
                  class="group surface-card overflow-hidden text-left transition-colors duration-fast hover:border-border-accent"
                >
                  <div class="relative aspect-[2/3] bg-surface-2">
                    <EntityThumbnail
                      kind="book"
                      title={chapter.title}
                      coverImagePath={chapter.coverImagePath}
                      pageCount={chapter.pageCount}
                      isNsfw={book.isNsfw}
                      aspectClass="aspect-[2/3]"
                      fit="contain"
                      showCount={false}
                    />
                  </div>
                  <div class="space-y-1 px-2.5 py-2">
                    <h3 class="truncate text-[0.82rem] font-medium text-text-primary">{chapter.title}</h3>
                    <div class="text-[0.68rem] text-text-muted">
                      {#if chapterProgress}
                        {chapterProgress.isComplete ? "Read" : chapterProgress.pageLabel}
                      {:else}
                        {chapter.pageCount} page{chapter.pageCount === 1 ? "" : "s"}
                      {/if}
                    </div>
                    {#if chapterProgress?.showMeter}
                      <div class="h-1 border border-white/10 bg-black/40">
                        <div
                          class="h-full bg-gradient-to-r from-[#7a5228] via-[#c49a5a] to-[#f3d69c] shadow-[0_0_10px_rgba(196,154,90,0.45)]"
                          style:width={`${chapterProgress.percent}%`}
                        ></div>
                      </div>
                    {/if}
                  </div>
                </a>
              {/each}
            </div>
        </HierarchySection>
      {/if}
  </HierarchyShell>
</div>
</UploadDropZone>

{#if readerOpen}
  <ComicReader
    images={readerPages}
    initialIndex={readerIndex}
    initialMode={readerMode}
    nextChapterLabel={nextChapter?.title ?? null}
    title={`${book.title}${selectedChapter ? ` · ${selectedChapter.title}` : ""}`}
    onIndexChange={handleIndexChange}
    onModeChange={handleModeChange}
    onNextChapter={nextChapter ? handleNextChapter : undefined}
    onClose={() => void closeReader()}
  />
{/if}

<ConfirmDeleteDialog
  open={deleteDialogOpen}
  entityType="book"
  count={1}
  loading={deleteBusy}
  allowDeleteFromDisk
  onClose={() => (deleteDialogOpen = false)}
  onDeleteFromLibrary={() => void confirmDelete(false)}
  onDeleteFromDisk={() => void confirmDelete(true)}
/>
