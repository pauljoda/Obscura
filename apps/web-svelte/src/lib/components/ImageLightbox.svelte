<script lang="ts">
  /**
   * First-pass lightbox. Mirrors the core React ImageLightbox: backdrop
   * overlay, prev/next navigation, close on ESC / backdrop click, image
   * counter, and a minimal filmstrip. The heavyweight React features
   * (edit panel, tag chip input, delete flow, chapter jumps) are
   * scheduled for a later deep pass — first-pass focuses on letting the
   * user actually view full-size images at all.
   */
  import { onMount } from "svelte";
  import { X, ChevronLeft, ChevronRight } from "@lucide/svelte";
  import type { ImageListItemDto } from "@obscura/contracts";
  import { toApiUrl } from "$lib/api/core";

  interface Props {
    images: ImageListItemDto[];
    initialIndex: number;
    onClose: () => void;
    onIndexChange?: (index: number) => void;
  }

  let { images, initialIndex, onClose, onIndexChange }: Props = $props();

  let index = $state(0);

  $effect(() => {
    index = initialIndex;
  });

  $effect(() => {
    onIndexChange?.(index);
  });

  function prev() {
    index = (index - 1 + images.length) % images.length;
  }
  function next() {
    index = (index + 1) % images.length;
  }

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  });

  const current = $derived(images[index]);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <div class="flex items-center justify-between gap-3 border-b border-border-subtle bg-black/60 px-5 py-3">
    <div class="min-w-0 flex-1">
      <div class="text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
        Image {index + 1} of {images.length}
      </div>
      {#if current?.title}
        <h2 class="truncate text-sm font-medium text-text-primary">{current.title}</h2>
      {/if}
    </div>
    <button
      type="button"
      onclick={onClose}
      class="p-1 text-text-muted hover:text-text-primary transition-colors"
      aria-label="Close"
    >
      <X class="h-5 w-5" />
    </button>
  </div>

  <div class="relative flex-1 flex items-center justify-center overflow-hidden px-5 py-4">
    {#if images.length > 1}
      <button
        type="button"
        onclick={prev}
        class="absolute left-4 z-10 p-2 bg-black/50 text-white/80 hover:bg-black/70 hover:text-white transition-colors"
        aria-label="Previous"
      >
        <ChevronLeft class="h-6 w-6" />
      </button>
      <button
        type="button"
        onclick={next}
        class="absolute right-4 z-10 p-2 bg-black/50 text-white/80 hover:bg-black/70 hover:text-white transition-colors"
        aria-label="Next"
      >
        <ChevronRight class="h-6 w-6" />
      </button>
    {/if}
    {#if current}
      {@const src =
        toApiUrl(current.fullPath) ??
        toApiUrl(current.previewPath) ??
        toApiUrl(current.thumbnailPath)}
      <img
        src={src}
        alt={current.title ?? ""}
        class="max-h-full max-w-full object-contain select-none"
        draggable="false"
      />
    {/if}
  </div>

  {#if images.length > 1}
    <div class="border-t border-border-subtle bg-black/60 px-3 py-2">
      <div class="flex gap-1.5 overflow-x-auto scrollbar-hidden">
        {#each images as img, i (img.id)}
          <button
            type="button"
            onclick={() => (index = i)}
            class={`flex-shrink-0 aspect-square w-14 border transition-all ${
              i === index
                ? "border-border-accent ring-1 ring-accent-500/40"
                : "border-transparent hover:border-border-subtle opacity-60 hover:opacity-100"
            }`}
          >
            <img
              src={toApiUrl(img.thumbnailPath) ?? ""}
              alt={img.title}
              class="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
