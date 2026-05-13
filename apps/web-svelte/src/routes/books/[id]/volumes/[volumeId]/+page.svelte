<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { ArrowLeft, BookOpen, Check, HardDrive, Play, RotateCcw } from "@lucide/svelte";
  import type { BookPageDto, ImageListItemDto } from "@obscura/contracts";
  import type { PageData } from "./$types";
  import { updateBookProgress } from "$lib/v1/api/media-v1";
  import { getChapterProgressDisplay } from "$lib/book-progress";
  import ComicReader from "$lib/components/ComicReader.svelte";
  import HierarchyBreadcrumbs from "$lib/components/shared/HierarchyBreadcrumbs.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import HierarchyShell from "$lib/components/shared/HierarchyShell.svelte";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import { useAppChrome, type AppBreadcrumb } from "$lib/stores/app-chrome.svelte";

  let { data }: { data: PageData } = $props();
  const book = $derived(data.book);
  const volume = $derived(data.volume);
  const appChrome = useAppChrome();

  let readerOpen = $state(false);
  // svelte-ignore state_referenced_locally
  let readerMode = $state<"paged" | "webtoon">(book.progress?.readerMode ?? "paged");
  // svelte-ignore state_referenced_locally
  let readerIndex = $state(volume.chapters.find((chapter) => chapter.id === book.progress?.chapterId) ? (book.progress?.pageIndex ?? 0) : 0);

  const readerPages = $derived(volume.chapters.flatMap((chapter) => chapter.pages.map(pageToImage)));
  const progressChapter = $derived(
    book.progress?.chapterId ? volume.chapters.find((chapter) => chapter.id === book.progress?.chapterId) ?? null : null,
  );
  const volumeProgress = $derived(progressChapter ? getChapterProgressDisplay(book, progressChapter) : null);
  const primaryReadLabel = $derived(
    volumeProgress ? (volumeProgress.isComplete ? "Re-read volume" : "Resume volume") : "Read volume",
  );
  const nextChapter = $derived.by(() => {
    const last = volume.chapters.at(-1);
    if (!last) return null;
    const index = book.chapters.findIndex((chapter) => chapter.id === last.id);
    return index >= 0 ? book.chapters[index + 1] ?? null : null;
  });

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
    for (const chapter of volume.chapters) {
      const nextOffset = offset + chapter.pages.length;
      if (index < nextOffset) {
        return { chapter, pageIndex: index - offset, pageCount: chapter.pages.length };
      }
      offset = nextOffset;
    }
    const chapter = volume.chapters.at(-1) ?? null;
    return { chapter, pageIndex: Math.max(0, (chapter?.pages.length ?? 1) - 1), pageCount: chapter?.pages.length ?? 0 };
  }

  function readerIndexForProgress() {
    if (!book.progress?.chapterId) return 0;
    let offset = 0;
    for (const chapter of volume.chapters) {
      if (chapter.id === book.progress.chapterId) {
        return offset + Math.max(0, book.progress.pageIndex);
      }
      offset += chapter.pages.length;
    }
    return 0;
  }

  function openReaderAt(index: number) {
    readerIndex = Math.max(0, Math.min(index, Math.max(0, readerPages.length - 1)));
    readerOpen = true;
  }

  function openPrimaryReader() {
    openReaderAt(volumeProgress?.isComplete ? 0 : readerIndexForProgress());
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
    if (!nextChapter) return;
    await saveProgress(Math.max(0, readerPages.length - 1), new Date().toISOString());
    await invalidate(`books:${book.id}`);
    await goto(`/books/${book.id}/chapters/${nextChapter.id}`);
  }

  async function markVolumeRead() {
    if (readerPages.length === 0) return;
    const lastIndex = Math.max(0, readerPages.length - 1);
    readerIndex = lastIndex;
    await saveProgress(lastIndex, new Date().toISOString());
  }

  async function closeReader() {
    readerOpen = false;
    const reachedEnd = readerPages.length > 0 && readerIndex >= readerPages.length - 1;
    await saveProgress(readerIndex, reachedEnd ? new Date().toISOString() : undefined);
  }

  $effect(() => {
    const crumbs: AppBreadcrumb[] = [
      { label: "Books", href: "/books" },
      { label: book.title, href: `/books/${book.id}` },
      { label: volume.title },
    ];
    return appChrome.setBreadcrumbs(crumbs);
  });
</script>

<svelte:head>
  <title>{volume.title} - {book.title} - Books - Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <a
        href={`/books/${book.id}`}
        class="inline-flex items-center gap-1.5 text-[0.72rem] text-text-muted transition-colors hover:text-text-accent"
      >
        <ArrowLeft class="h-3.5 w-3.5" />
        Back to book
      </a>
      <h1 class="mt-2 flex items-center gap-2.5">
        <BookOpen class="h-5 w-5 text-text-accent" />
        {volume.title}
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">{book.title}</p>
    </div>
    {#if readerPages.length > 0}
      <button
        type="button"
        onclick={openPrimaryReader}
        class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
      >
        <Play class="h-3.5 w-3.5" />
        {primaryReadLabel}
      </button>
    {/if}
  </div>

  <HierarchyShell>
    {#snippet breadcrumbs()}
      <HierarchyBreadcrumbs
        items={[
          { id: "root", title: "Books", href: "/books" },
          { id: book.id, title: book.title, href: `/books/${book.id}` },
          { id: volume.id, title: volume.title, href: `/books/${book.id}/volumes/${volume.id}` },
        ]}
      />
    {/snippet}

    <div class="relative overflow-hidden border border-border-subtle bg-surface-1">
      <div class="relative flex w-full flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:items-start lg:gap-6">
        <div class="w-[120px] flex-shrink-0 sm:w-[170px]">
          <div class="border border-white/15 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
            <EntityThumbnail
              aspectClass="aspect-[2/3]"
              coverImagePath={volume.coverImagePath ?? volume.chapters[0]?.coverImagePath ?? null}
              fit="contain"
              isNsfw={book.isNsfw}
              kind="book"
              loading="eager"
              pageCount={volume.chapterCount}
              size="hero"
              title={volume.title}
            />
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            {#if volume.relativePath}
              <div class="inline-flex min-w-0 items-center gap-1.5 border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-white/60">
                <HardDrive class="h-3 w-3 flex-shrink-0" />
                <span class="min-w-0 break-words normal-case tracking-normal">{volume.relativePath}</span>
              </div>
            {/if}
            {#if volume.volumeNumber != null}
              <span class="border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-white/60">
                Vol. {volume.volumeNumber}
              </span>
            {/if}
            <span class="border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-white/60">
              {volume.chapterCount} chapter{volume.chapterCount === 1 ? "" : "s"}
            </span>
            <span class="border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-white/60">
              {volume.pageCount} page{volume.pageCount === 1 ? "" : "s"}
            </span>
            {#if volumeProgress}
              <span class="border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-text-accent">
                {volumeProgress.detailLabel}
              </span>
            {/if}
          </div>

          <h2 class="mt-4 max-w-4xl font-heading text-2xl font-semibold leading-tight text-text-primary sm:text-4xl">
            {volume.title}
          </h2>

          {#if readerPages.length > 0}
            <div class="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onclick={openPrimaryReader}
                class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
              >
                <Play class="h-3.5 w-3.5" />
                {primaryReadLabel}
              </button>
              {#if !volumeProgress?.isComplete}
                <button
                  type="button"
                  onclick={() => void markVolumeRead()}
                  class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
                >
                  <Check class="h-3.5 w-3.5" />
                  Mark read
                </button>
              {/if}
              {#if volumeProgress && !volumeProgress.isComplete}
                <button
                  type="button"
                  onclick={() => openReaderAt(0)}
                  class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
                >
                  <RotateCcw class="h-3.5 w-3.5" />
                  Start over
                </button>
              {/if}
            </div>
          {/if}

          {#if volumeProgress?.showMeter}
            <div class="mt-5 max-w-xl border border-border-subtle bg-glass-1 p-3 shadow-[0_0_24px_rgba(196,154,90,0.08)] backdrop-blur-md">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-[0.62rem] uppercase tracking-[0.14em] text-text-muted">
                    Reading progress
                  </div>
                  <div class="mt-1 truncate text-[0.86rem] font-medium text-text-primary">
                    {volumeProgress.chapterLabel}
                  </div>
                </div>
                <div class="flex-shrink-0 font-mono text-[0.72rem] text-text-accent">
                  {volumeProgress.percent}%
                </div>
              </div>
              <div class="mt-2 flex items-center justify-between gap-3 text-[0.72rem] text-text-muted">
                <span>{volumeProgress.pageLabel}</span>
                <span>{volumeProgress.isComplete ? "Read" : "In progress"}</span>
              </div>
              <div class="mt-2 h-1 border border-white/10 bg-black/40">
                <div
                  class="h-full bg-gradient-to-r from-[#7a5228] via-[#c49a5a] to-[#f3d69c] shadow-[0_0_14px_rgba(196,154,90,0.55)]"
                  style:width={`${volumeProgress.percent}%`}
                ></div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <HierarchySection title="Chapters">
      {#snippet action()}
        <button
          type="button"
          onclick={openPrimaryReader}
          class="text-[0.68rem] text-text-accent hover:text-text-accent-bright"
        >
          {primaryReadLabel}
        </button>
      {/snippet}

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each volume.chapters as chapter (chapter.id)}
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
  </HierarchyShell>
</div>

{#if readerOpen}
  <ComicReader
    images={readerPages}
    initialIndex={readerIndex}
    initialMode={readerMode}
    nextChapterLabel={nextChapter?.title ?? null}
    title={`${book.title} · ${volume.title}`}
    onIndexChange={handleIndexChange}
    onModeChange={handleModeChange}
    onNextChapter={nextChapter ? handleNextChapter : undefined}
    onClose={() => void closeReader()}
  />
{/if}
