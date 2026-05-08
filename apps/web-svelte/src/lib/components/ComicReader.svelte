<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    BookOpen,
    Columns2,
    Rows3,
    ChevronLeft,
    ChevronRight,
    Image as ImageIcon,
    X,
  } from "@lucide/svelte";
  import type { ImageListItemDto } from "@obscura/contracts";
  import { fade } from "svelte/transition";
  import { dur, ease } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import NsfwBlur from "./nsfw/NsfwBlur.svelte";
  import {
    comicSpreadForIndex,
    comicTapZone,
    nextComicIndex,
    previousComicIndex,
    type ComicPageMode,
  } from "./comic-reader";

  type ReaderMode = "paged" | "webtoon";

  interface Props {
    images: ImageListItemDto[];
    initialIndex: number;
    title?: string;
    onClose: () => void;
  }

  let { images, initialIndex, title = "Comic", onClose }: Props = $props();

  let readerMode = $state<ReaderMode>("paged");
  let pageMode = $state<ComicPageMode>("single");
  let firstPageIsCover = $state(true);
  let index = $state(untrack(() => initialIndex));
  let controlsVisible = $state(true);
  let controlsTimer: number | null = null;

  const spread = $derived(
    comicSpreadForIndex(index, images.length, { pageMode, firstPageIsCover }),
  );
  const counterText = $derived(
    spread.length > 1
      ? `${spread[0] + 1}-${spread[spread.length - 1] + 1} / ${images.length}`
      : `${Math.min(index + 1, images.length)} / ${images.length}`,
  );

  function goNext() {
    index = nextComicIndex(index, images.length, { pageMode, firstPageIsCover });
  }

  function goPrev() {
    index = previousComicIndex(index, images.length, { pageMode, firstPageIsCover });
  }

  function imageSrc(image: ImageListItemDto) {
    return toApiUrl(image.fullPath ?? image.thumbnailPath) ?? "";
  }

  function clearControlsTimer() {
    if (!controlsTimer) return;
    window.clearTimeout(controlsTimer);
    controlsTimer = null;
  }

  function showControlsTemporarily() {
    controlsVisible = true;
    clearControlsTimer();
    controlsTimer = window.setTimeout(() => {
      controlsVisible = false;
      controlsTimer = null;
    }, 2800);
  }

  function toggleControls() {
    if (controlsVisible) {
      controlsVisible = false;
      clearControlsTimer();
    } else {
      showControlsTemporarily();
    }
  }

  function handleReaderTap(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (target.closest("[data-reader-control]")) return;
    if (event.pointerType === "mouse") return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const zone = comicTapZone(event.clientX - rect.left, rect.width);
    if (zone === "previous") goPrev();
    else if (zone === "next") goNext();
    else toggleControls();
  }

  onMount(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (typing && event.key !== "Escape") return;

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          onClose();
          break;
        case "ArrowLeft":
        case "h":
        case "H":
          event.preventDefault();
          goPrev();
          break;
        case "ArrowRight":
        case "l":
        case "L":
        case " ":
          event.preventDefault();
          goNext();
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    showControlsTemporarily();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearControlsTimer();
    };
  });
</script>

<div
  class="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm"
  role="dialog"
  aria-modal="true"
  in:fade={{ duration: dur.normal, easing: ease.enter }}
  out:fade={{ duration: dur.fast, easing: ease.exit }}
>
  <div
    data-reader-control
    class={`reader-top-layer ${controlsVisible ? "reader-layer-visible" : "reader-layer-hidden"}`}
  >
    <button
      type="button"
      onclick={onClose}
      class="reader-icon-button"
      aria-label="Close"
      title="Close (Esc)"
    >
      <X class="h-5 w-5" />
    </button>

    <div class="min-w-0 flex-1">
      <h2 class="truncate text-sm font-medium text-text-primary">{title}</h2>
      <div class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
        {counterText}
      </div>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        onclick={() => (readerMode = "paged")}
        class:active-reader-control={readerMode === "paged"}
        class="reader-mode-button"
        aria-label="Paged reader"
        title="Paged reader"
      >
        <BookOpen class="h-4 w-4" />
        <span class="hidden sm:inline">Paged</span>
      </button>
      <button
        type="button"
        onclick={() => (readerMode = "webtoon")}
        class:active-reader-control={readerMode === "webtoon"}
        class="reader-mode-button"
        aria-label="Webtoon reader"
        title="Webtoon reader"
      >
        <Rows3 class="h-4 w-4" />
        <span class="hidden sm:inline">Webtoon</span>
      </button>
    </div>

    {#if readerMode === "paged"}
      <div class="hidden items-center gap-1 border-l border-border-subtle pl-2 sm:flex">
        <button
          type="button"
          onclick={() => (pageMode = pageMode === "single" ? "double" : "single")}
          class:active-reader-control={pageMode === "double"}
          class="reader-mode-button"
          aria-label="Toggle one or two pages"
          title="Toggle one or two pages"
        >
          {#if pageMode === "double"}
            <Columns2 class="h-4 w-4" />
            <span>2 pages</span>
          {:else}
            <ImageIcon class="h-4 w-4" />
            <span>1 page</span>
          {/if}
        </button>
        {#if pageMode === "double"}
          <label class="reader-check">
            <input type="checkbox" bind:checked={firstPageIsCover} />
            <span>First page is cover</span>
          </label>
        {/if}
      </div>
    {/if}
  </div>

  {#if readerMode === "webtoon"}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="reader-stage overflow-y-auto bg-black" onpointerup={handleReaderTap}>
      <div class="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center">
        {#each images as image (image.id)}
          <NsfwBlur isNsfw={image.isNsfw} class="w-full">
            <img
              src={imageSrc(image)}
              alt={image.title}
              class="block h-auto w-full bg-surface-1"
              loading="lazy"
              decoding="async"
            />
          </NsfwBlur>
        {/each}
      </div>
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="reader-stage items-center justify-center overflow-hidden bg-black p-0 sm:px-14 sm:py-3" onpointerup={handleReaderTap}>
      {#if images.length > 1}
        <button
          type="button"
          onclick={goPrev}
          data-reader-control
          class="reader-nav-button left-2 sm:left-3"
          aria-label="Previous page"
          title="Previous (←)"
        >
          <ChevronLeft class="h-6 w-6" />
        </button>
        <button
          type="button"
          onclick={goNext}
          data-reader-control
          class="reader-nav-button right-2 sm:right-3"
          aria-label="Next page"
          title="Next (→)"
        >
          <ChevronRight class="h-6 w-6" />
        </button>
      {/if}

      <div
        class={`flex h-full w-full items-center justify-center gap-2 ${
          spread.length > 1 ? "max-w-7xl" : "max-w-5xl"
        }`}
      >
        {#each spread as pageIndex (pageIndex)}
          {@const image = images[pageIndex]}
          {#if image}
            <NsfwBlur isNsfw={image.isNsfw} class="flex h-full min-w-0 flex-1 items-center justify-center">
              <img
                src={imageSrc(image)}
                alt={image.title}
                class="max-h-full max-w-full object-contain shadow-[0_0_30px_rgba(0,0,0,0.45)]"
                loading="eager"
                decoding="async"
              />
            </NsfwBlur>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <div
    data-reader-control
    class={`reader-bottom-layer ${controlsVisible ? "reader-layer-visible" : "reader-layer-hidden"}`}
  >
    <div class="flex items-center justify-between gap-2">
      <button type="button" onclick={goPrev} class="reader-mode-button">
        <ChevronLeft class="h-4 w-4" />
        Prev
      </button>
      <div class="font-mono text-[0.68rem] text-text-muted">{counterText}</div>
      <button type="button" onclick={goNext} class="reader-mode-button">
        Next
        <ChevronRight class="h-4 w-4" />
      </button>
    </div>
    {#if readerMode === "paged"}
      <div class="mt-2 flex items-center justify-center gap-2">
        <button
          type="button"
          onclick={() => (pageMode = pageMode === "single" ? "double" : "single")}
          class:active-reader-control={pageMode === "double"}
          class="reader-mode-button"
        >
          {pageMode === "double" ? "2 pages" : "1 page"}
        </button>
        {#if pageMode === "double"}
          <label class="reader-check">
            <input type="checkbox" bind:checked={firstPageIsCover} />
            <span>Cover first</span>
          </label>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .reader-icon-button,
  .reader-mode-button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid rgb(255 255 255 / 0.14);
    background: rgb(0 0 0 / 0.62);
    padding: 0.45rem 0.65rem;
    color: rgb(255 255 255 / 0.78);
    font-size: 0.72rem;
    line-height: 1;
    backdrop-filter: blur(12px);
    transition:
      border-color 150ms ease,
      color 150ms ease,
      box-shadow 150ms ease;
  }

  .reader-stage {
    position: absolute;
    inset: 0;
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    touch-action: manipulation;
  }

  .reader-top-layer,
  .reader-bottom-layer {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 20;
    border-color: rgb(255 255 255 / 0.12);
    background: linear-gradient(
      to bottom,
      rgb(0 0 0 / 0.78),
      rgb(0 0 0 / 0.48) 68%,
      rgb(0 0 0 / 0)
    );
    padding: max(0.5rem, env(safe-area-inset-top)) 0.75rem 1.25rem;
    backdrop-filter: blur(14px);
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }

  .reader-top-layer {
    top: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .reader-bottom-layer {
    bottom: 0;
    border-top: 1px solid rgb(255 255 255 / 0.12);
    background: linear-gradient(
      to top,
      rgb(0 0 0 / 0.78),
      rgb(0 0 0 / 0.48) 68%,
      rgb(0 0 0 / 0)
    );
    padding: 1.25rem 0.75rem max(0.5rem, env(safe-area-inset-bottom));
  }

  .reader-layer-visible {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  .reader-layer-hidden {
    opacity: 0;
    pointer-events: none;
  }

  .reader-top-layer.reader-layer-hidden {
    transform: translateY(-0.75rem);
  }

  .reader-bottom-layer.reader-layer-hidden {
    transform: translateY(0.75rem);
  }

  .reader-icon-button {
    padding: 0.4rem;
  }

  .reader-mode-button:hover,
  .reader-mode-button:focus-visible,
  .reader-icon-button:hover,
  .reader-icon-button:focus-visible,
  .active-reader-control {
    border-color: rgb(196 154 90 / 0.55);
    color: rgb(250 232 198);
    box-shadow: 0 0 18px rgb(196 154 90 / 0.24);
    outline: none;
  }

  .reader-nav-button {
    position: absolute;
    top: 50%;
    z-index: 10;
    display: none;
    height: 2.75rem;
    width: 2.75rem;
    transform: translateY(-50%);
    align-items: center;
    justify-content: center;
    border: 1px solid rgb(255 255 255 / 0.12);
    background: rgb(0 0 0 / 0.56);
    color: rgb(255 255 255 / 0.76);
    backdrop-filter: blur(12px);
  }

  .reader-nav-button:hover,
  .reader-nav-button:focus-visible {
    border-color: rgb(196 154 90 / 0.55);
    color: rgb(250 232 198);
    box-shadow: 0 0 18px rgb(196 154 90 / 0.2);
    outline: none;
  }

  .reader-check {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid rgb(255 255 255 / 0.14);
    background: rgb(0 0 0 / 0.62);
    padding: 0.45rem 0.65rem;
    color: rgb(255 255 255 / 0.76);
    font-size: 0.72rem;
    line-height: 1;
  }

  .reader-check input {
    accent-color: #c49a5a;
  }

  @media (min-width: 640px) {
    .reader-stage {
      inset: 3.65rem 0 0;
    }

    .reader-top-layer {
      border-bottom: 1px solid rgb(255 255 255 / 0.12);
      background: rgb(0 0 0 / 0.72);
      padding: 0.5rem 0.75rem;
    }

    .reader-bottom-layer {
      display: none;
    }

    .reader-nav-button {
      display: flex;
    }
  }
</style>
