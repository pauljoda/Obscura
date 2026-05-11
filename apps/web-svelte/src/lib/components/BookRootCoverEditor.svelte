<script lang="ts">
  import { BookOpen, Loader2, Upload, X } from "@lucide/svelte";
  import type { BookDetailDto } from "@obscura/contracts";
  import { deleteBookCover, uploadBookCover } from "$lib/api/media";
  import EntityThumbnail from "./thumbnails/EntityThumbnail.svelte";

  interface Props {
    book: BookDetailDto;
    onChanged?: () => void | Promise<void>;
  }

  let { book, onChanged }: Props = $props();

  let uploadInput: HTMLInputElement | null = $state(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);

  const hasCustomCover = $derived(book.coverImagePath === `/assets/books/${book.id}/cover`);

  function openUpload() {
    uploadInput?.click();
  }

  async function handleUpload() {
    const file = uploadInput?.files?.[0];
    if (!file) return;
    busy = true;
    error = null;
    message = null;
    try {
      await uploadBookCover(book.id, file);
      message = "Book cover updated";
      await onChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Upload failed";
    } finally {
      busy = false;
      if (uploadInput) uploadInput.value = "";
    }
  }

  async function clearCover() {
    busy = true;
    error = null;
    message = null;
    try {
      await deleteBookCover(book.id);
      message = "Book cover reset";
      await onChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to clear cover";
    } finally {
      busy = false;
    }
  }
</script>

<div class="space-y-3">
  <h4 class="text-kicker flex items-center gap-2">
    <BookOpen class="h-3.5 w-3.5" />
    Cover
  </h4>

  {#if message}
    <div class="surface-well border border-border-accent p-2.5 text-sm text-text-secondary">
      {message}
    </div>
  {/if}
  {#if error}
    <div class="surface-well border border-status-error/60 p-2.5 text-sm text-error-text">
      {error}
    </div>
  {/if}

  <input
    bind:this={uploadInput}
    type="file"
    accept="image/*"
    class="hidden"
    onchange={() => void handleUpload()}
  />

  <div class="surface-well overflow-hidden">
    <EntityThumbnail
      kind="book"
      title={book.title}
      coverImagePath={book.coverImagePath}
      pageCount={book.pageCount}
      isNsfw={book.isNsfw}
      updatedAt={book.updatedAt}
      size="hero"
      aspectClass="aspect-[2/3]"
      fit="contain"
    />
  </div>

  <div class="flex flex-wrap gap-1.5">
    <button
      type="button"
      onclick={openUpload}
      disabled={busy}
      class="inline-flex items-center gap-1.5 border border-border-default px-2 py-1 text-[0.68rem] text-text-secondary transition-colors hover:border-border-accent hover:text-text-accent disabled:opacity-60"
    >
      {#if busy}
        <Loader2 class="h-3 w-3 animate-spin" />
      {:else}
        <Upload class="h-3 w-3" />
      {/if}
      Upload
    </button>
    {#if hasCustomCover}
      <button
        type="button"
        onclick={() => void clearCover()}
        disabled={busy}
        class="inline-flex items-center gap-1.5 border border-border-default px-2 py-1 text-[0.68rem] text-text-muted transition-colors hover:border-error-text hover:text-error-text disabled:opacity-60"
      >
        <X class="h-3 w-3" />
        Clear
      </button>
    {/if}
  </div>
</div>
