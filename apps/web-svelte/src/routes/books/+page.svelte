<script lang="ts">
  import { BookOpen, Search } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import type { PageData } from "./$types";
  import EntityThumbnail from "$lib/components/thumbnails/EntityThumbnail.svelte";

  let { data }: { data: PageData } = $props();
  const hasComics = $derived(data.total > 0);
</script>

<svelte:head>
  <title>Books — Obscura</title>
</svelte:head>

<div class="space-y-5">
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div class="space-y-1">
      <h1 class="flex items-center gap-2.5">
        <BookOpen class="h-5 w-5 text-text-accent" />
        Books
      </h1>
      <p class="text-[0.78rem] text-text-muted">Browse comics and future book formats in your library</p>
    </div>
    <span class="mt-1 text-mono-sm text-text-disabled">{data.total.toLocaleString()} total</span>
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

  <form method="GET" class="flex max-w-lg items-center gap-2 border border-border-default bg-surface-1 px-3 py-2">
    <Search class="h-4 w-4 text-text-disabled" />
    <input
      name="search"
      value={data.search}
      placeholder="Search books..."
      class="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled focus:outline-none"
    />
    <button type="submit" class="text-mono-sm text-text-muted hover:text-text-accent">Search</button>
  </form>

  {#if data.books.length > 0}
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      {#each data.books as book, index (book.id)}
        <a
          href={`/books/${book.id}`}
          class="group block overflow-hidden border border-border-subtle bg-surface-1 transition-colors hover:border-border-accent"
        >
          <EntityThumbnail
            kind="book"
            title={book.title}
            coverImagePath={book.coverImagePath}
            pageCount={book.pageCount}
            isNsfw={book.isNsfw}
            aspectClass="aspect-[2/3]"
            fit="contain"
            gradientIndex={index}
          />
          <div class="space-y-1 p-2">
            <h2 class="truncate text-[0.78rem] font-medium text-text-primary group-hover:text-text-accent">
              {book.title}
            </h2>
            <div class="flex flex-wrap items-center gap-1 text-[0.62rem] text-text-muted">
              <span>{book.chapterCount} chapter{book.chapterCount === 1 ? "" : "s"}</span>
              <span>·</span>
              <span>{book.pageCount} pages</span>
              {#if book.readCompleted}<Badge variant="accent">Read</Badge>{/if}
              {#if book.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {:else}
    <div class="surface-well flex flex-col items-center justify-center py-16 text-center">
      <BookOpen class="mb-2 h-8 w-8 text-text-disabled" />
      <p class="text-sm text-text-muted">No comic books found</p>
    </div>
  {/if}
</div>
