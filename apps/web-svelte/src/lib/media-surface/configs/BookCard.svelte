<script lang="ts">
  import { Badge, Checkbox } from "@obscura/ui-svelte";
  import { BookOpen, Files, Landmark } from "@lucide/svelte";
  import type { BookListItemDto } from "@obscura/contracts";
  import type { CardProps } from "$lib/media-surface/config";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";

  let {
    item,
    index,
    imageLoading,
    selected = false,
    onToggleSelect,
    layout = "grid",
  }: CardProps<BookListItemDto> = $props();

  const gradient = $derived(VIDEO_CARD_GRADIENTS[index % VIDEO_CARD_GRADIENTS.length]);
</script>

{#if layout === "list"}
  <div class="relative">
    {#if onToggleSelect}
      <button
        type="button"
        class="glass-2 absolute left-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center border border-border-subtle"
        onclick={() => onToggleSelect?.()}
        aria-label={`Select ${item.title}`}
      >
        <Checkbox checked={selected} />
      </button>
    {/if}
    <a
      href={`/books/${item.id}`}
      class="flex items-center gap-3 py-2 pl-11 pr-3 text-body-sm transition-colors duration-fast hover:bg-surface-2"
    >
      <div class="w-16 shrink-0">
        <EntityThumbnail
          kind="book"
          title={item.title}
          coverImagePath={item.coverImagePath}
          previewImagePaths={item.previewImagePaths}
          pageCount={item.pageCount}
          isNsfw={item.isNsfw}
          updatedAt={item.updatedAt}
          rating={item.rating}
          size="list"
          aspectClass="aspect-[2/3]"
          fit="contain"
          loading={imageLoading}
          gradientFallback={gradient}
          showCount={false}
        />
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-text-primary">{item.title}</div>
        <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-text-muted">
          <span class="inline-flex items-center gap-1">
            <BookOpen class="h-3 w-3" />
            {item.chapterCount} chapter{item.chapterCount === 1 ? "" : "s"}
          </span>
          <span class="inline-flex items-center gap-1">
            <Files class="h-3 w-3" />
            {item.pageCount} page{item.pageCount === 1 ? "" : "s"}
          </span>
          {#if item.studioName}
            <span class="inline-flex min-w-0 items-center gap-1 text-text-accent">
              <Landmark class="h-3 w-3 shrink-0" />
              <span class="truncate">{item.studioName}</span>
            </span>
          {/if}
          {#if item.date}<span>{item.date}</span>{/if}
        </div>
      </div>
      {#if item.readCompleted}<Badge variant="accent">Read</Badge>{/if}
    </a>
  </div>
{:else}
  <div class="relative">
    {#if onToggleSelect}
      <button
        type="button"
        class="glass-2 absolute left-1.5 top-1.5 z-20 flex h-7 w-7 items-center justify-center border border-border-subtle shadow-[var(--shadow-soft)]"
        onclick={() => onToggleSelect?.()}
        aria-label={`Select ${item.title}`}
      >
        <Checkbox checked={selected} />
      </button>
    {/if}
    <a
      href={`/books/${item.id}`}
      class="surface-card-sharp block overflow-hidden transition-colors duration-fast hover:border-border-accent"
    >
      <div class={onToggleSelect ? "p-1" : ""}>
        <EntityThumbnail
          kind="book"
          title={item.title}
          coverImagePath={item.coverImagePath}
          previewImagePaths={item.previewImagePaths}
          pageCount={item.pageCount}
          isNsfw={item.isNsfw}
          updatedAt={item.updatedAt}
          rating={item.rating}
          size="grid"
          aspectClass="aspect-[2/3]"
          fit="contain"
          loading={imageLoading}
          gradientFallback={gradient}
          showCount={false}
        />
      </div>
      <div class="space-y-1 p-2.5">
        <h4 class="truncate text-body font-medium text-text-primary">{item.title}</h4>
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.65rem] text-text-muted">
          <span class="inline-flex items-center gap-1">
            <BookOpen class="h-3 w-3" />
            {item.chapterCount} chapter{item.chapterCount === 1 ? "" : "s"}
          </span>
          <span class="inline-flex items-center gap-1">
            <Files class="h-3 w-3" />
            {item.pageCount} page{item.pageCount === 1 ? "" : "s"}
          </span>
          {#if item.studioName}<span class="truncate text-text-accent">· {item.studioName}</span>{/if}
          {#if item.readCompleted}<Badge variant="accent">Read</Badge>{/if}
        </div>
      </div>
    </a>
  </div>
{/if}
