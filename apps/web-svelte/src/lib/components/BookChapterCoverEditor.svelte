<script lang="ts">
  import { BookOpen, Image as ImageIcon, Loader2, Upload, X } from "@lucide/svelte";
  import type { BookChapterDto } from "@obscura/contracts";
  import {
    deleteBookChapterCover,
    setBookChapterCoverFromPage,
    uploadBookChapterCover,
  } from "$lib/v1/api/media-v1";
  import { v2ApiAssetUrl as toApiUrl } from "$lib/api/orval-fetch";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import NsfwBlur from "./nsfw/NsfwBlur.svelte";

  interface Props {
    chapters: BookChapterDto[];
    isNsfw: boolean;
    onChanged?: () => void | Promise<void>;
  }

  let { chapters, isNsfw, onChanged }: Props = $props();

  let uploadInput: HTMLInputElement | null = $state(null);
  let uploadChapterId = $state<string | null>(null);
  let pickerChapterId = $state<string | null>(null);
  let busyChapterId = $state<string | null>(null);
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);

  const pickerChapter = $derived(
    chapters.find((chapter) => chapter.id === pickerChapterId) ?? null,
  );

  function openUpload(chapterId: string) {
    uploadChapterId = chapterId;
    uploadInput?.click();
  }

  async function handleUpload() {
    const file = uploadInput?.files?.[0];
    const chapterId = uploadChapterId;
    if (!file || !chapterId) return;
    busyChapterId = chapterId;
    error = null;
    message = null;
    try {
      await uploadBookChapterCover(chapterId, file);
      message = "Chapter cover updated";
      await onChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Upload failed";
    } finally {
      busyChapterId = null;
      uploadChapterId = null;
      if (uploadInput) uploadInput.value = "";
    }
  }

  async function usePageCover(chapterId: string, pageId: string, closePicker = false) {
    busyChapterId = chapterId;
    error = null;
    message = null;
    try {
      await setBookChapterCoverFromPage(chapterId, pageId);
      message = "Chapter cover updated";
      if (closePicker) pickerChapterId = null;
      await onChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to set cover";
    } finally {
      busyChapterId = null;
    }
  }

  async function clearCover(chapterId: string) {
    busyChapterId = chapterId;
    error = null;
    message = null;
    try {
      await deleteBookChapterCover(chapterId);
      message = "Chapter cover reset";
      await onChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to clear cover";
    } finally {
      busyChapterId = null;
    }
  }
</script>

<section class="surface-panel space-y-4 p-5">
  <div class="flex items-start justify-between gap-3">
    <div class="space-y-1">
      <h3 class="text-kicker flex items-center gap-2">
        <BookOpen class="h-3.5 w-3.5" />
        Chapter Covers
      </h3>
      <p class="text-[0.78rem] text-text-muted">
        Use a custom image, choose a comic page, or reset to the first page.
      </p>
    </div>
  </div>

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

  <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {#each chapters as chapter (chapter.id)}
      {@const busy = busyChapterId === chapter.id}
      {@const firstPage = chapter.pages[0] ?? null}
      <article class="surface-card-sharp overflow-hidden">
        <div class="grid grid-cols-[92px_1fr] gap-3 p-3">
          <div class="border border-border-subtle bg-surface-2">
            <EntityThumbnail
              kind="book"
              title={chapter.title}
              coverImagePath={chapter.coverImagePath}
              pageCount={chapter.pageCount}
              {isNsfw}
              aspectClass="aspect-[2/3]"
              fit="contain"
              showCount={false}
            />
          </div>
          <div class="min-w-0 space-y-2">
            <div>
              <h4 class="truncate text-[0.86rem] font-medium text-text-primary">
                {chapter.title}
              </h4>
              <div class="mt-1 text-[0.68rem] text-text-muted">
                {chapter.pageCount} page{chapter.pageCount === 1 ? "" : "s"}
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                onclick={() => openUpload(chapter.id)}
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
              <button
                type="button"
                onclick={() => firstPage && void usePageCover(chapter.id, firstPage.id)}
                disabled={busy || !firstPage}
                class="inline-flex items-center gap-1.5 border border-border-default px-2 py-1 text-[0.68rem] text-text-secondary transition-colors hover:border-border-accent hover:text-text-accent disabled:opacity-60"
              >
                <ImageIcon class="h-3 w-3" />
                First page
              </button>
              <button
                type="button"
                onclick={() => (pickerChapterId = chapter.id)}
                disabled={busy || chapter.pages.length === 0}
                class="inline-flex items-center gap-1.5 border border-border-default px-2 py-1 text-[0.68rem] text-text-secondary transition-colors hover:border-border-accent hover:text-text-accent disabled:opacity-60"
              >
                <ImageIcon class="h-3 w-3" />
                Pick page
              </button>
              {#if chapter.hasCustomCover || chapter.coverPageId}
                <button
                  type="button"
                  onclick={() => void clearCover(chapter.id)}
                  disabled={busy}
                  class="inline-flex items-center gap-1.5 border border-border-default px-2 py-1 text-[0.68rem] text-text-muted transition-colors hover:border-error-text hover:text-error-text disabled:opacity-60"
                >
                  <X class="h-3 w-3" />
                  Clear
                </button>
              {/if}
            </div>
          </div>
        </div>
      </article>
    {/each}
  </div>
</section>

{#if pickerChapter}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    onclick={() => (pickerChapterId = null)}
  >
    <div
      class="surface-panel flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden"
      onclick={(event) => event.stopPropagation()}
    >
      <div class="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h3 class="text-sm font-medium text-text-primary">
          Choose a cover page
        </h3>
        <button
          type="button"
          onclick={() => (pickerChapterId = null)}
          class="text-text-muted transition-colors hover:text-text-primary"
          aria-label="Close"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-3">
        <div class="grid grid-cols-3 gap-1.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {#each pickerChapter.pages as page, index (page.id)}
            <button
              type="button"
              disabled={busyChapterId === pickerChapter.id}
              onclick={() => void usePageCover(pickerChapter.id, page.id, true)}
              class="overflow-hidden border border-border-subtle bg-surface-1 text-left transition-colors hover:border-border-accent disabled:opacity-50"
              title={page.title}
            >
              <NsfwBlur {isNsfw} class="block aspect-[2/3] w-full">
                {#if page.thumbnailPath || page.fullPath}
                  <img
                    src={toApiUrl(page.thumbnailPath ?? page.fullPath)}
                    alt={page.title}
                    class="h-full w-full object-contain"
                    loading="lazy"
                  />
                {/if}
              </NsfwBlur>
              <div class="truncate px-1.5 py-1 font-mono text-[0.58rem] text-text-disabled">
                {index + 1}
              </div>
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}
