<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { BookOpen, Calendar, FileText, HardDrive, Layers, Play, Rows3, Trash2 } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import type { BookPageDto, ImageListItemDto } from "@obscura/contracts";
  import type { PageData } from "./$types";
  import { deleteBook, updateBookProgress } from "$lib/api/media";
  import ComicReader from "$lib/components/ComicReader.svelte";
  import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte";
  import HierarchyBreadcrumbs from "$lib/components/shared/HierarchyBreadcrumbs.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import HierarchyShell from "$lib/components/shared/HierarchyShell.svelte";
  import IdentifyButton from "$lib/components/IdentifyButton.svelte";
  import ImportButton from "$lib/components/ImportButton.svelte";
  import EntityThumbnail from "$lib/components/thumbnails/EntityThumbnail.svelte";
  import NsfwTagLabel from "$lib/components/nsfw/NsfwTagLabel.svelte";
  import UploadDropZone from "$lib/components/UploadDropZone.svelte";
  import { toApiUrl } from "$lib/api/core";
  import { useAppChrome, type AppBreadcrumb } from "$lib/stores/app-chrome.svelte";

  let { data }: { data: PageData } = $props();
  const book = $derived(data.book);
  const appChrome = useAppChrome();

  // svelte-ignore state_referenced_locally
  let selectedChapterId = $state(data.chapterId ?? book.progress?.chapterId ?? book.chapters[0]?.id ?? null);
  let readerOpen = $state(false);
  let deleteDialogOpen = $state(false);
  let deleteBusy = $state(false);
  // svelte-ignore state_referenced_locally
  let readerIndex = $state(book.progress?.pageIndex ?? 0);
  // svelte-ignore state_referenced_locally
  let readerMode = $state<"paged" | "webtoon">(book.progress?.readerMode ?? "paged");

  const selectedChapter = $derived(
    book.chapters.find((chapter) => chapter.id === selectedChapterId) ?? book.chapters[0] ?? null,
  );
  const readerPages = $derived((selectedChapter?.pages ?? []).map(pageToImage));
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
              {#if book.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
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
              {#if progressLabel}<span>{progressLabel}</span>{/if}
            </div>

            <div class="mt-5 flex flex-wrap items-center gap-2">
              <IdentifyButton
                entityKind="book"
                entityId={book.id}
                title={book.title}
                label="Identify Book"
              />
              {#if readerPages.length > 0}
                <button
                  type="button"
                  onclick={() => openReaderAt(readerIndex)}
                  class="surface-card inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors hover:border-border-accent"
                >
                  <Play class="h-3.5 w-3.5" />
                  {book.progress ? "Resume" : "Read"}
                </button>
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

      {#if book.performers.length > 0}
        <div>
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-kicker">Cast & Crew</h4>
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

      {#if book.chapters.length > 0}
        <HierarchySection title="Chapters">
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {#each book.chapters as chapter (chapter.id)}
                <button
                  type="button"
                  onclick={() => {
                    selectedChapterId = chapter.id;
                    readerIndex = 0;
                  }}
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
                      {chapter.pageCount} page{chapter.pageCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </button>
              {/each}
            </div>
        </HierarchySection>
      {/if}

      {#if selectedChapter}
        <HierarchySection title={selectedChapter.title}>
          {#snippet action()}
            <button
              type="button"
              onclick={() => openReaderAt(readerIndex)}
              class="text-[0.68rem] text-text-accent hover:text-text-accent-bright"
            >
              Read chapter
            </button>
          {/snippet}

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
    title={`${book.title}${selectedChapter ? ` · ${selectedChapter.title}` : ""}`}
    onIndexChange={handleIndexChange}
    onModeChange={handleModeChange}
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
