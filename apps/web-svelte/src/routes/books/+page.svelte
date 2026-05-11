<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { BookOpen } from "@lucide/svelte";
  import type { BookListItemDto } from "@obscura/contracts";
  import type { PageData } from "./$types";
  import BookMergeSeriesDialog from "$lib/components/BookMergeSeriesDialog.svelte";
  import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte";
  import ImportButton from "$lib/components/ImportButton.svelte";
  import UploadDropZone from "$lib/components/UploadDropZone.svelte";
  import { deleteBook } from "$lib/api/media";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";
  import { booksSurfaceConfig } from "$lib/media-surface/configs/books";

  let { data }: { data: PageData } = $props();
  const hasComics = $derived(data.total > 0);
  let pendingDelete = $state<BookListItemDto[]>([]);
  let deleteDialogOpen = $state(false);
  let mergeDialogOpen = $state(false);
  let pendingMerge = $state<BookListItemDto[]>([]);
  let bulkBusy = $state(false);

  const config = $derived(
    booksSurfaceConfig({
      initial: { items: data.books, total: data.total },
      pageSize: data.pageSize,
      page: data.page,
      nsfwMode: data.nsfwMode,
      onMutated: () => invalidateAll(),
      onConfirmDelete: (selected) => {
        pendingDelete = selected;
        deleteDialogOpen = true;
      },
      onMerge: (selected) => {
        pendingMerge = selected;
        mergeDialogOpen = true;
      },
    }),
  );

  async function confirmDelete(deleteFromDisk: boolean) {
    if (bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(pendingDelete.map((book) => deleteBook(book.id, deleteFromDisk)));
      deleteDialogOpen = false;
      pendingDelete = [];
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }
</script>

<svelte:head>
  <title>Books — Obscura</title>
</svelte:head>

<UploadDropZone target={{ kind: "book" }}>
<div class="space-y-5">
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div class="space-y-1">
      <h1 class="flex items-center gap-2.5">
        <BookOpen class="h-5 w-5 text-text-accent" />
        Books
      </h1>
      <p class="text-[0.78rem] text-text-muted">Browse comics and future book formats in your library</p>
    </div>
    <div class="flex items-center gap-2">
      <ImportButton target={{ kind: "book" }} />
      <span class="mt-1 text-mono-sm text-text-disabled">{data.total.toLocaleString()} total</span>
    </div>
  </div>

  <div class="flex items-center gap-1 border-b border-border-subtle">
    {#if hasComics}
      <a
        href="/books"
        aria-current="page"
        class="border-b-2 border-accent-500 px-3 py-2 text-[0.78rem] text-text-accent shadow-[0_10px_24px_rgba(196,154,90,0.12)]"
      >
        Comics
      </a>
    {/if}
  </div>

  <MediaSurface
    {config}
    initialPrefsByFormFactor={data.surfacePrefs}
    legacyPrefsKey="books:filterPresets"
  />
</div>
</UploadDropZone>

<ConfirmDeleteDialog
  open={deleteDialogOpen}
  entityType="book"
  count={pendingDelete.length}
  loading={bulkBusy}
  allowDeleteFromDisk
  onClose={() => (deleteDialogOpen = false)}
  onDeleteFromLibrary={() => void confirmDelete(false)}
  onDeleteFromDisk={() => void confirmDelete(true)}
/>

<BookMergeSeriesDialog
  open={mergeDialogOpen}
  books={pendingMerge}
  onClose={() => (mergeDialogOpen = false)}
  onMerged={(bookId) => {
    mergeDialogOpen = false;
    pendingMerge = [];
    void invalidateAll();
    void goto(`/books/${bookId}`);
  }}
/>
