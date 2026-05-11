<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { ArrowLeft, ArrowRight, BookOpen, Check, HardDrive, Play, RotateCcw } from "@lucide/svelte";
  import type { BookPageDto, ImageListItemDto } from "@obscura/contracts";
  import type { PageData } from "./$types";
  import { updateBookProgress } from "$lib/api/media";
  import ComicReader from "$lib/components/ComicReader.svelte";
  import HierarchyBreadcrumbs from "$lib/components/shared/HierarchyBreadcrumbs.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import HierarchyShell from "$lib/components/shared/HierarchyShell.svelte";
  import EntityThumbnail from "$lib/components/thumbnails/EntityThumbnail.svelte";
  import { getChapterProgressDisplay } from "$lib/book-progress";
  import { useAppChrome, type AppBreadcrumb } from "$lib/stores/app-chrome.svelte";

  let { data }: { data: PageData } = $props();
  const book = $derived(data.book);
  const chapter = $derived(data.chapter);
  const appChrome = useAppChrome();

  let readerOpen = $state(false);
  // svelte-ignore state_referenced_locally
  let readerMode = $state<"paged" | "webtoon">(book.progress?.readerMode ?? "paged");
  // svelte-ignore state_referenced_locally
  let readerIndex = $state(
    book.progress?.chapterId === chapter.id ? book.progress.pageIndex : 0,
  );

  const chapterIndex = $derived(book.chapters.findIndex((item) => item.id === chapter.id));
  const nextChapter = $derived(chapterIndex >= 0 ? book.chapters[chapterIndex + 1] ?? null : null);
  const readerPages = $derived(chapter.pages.map(pageToImage));
  const volume = $derived(
    book.volumes.find((item) => item.chapters.some((child) => child.id === chapter.id)) ?? null,
  );
  const parentHref = $derived(volume ? `/books/${book.id}/volumes/${volume.id}` : `/books/${book.id}`);
  const parentLabel = $derived(volume ? `Back to ${volume.title}` : "Back to book");
  const chapterProgress = $derived(getChapterProgressDisplay(book, chapter));
  const primaryReadLabel = $derived(
    chapterProgress ? (chapterProgress.isComplete ? "Re-read chapter" : "Resume chapter") : "Read chapter",
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

  function openReaderAt(index: number) {
    readerIndex = Math.max(0, Math.min(index, Math.max(0, readerPages.length - 1)));
    readerOpen = true;
  }

  function openPrimaryReader() {
    openReaderAt(chapterProgress?.isComplete ? 0 : readerIndex);
  }

  async function saveProgress(index = readerIndex, completedAt?: string | null) {
    if (readerPages.length === 0) return;
    const nextCompletedAt =
      completedAt === undefined && book.progress?.chapterId === chapter.id && book.progress.completedAt
        ? book.progress.completedAt
        : completedAt;
    await updateBookProgress(book.id, {
      chapterId: chapter.id,
      pageIndex: index,
      pageCount: readerPages.length,
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
    await updateBookProgress(book.id, {
      chapterId: chapter.id,
      pageIndex: Math.max(0, readerPages.length - 1),
      pageCount: readerPages.length,
      readerMode,
      completedAt: new Date().toISOString(),
    });
    await invalidate(`books:${book.id}`);
    await goto(`/books/${book.id}/chapters/${nextChapter.id}`);
  }

  async function markChapterRead() {
    if (readerPages.length === 0) return;
    const lastIndex = Math.max(0, readerPages.length - 1);
    readerIndex = lastIndex;
    await updateBookProgress(book.id, {
      chapterId: chapter.id,
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

  $effect(() => {
    const crumbs: AppBreadcrumb[] = [
      { label: "Books", href: "/books" },
      { label: book.title, href: `/books/${book.id}` },
      ...(volume ? [{ label: volume.title, href: `/books/${book.id}/volumes/${volume.id}` }] : []),
      { label: chapter.title },
    ];
    return appChrome.setBreadcrumbs(crumbs);
  });
</script>

<svelte:head>
  <title>{chapter.title} — {book.title} — Books — Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <a
        href={parentHref}
        class="inline-flex items-center gap-1.5 text-[0.72rem] text-text-muted transition-colors hover:text-text-accent"
      >
        <ArrowLeft class="h-3.5 w-3.5" />
        {parentLabel}
      </a>
      <h1 class="mt-2 flex items-center gap-2.5">
        <BookOpen class="h-5 w-5 text-text-accent" />
        {chapter.title}
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">
        {book.title}{volume ? ` · ${volume.title}` : ""}
      </p>
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
          ...(volume ? [{ id: volume.id, title: volume.title, href: `/books/${book.id}/volumes/${volume.id}` }] : []),
          { id: chapter.id, title: chapter.title, href: `/books/${book.id}/chapters/${chapter.id}` },
        ]}
      />
    {/snippet}

    <div class="relative overflow-hidden border border-border-subtle bg-surface-1">
      <div class="relative flex w-full flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:items-start lg:gap-6">
        <div class="w-[110px] flex-shrink-0 sm:w-[150px]">
          <div class="border border-white/15 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
            <EntityThumbnail
              aspectClass="aspect-[2/3]"
              coverImagePath={chapter.coverImagePath}
              fit="contain"
              isNsfw={book.isNsfw}
              kind="book"
              loading="eager"
              pageCount={chapter.pageCount}
              size="hero"
              title={chapter.title}
            />
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            {#if chapter.relativePath}
              <div class="inline-flex min-w-0 items-center gap-1.5 border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-white/60">
                <HardDrive class="h-3 w-3 flex-shrink-0" />
                <span class="min-w-0 break-words normal-case tracking-normal">{chapter.relativePath}</span>
              </div>
            {/if}
            <span class="border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-white/60">
              Ch. {chapter.chapterNumber}
            </span>
            <span class="border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-white/60">
              {chapter.pageCount} page{chapter.pageCount === 1 ? "" : "s"}
            </span>
            {#if chapterProgress}
              <span class="border border-white/10 bg-black/30 px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-text-accent">
                {chapterProgress.detailLabel}
              </span>
            {/if}
          </div>

          <h2 class="mt-4 max-w-4xl font-heading text-2xl font-semibold leading-tight text-text-primary sm:text-4xl">
            {chapter.title}
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
              {#if !chapterProgress?.isComplete}
                <button
                  type="button"
                  onclick={() => void markChapterRead()}
                  class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
                >
                  <Check class="h-3.5 w-3.5" />
                  Mark read
                </button>
              {/if}
              {#if chapterProgress && !chapterProgress.isComplete}
                <button
                  type="button"
                  onclick={() => openReaderAt(0)}
                  class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
                >
                  <RotateCcw class="h-3.5 w-3.5" />
                  Start over
                </button>
              {/if}
              {#if nextChapter}
                <a
                  href={`/books/${book.id}/chapters/${nextChapter.id}`}
                  class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
                >
                  Next chapter
                  <ArrowRight class="h-3.5 w-3.5" />
                </a>
              {/if}
            </div>
          {/if}

          {#if chapterProgress?.showMeter}
            <div class="mt-5 max-w-xl border border-border-subtle bg-glass-1 p-3 shadow-[0_0_24px_rgba(196,154,90,0.08)] backdrop-blur-md">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-[0.62rem] uppercase tracking-[0.14em] text-text-muted">
                    Reading progress
                  </div>
                  <div class="mt-1 truncate text-[0.86rem] font-medium text-text-primary">
                    {chapterProgress.pageLabel}
                  </div>
                </div>
                <div class="flex-shrink-0 font-mono text-[0.72rem] text-text-accent">
                  {chapterProgress.percent}%
                </div>
              </div>
              <div class="mt-2 h-1 border border-white/10 bg-black/40">
                <div
                  class="h-full bg-gradient-to-r from-[#7a5228] via-[#c49a5a] to-[#f3d69c] shadow-[0_0_14px_rgba(196,154,90,0.55)]"
                  style:width={`${chapterProgress.percent}%`}
                ></div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <HierarchySection title="Pages">
      {#snippet action()}
        <button
          type="button"
          onclick={openPrimaryReader}
          class="text-[0.68rem] text-text-accent hover:text-text-accent-bright"
        >
          {primaryReadLabel}
        </button>
      {/snippet}

      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {#each chapter.pages as page, index (page.id)}
          <button
            type="button"
            class="group overflow-hidden border border-border-subtle bg-surface-1 transition-colors hover:border-border-accent"
            onclick={() => openReaderAt(index)}
          >
            <EntityThumbnail
              kind="image"
              title={page.title}
              thumbnailPath={page.thumbnailPath}
              width={page.width}
              height={page.height}
              aspectClass="aspect-[2/3]"
              showChips={false}
            />
            <div class="truncate px-1.5 py-1 text-left font-mono text-[0.58rem] text-text-disabled">
              {index + 1}
            </div>
          </button>
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
    title={`${book.title} · ${chapter.title}`}
    onIndexChange={handleIndexChange}
    onModeChange={handleModeChange}
    onNextChapter={nextChapter ? handleNextChapter : undefined}
    onClose={() => void closeReader()}
  />
{/if}
