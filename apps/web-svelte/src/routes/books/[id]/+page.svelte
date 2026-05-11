<script lang="ts">
  import { BookOpen, Calendar, FileText, Layers, Play, Rows3 } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import type { BookPageDto, ImageListItemDto } from "@obscura/contracts";
  import type { PageData } from "./$types";
  import { updateBookProgress } from "$lib/api/media";
  import ComicReader from "$lib/components/ComicReader.svelte";
  import EntityThumbnail from "$lib/components/thumbnails/EntityThumbnail.svelte";
  import InlineRating from "$lib/components/InlineRating.svelte";
  import { useAppChrome, type AppBreadcrumb } from "$lib/stores/app-chrome.svelte";

  let { data }: { data: PageData } = $props();
  const book = $derived(data.book);
  const appChrome = useAppChrome();

  // svelte-ignore state_referenced_locally
  let selectedChapterId = $state(data.chapterId ?? book.progress?.chapterId ?? book.chapters[0]?.id ?? null);
  let readerOpen = $state(false);
  // svelte-ignore state_referenced_locally
  let readerIndex = $state(book.progress?.pageIndex ?? 0);
  // svelte-ignore state_referenced_locally
  let readerMode = $state<"paged" | "webtoon">(book.progress?.readerMode ?? "paged");

  const selectedChapter = $derived(
    book.chapters.find((chapter) => chapter.id === selectedChapterId) ?? book.chapters[0] ?? null,
  );
  const readerPages = $derived((selectedChapter?.pages ?? []).map(pageToImage));
  const coverUrl = $derived(book.coverImagePath);
  const progressLabel = $derived(
    book.progress && book.progress.pageCount > 0
      ? `${Math.min(book.progress.pageIndex + 1, book.progress.pageCount)} / ${book.progress.pageCount}`
      : null,
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

  async function saveProgress(index = readerIndex, completedAt?: string | null) {
    if (!selectedChapter || readerPages.length === 0) return;
    await updateBookProgress(book.id, {
      chapterId: selectedChapter.id,
      pageIndex: index,
      pageCount: readerPages.length,
      readerMode,
      completedAt,
    });
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

  async function closeReader() {
    readerOpen = false;
    await saveProgress(readerIndex);
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

<div class="space-y-6">
  <section class="grid gap-5 md:grid-cols-[minmax(10rem,16rem)_1fr]">
    <div class="border border-border-subtle bg-surface-1">
      <EntityThumbnail
        kind="book"
        title={book.title}
        coverImagePath={coverUrl}
        pageCount={book.pageCount}
        isNsfw={book.isNsfw}
        size="hero"
        aspectClass="aspect-[2/3]"
        fit="contain"
        loading="eager"
      />
    </div>

    <div class="min-w-0 space-y-4">
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2 text-kicker">
          <BookOpen class="h-3 w-3" />
          Comic
          {#if book.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
          {#if book.readCompleted}<Badge variant="accent">Read</Badge>{/if}
        </div>
        <h1 class="font-heading text-3xl font-semibold leading-tight text-text-primary sm:text-4xl">
          {book.title}
        </h1>
        <InlineRating value={book.rating} onSave={() => {}} ariaLabelPrefix="Rate book with" readOnly />
      </div>

      {#if book.details}
        <p class="max-w-3xl whitespace-pre-wrap text-[0.86rem] leading-relaxed text-text-secondary">
          {book.details}
        </p>
      {/if}

      <dl class="grid gap-2 text-[0.74rem] text-text-muted sm:grid-cols-2 lg:grid-cols-4">
        <div class="border border-border-subtle bg-surface-1 p-3">
          <dt class="mb-1 flex items-center gap-1.5 text-kicker"><Layers class="h-3 w-3" /> Chapters</dt>
          <dd class="text-text-primary">{book.chapterCount}</dd>
        </div>
        <div class="border border-border-subtle bg-surface-1 p-3">
          <dt class="mb-1 flex items-center gap-1.5 text-kicker"><FileText class="h-3 w-3" /> Pages</dt>
          <dd class="text-text-primary">{book.pageCount}</dd>
        </div>
        {#if book.date}
          <div class="border border-border-subtle bg-surface-1 p-3">
            <dt class="mb-1 flex items-center gap-1.5 text-kicker"><Calendar class="h-3 w-3" /> Date</dt>
            <dd class="text-text-primary">{book.date}</dd>
          </div>
        {/if}
        {#if progressLabel}
          <div class="border border-border-subtle bg-surface-1 p-3">
            <dt class="mb-1 flex items-center gap-1.5 text-kicker"><Rows3 class="h-3 w-3" /> Progress</dt>
            <dd class="text-text-primary">{progressLabel}</dd>
          </div>
        {/if}
      </dl>

      <div class="flex flex-wrap gap-1.5">
        {#each book.performers as performer (performer.id)}
          <a href={`/performers/${performer.id}`} class="tag-chip tag-chip-default hover:tag-chip-accent">
            {performer.name}
          </a>
        {/each}
        {#each book.tags as tag (tag.id)}
          <a href={`/tags/${encodeURIComponent(tag.name)}`} class="tag-chip tag-chip-default hover:tag-chip-accent">
            {tag.name}
          </a>
        {/each}
      </div>
    </div>
  </section>

  <section class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-kicker">Chapters</h2>
      {#if readerPages.length > 0}
        <button
          type="button"
          onclick={() => openReaderAt(readerIndex)}
          class="inline-flex items-center gap-1.5 border border-border-accent px-3 py-1.5 text-[0.78rem] text-text-accent shadow-[0_0_18px_rgba(196,154,90,0.18)] transition-colors hover:text-text-accent-bright"
        >
          <Play class="h-3.5 w-3.5" />
          {book.progress ? "Resume" : "Read"}
        </button>
      {/if}
    </div>

    <div class="grid gap-3 lg:grid-cols-[18rem_1fr]">
      <div class="space-y-1">
        {#each book.chapters as chapter (chapter.id)}
          <button
            type="button"
            onclick={() => {
              selectedChapterId = chapter.id;
              readerIndex = 0;
            }}
            class={`flex w-full items-center justify-between gap-3 border px-3 py-2 text-left text-[0.78rem] transition-colors ${
              selectedChapterId === chapter.id
                ? "border-border-accent bg-accent-950 text-text-accent shadow-[0_0_18px_rgba(196,154,90,0.12)]"
                : "border-border-subtle bg-surface-1 text-text-muted hover:text-text-primary"
            }`}
          >
            <span class="truncate">{chapter.title}</span>
            <span class="shrink-0 font-mono text-[0.64rem]">{chapter.pageCount}</span>
          </button>
        {/each}
      </div>

      {#if selectedChapter}
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {#each selectedChapter.pages as page, index (page.id)}
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
      {/if}
    </div>
  </section>
</div>

{#if readerOpen}
  <ComicReader
    images={readerPages}
    initialIndex={readerIndex}
    initialMode={readerMode}
    title={`${book.title}${selectedChapter ? ` · ${selectedChapter.title}` : ""}`}
    onIndexChange={handleIndexChange}
    onModeChange={handleModeChange}
    onClose={() => void closeReader()}
  />
{/if}
