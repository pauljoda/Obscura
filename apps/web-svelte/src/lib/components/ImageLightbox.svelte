<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    X,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Download,
    Info,
    Star,
    Play,
    Pause,
    Volume2,
    VolumeX,
  } from "@lucide/svelte";
  import type { ImageListItemDto } from "@obscura/contracts";
  import { isVideoImage } from "@obscura/contracts";
  import { toApiUrl } from "$lib/api/core";
  import { updateImage } from "$lib/api/media";
  import { buildLightboxImageSource, buildLightboxVideoSources } from "./image-lightbox-media";
  import NsfwBlur from "./nsfw/NsfwBlur.svelte";

  interface Props {
    images: ImageListItemDto[];
    initialIndex: number;
    onClose: () => void;
    onIndexChange?: (index: number) => void;
    onRatingChange?: (imageId: string, rating: number | null) => void;
    autoAdvanceSeconds?: number;
    onAutoAdvance?: () => void;
    onPreviousRequest?: () => void;
    onNextRequest?: () => void;
  }

  let {
    images,
    initialIndex,
    onClose,
    onIndexChange,
    onRatingChange,
    autoAdvanceSeconds = 0,
    onAutoAdvance,
    onPreviousRequest,
    onNextRequest,
  }: Props = $props();

  const MIN_SCALE = 0.3;
  const MAX_SCALE = 8;
  const DOUBLE_TAP_MS = 300;

  let index = $state(untrack(() => initialIndex));
  let scale = $state(1);
  let translateX = $state(0);
  let translateY = $state(0);
  let fitScale = $state(1);
  let infoOpen = $state(false);
  let ratingOverrides = $state<Record<string, number | null>>({});
  let savingRating = $state(false);

  let stageEl: HTMLDivElement | undefined = $state();
  let imgEl: HTMLImageElement | HTMLVideoElement | undefined = $state();
  let naturalW = $state(0);
  let naturalH = $state(0);
  let ready = $state(false);
  let videoPlaying = $state(false);
  let videoMuted = $state(true);
  let videoNeedsGesture = $state(false);
  let videoError = $state<string | null>(null);

  const current = $derived(images[index]);
  const currentRating = $derived.by(() => {
    if (!current) return null;
    const override = ratingOverrides[current.id];
    return override !== undefined ? override : current.rating;
  });
  const isCurrentVideo = $derived(current ? isVideoImage(current) : false);
  const videoSources = $derived.by(() => (current && isCurrentVideo ? buildLightboxVideoSources(current) : []));
  const imageSrc = $derived.by(() => {
    if (!current) return null;
    return toApiUrl(buildLightboxImageSource(current));
  });
  const posterSrc = $derived(current ? toApiUrl(current.thumbnailPath) : null);
  const hasMediaSource = $derived(isCurrentVideo ? videoSources.length > 0 : !!imageSrc);

  $effect(() => {
    onIndexChange?.(index);
  });

  $effect(() => {
    // Reset fit state whenever the image changes; `ready` stays false
    // until the new image loads and applyFit() computes the correct
    // scale, so the viewer doesn't flash the natural-size image.
    if (current) {
      ready = false;
      naturalW = 0;
      naturalH = 0;
      translateX = 0;
      translateY = 0;
      scale = 1;
      fitScale = 1;
      videoPlaying = false;
      videoNeedsGesture = false;
      videoError = null;
    }
  });

  function goPrev() {
    if (onPreviousRequest) {
      onPreviousRequest();
      return;
    }
    if (images.length === 0) return;
    index = (index - 1 + images.length) % images.length;
  }

  function goNext() {
    if (onNextRequest) {
      onNextRequest();
      return;
    }
    if (images.length === 0) return;
    index = (index + 1) % images.length;
  }

  $effect(() => {
    if (!current || autoAdvanceSeconds <= 0) return;
    const timeout = window.setTimeout(() => {
      if (onAutoAdvance) {
        onAutoAdvance();
      } else {
        goNext();
      }
    }, autoAdvanceSeconds * 1000);
    return () => window.clearTimeout(timeout);
  });

  function resetTransform() {
    scale = fitScale || 1;
    translateX = 0;
    translateY = 0;
  }

  function clampTranslate() {
    // Keep the image from drifting off-screen entirely.
    if (!stageEl || !naturalW || !naturalH) return;
    const rect = stageEl.getBoundingClientRect();
    const dispW = naturalW * scale;
    const dispH = naturalH * scale;
    const maxX = Math.max(0, (dispW - rect.width) / 2);
    const maxY = Math.max(0, (dispH - rect.height) / 2);
    // allow a small margin so the image edge is always partly visible
    const marginX = Math.max(40, rect.width * 0.1);
    const marginY = Math.max(40, rect.height * 0.1);
    translateX = Math.min(maxX + marginX, Math.max(-(maxX + marginX), translateX));
    translateY = Math.min(maxY + marginY, Math.max(-(maxY + marginY), translateY));
  }

  function applyFit() {
    if (!stageEl || !naturalW || !naturalH) return;
    const rect = stageEl.getBoundingClientRect();
    const s = Math.min(
      (rect.width * 0.96) / naturalW,
      (rect.height * 0.94) / naturalH,
      1,
    );
    fitScale = s;
    scale = s;
    translateX = 0;
    translateY = 0;
    ready = true;
  }

  function handleImageLoad(event: Event) {
    const el = event.currentTarget as HTMLImageElement | HTMLVideoElement;
    if (el instanceof HTMLImageElement) {
      naturalW = el.naturalWidth;
      naturalH = el.naturalHeight;
    } else {
      naturalW = el.videoWidth || 1280;
      naturalH = el.videoHeight || 720;
    }
    applyFit();
  }

  function handleVideoLoadedMetadata(event: Event) {
    handleImageLoad(event);
    videoError = null;
    void requestVideoPlay(event.currentTarget as HTMLVideoElement);
  }

  async function requestVideoPlay(video: HTMLVideoElement) {
    video.muted = videoMuted;
    try {
      await video.play();
      videoPlaying = true;
      videoNeedsGesture = false;
    } catch {
      videoPlaying = false;
      videoNeedsGesture = true;
    }
  }

  function toggleVideoPlayback() {
    const video = imgEl instanceof HTMLVideoElement ? imgEl : null;
    if (!video) return;
    if (video.paused) {
      void requestVideoPlay(video);
    } else {
      video.pause();
      videoPlaying = false;
      videoNeedsGesture = false;
    }
  }

  function toggleVideoMute() {
    const video = imgEl instanceof HTMLVideoElement ? imgEl : null;
    videoMuted = !videoMuted;
    if (video) video.muted = videoMuted;
  }

  function handleVideoError() {
    videoPlaying = false;
    videoNeedsGesture = false;
    videoError = "This animated file could not be played in this browser.";
  }

  function zoomBy(delta: number, centerX?: number, centerY?: number) {
    const old = scale;
    let next = old * (1 + delta);
    next = Math.min(MAX_SCALE, Math.max(MIN_SCALE * fitScale, next));
    if (next === old) return;
    if (centerX != null && centerY != null && stageEl) {
      const rect = stageEl.getBoundingClientRect();
      const cx = centerX - rect.left - rect.width / 2;
      const cy = centerY - rect.top - rect.height / 2;
      // keep the point under the cursor anchored
      translateX = cx - ((cx - translateX) * next) / old;
      translateY = cy - ((cy - translateY) * next) / old;
    }
    scale = next;
    clampTranslate();
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 0.12 : -0.12, e.clientX, e.clientY);
  }

  let pointerStart: { x: number; y: number; t: number } | null = null;
  let panning = $state(false);
  let lastTapAt = 0;

  function handlePointerDown(e: PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointerStart = { x: e.clientX, y: e.clientY, t: Date.now() };
    panning = scale > fitScale + 0.02;
  }

  function handlePointerMove(e: PointerEvent) {
    if (!pointerStart) return;
    if (!panning) return;
    translateX += e.movementX;
    translateY += e.movementY;
    clampTranslate();
  }

  function handlePointerUp(e: PointerEvent) {
    const start = pointerStart;
    pointerStart = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const elapsed = Date.now() - start.t;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const moved = Math.hypot(dx, dy) > 6;

    if (!panning && !moved && e.pointerType === "mouse") {
      // single click on backdrop (not on image) — close
      const target = e.target as HTMLElement;
      if (!target.closest("[data-lightbox-image]")) {
        onClose();
        return;
      }
    }

    if (panning) {
      panning = false;
      return;
    }

    // Swipe-to-navigate / swipe-down-to-close (only when unzoomed).
    if (scale <= fitScale + 0.02 && e.pointerType !== "mouse") {
      if (elapsed < 700 && Math.max(absX, absY) > 60) {
        if (absX > absY * 1.3) {
          if (dx < 0) goNext();
          else goPrev();
          return;
        }
        if (absY > absX * 1.3 && dy > 0) {
          onClose();
          return;
        }
      }
    }

    // Double-tap / double-click to toggle zoom.
    if (!moved && e.pointerType !== "mouse") {
      const now = Date.now();
      if (now - lastTapAt < DOUBLE_TAP_MS) {
        lastTapAt = 0;
        if (scale > fitScale + 0.02) {
          resetTransform();
        } else {
          scale = fitScale * 2.5;
        }
        return;
      }
      lastTapAt = now;
    }
  }

  function handleDoubleClick(e: MouseEvent) {
    if (scale > fitScale + 0.02) {
      resetTransform();
    } else {
      zoomBy(1.5, e.clientX, e.clientY);
    }
  }

  async function handleRate(value: number) {
    if (!current) return;
    const next = currentRating === value ? null : value;
    const prev = currentRating;
    ratingOverrides = { ...ratingOverrides, [current.id]: next };
    savingRating = true;
    try {
      await updateImage(current.id, { rating: next });
      onRatingChange?.(current.id, next);
    } catch {
      ratingOverrides = { ...ratingOverrides, [current.id]: prev };
    } finally {
      savingRating = false;
    }
  }

  onMount(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (typing && e.key !== "Escape") return;

      if ((e.key === " " || e.code === "Space") && isCurrentVideo) {
        e.preventDefault();
        toggleVideoPlayback();
        return;
      }
      if ((e.key === "m" || e.key === "M") && isCurrentVideo) {
        e.preventDefault();
        toggleVideoMute();
        return;
      }

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowLeft":
        case "h":
        case "H":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowRight":
        case "l":
        case "L":
          e.preventDefault();
          goNext();
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoomBy(0.25);
          break;
        case "-":
        case "_":
          e.preventDefault();
          zoomBy(-0.2);
          break;
        case "0":
          e.preventDefault();
          resetTransform();
          break;
        case "i":
        case "I":
          e.preventDefault();
          infoOpen = !infoOpen;
          break;
        default:
          if (e.key >= "1" && e.key <= "5") {
            e.preventDefault();
            void handleRate(Number(e.key));
          }
      }
    }
    window.addEventListener("keydown", onKey);

    const ro = new ResizeObserver(() => {
      if (naturalW && naturalH) applyFit();
    });
    if (stageEl) ro.observe(stageEl);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      ro.disconnect();
    };
  });

  const counterText = $derived(`${index + 1} / ${images.length}`);
  const downloadHref = $derived(current ? toApiUrl(current.fullPath) ?? undefined : undefined);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm" role="dialog" aria-modal="true">
  <!-- Top bar -->
  <div class="relative z-20 flex items-center gap-2 border-b border-border-subtle bg-black/70 backdrop-blur-md px-3 py-2">
    <button
      type="button"
      onclick={onClose}
      class="p-1.5 text-text-muted hover:text-text-primary transition-colors"
      aria-label="Close"
      title="Close (Esc)"
    >
      <X class="h-5 w-5" />
    </button>
    <div class="flex-1 min-w-0">
      {#if current?.title}
        <h2 class="truncate text-sm font-medium text-text-primary">{current.title}</h2>
      {/if}
      <div class="text-[0.6rem] uppercase tracking-[0.14em] text-text-muted font-mono">
        {counterText}
      </div>
    </div>
    <div class="flex items-center gap-1">
      {#each [1, 2, 3, 4, 5] as n (n)}
        <button
          type="button"
          onclick={() => void handleRate(n)}
          disabled={savingRating}
          class="p-1 text-text-muted hover:text-text-accent transition-colors disabled:opacity-50"
          aria-label={`Rate ${n}`}
          title={`${n}★ (press ${n})`}
        >
          <Star class={`h-4 w-4 ${(currentRating ?? 0) >= n ? "fill-accent-500 text-accent-500" : ""}`} />
        </button>
      {/each}
    </div>
    {#if isCurrentVideo}
      <div class="flex items-center gap-1 border-l border-border-subtle pl-2">
        <button
          type="button"
          onclick={toggleVideoPlayback}
          class="lightbox-video-button"
          aria-label={videoPlaying ? "Pause animated image" : "Play animated image"}
          title={videoPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {#if videoPlaying}
            <Pause class="h-4 w-4" />
          {:else}
            <Play class="h-4 w-4" />
          {/if}
          <span class="hidden lg:inline">{videoPlaying ? "Pause" : videoNeedsGesture ? "Tap to play" : "Play"}</span>
        </button>
        <button
          type="button"
          onclick={toggleVideoMute}
          class="lightbox-video-button"
          aria-label={videoMuted ? "Unmute animated image" : "Mute animated image"}
          title={videoMuted ? "Unmute (M)" : "Mute (M)"}
        >
          {#if videoMuted}
            <VolumeX class="h-4 w-4" />
          {:else}
            <Volume2 class="h-4 w-4" />
          {/if}
        </button>
      </div>
    {/if}
    <button
      type="button"
      onclick={() => (infoOpen = !infoOpen)}
      class={`p-1.5 transition-colors ${infoOpen ? "text-text-accent" : "text-text-muted hover:text-text-primary"}`}
      aria-label="Info"
      title="Info (I)"
    >
      <Info class="h-4 w-4" />
    </button>
    {#if downloadHref}
      <a
        href={downloadHref}
        download={current?.title ?? "image"}
        class="p-1.5 text-text-muted hover:text-text-primary transition-colors"
        aria-label="Download"
        title="Download"
      >
        <Download class="h-4 w-4" />
      </a>
    {/if}
  </div>

  <!-- Stage + optional info sidebar -->
  <div class="relative flex-1 flex min-h-0">
    <div
      bind:this={stageEl}
      class="relative flex-1 overflow-hidden select-none"
      onwheel={handleWheel}
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
      ondblclick={handleDoubleClick}
      style:cursor={scale > fitScale + 0.02 ? (panning ? "grabbing" : "grab") : "default"}
    >
      {#if images.length > 1}
        <button
          type="button"
          onclick={goPrev}
          class="hidden sm:flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 bg-black/50 text-white/80 hover:bg-black/70 hover:text-white transition-colors"
          aria-label="Previous (←)"
        >
          <ChevronLeft class="h-6 w-6" />
        </button>
        <button
          type="button"
          onclick={goNext}
          class="hidden sm:flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 bg-black/50 text-white/80 hover:bg-black/70 hover:text-white transition-colors"
          aria-label="Next (→)"
        >
          <ChevronRight class="h-6 w-6" />
        </button>
      {/if}

      {#if current && hasMediaSource}
        <div
          class="absolute inset-0 flex items-center justify-center"
          style:transform="translate({translateX}px, {translateY}px) scale({scale})"
          style:transform-origin="center center"
          style:opacity={ready ? 1 : 0}
        >
          <NsfwBlur isNsfw={current.isNsfw}>
            {#if isCurrentVideo}
              {#key current.id}
                <video
                  data-lightbox-image
                  bind:this={imgEl as HTMLVideoElement}
                  autoplay
                  loop
                  muted={videoMuted}
                  playsinline
                  preload="metadata"
                  poster={posterSrc ?? undefined}
                  class="max-w-none"
                  style:width="{naturalW}px"
                  style:height="{naturalH}px"
                  onloadedmetadata={handleVideoLoadedMetadata}
                  onplay={() => {
                    videoPlaying = true;
                    videoNeedsGesture = false;
                  }}
                  onpause={() => (videoPlaying = false)}
                  onerror={handleVideoError}
                  draggable="false"
                >
                  {#each videoSources as source (source.src)}
                    {@const sourceUrl = toApiUrl(source.src)}
                    {#if sourceUrl}
                      <source src={sourceUrl} type={source.type} />
                    {/if}
                  {/each}
                </video>
              {/key}
            {:else}
              <img
                data-lightbox-image
                bind:this={imgEl as HTMLImageElement}
                src={imageSrc ?? ""}
                alt={current.title ?? ""}
                class="max-w-none pointer-events-none"
                style:width="{naturalW || "auto"}px"
                style:height="{naturalH || "auto"}px"
                onload={handleImageLoad}
                draggable="false"
              />
            {/if}
          </NsfwBlur>
        </div>
      {/if}

      {#if isCurrentVideo}
        {#if videoError}
          <div class="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 border border-error/35 bg-black/80 px-3 py-2 text-center text-[0.78rem] text-error-text shadow-[0_0_18px_rgba(168,72,80,0.28)]">
            {videoError}
          </div>
        {/if}
      {/if}

      <!-- Keyboard hints (desktop) -->
      <div class="hidden lg:block pointer-events-none absolute bottom-3 left-3 z-10">
        <div class="text-[0.55rem] font-mono uppercase tracking-[0.14em] text-white/25 leading-relaxed">
          <div>
            ← → navigate · +/- zoom · 0 reset · i info · 1-5 rate{isCurrentVideo ? " · space play/pause · m mute" : ""} · esc close
          </div>
        </div>
      </div>
    </div>

    {#if infoOpen && current}
      <aside class="hidden md:flex flex-col w-72 bg-black/60 backdrop-blur-md border-l border-border-subtle text-[0.78rem]">
        <div class="p-3 space-y-3 overflow-y-auto">
          {#if current.title}
            <div>
              <div class="text-kicker">Title</div>
              <p class="text-text-primary">{current.title}</p>
            </div>
          {/if}
          {#if current.width && current.height}
            <div>
              <div class="text-kicker">Dimensions</div>
              <p class="text-text-secondary font-mono">{current.width} × {current.height}</p>
            </div>
          {/if}
          {#if current.format}
            <div>
              <div class="text-kicker">Format</div>
              <p class="text-text-secondary font-mono uppercase">{current.format}</p>
            </div>
          {/if}
          {#if current.date}
            <div>
              <div class="text-kicker">Date</div>
              <p class="text-text-secondary">{current.date}</p>
            </div>
          {/if}
          {#if current.performers.length > 0}
            <div>
              <div class="text-kicker">Performers</div>
              <div class="flex flex-wrap gap-1 mt-1">
                {#each current.performers as p (p.id)}
                  <span class="tag-chip tag-chip-default">{p.name}</span>
                {/each}
              </div>
            </div>
          {/if}
          {#if current.tags.length > 0}
            <div>
              <div class="text-kicker">Tags</div>
              <div class="flex flex-wrap gap-1 mt-1">
                {#each current.tags as t (t.id)}
                  <span class="tag-chip tag-chip-default">{t.name}</span>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </aside>
    {/if}
  </div>

  <!-- Bottom bar -->
  <div class="relative z-20 border-t border-border-subtle bg-black/70 backdrop-blur-md">
    <div class="flex items-center justify-between px-3 py-1.5">
      <div class="flex items-center gap-1">
        <button
          type="button"
          onclick={goPrev}
          class="p-1.5 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Previous"
          title="Previous (←)"
        >
          <ChevronLeft class="h-4 w-4" />
        </button>
        <button
          type="button"
          onclick={goNext}
          class="p-1.5 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Next"
          title="Next (→)"
        >
          <ChevronRight class="h-4 w-4" />
        </button>
      </div>
      <div class="text-[0.7rem] font-mono text-text-muted">{counterText}</div>
      <div class="flex items-center gap-1">
        <button
          type="button"
          onclick={() => zoomBy(-0.2)}
          class="p-1.5 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Zoom out"
          title="Zoom out (-)"
        >
          <ZoomOut class="h-4 w-4" />
        </button>
        <button
          type="button"
          onclick={() => zoomBy(0.25)}
          class="p-1.5 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Zoom in"
          title="Zoom in (+)"
        >
          <ZoomIn class="h-4 w-4" />
        </button>
        <button
          type="button"
          onclick={resetTransform}
          class="p-1.5 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Reset zoom"
          title="Reset (0)"
        >
          <RotateCcw class="h-4 w-4" />
        </button>
      </div>
    </div>

    {#if images.length > 1}
      <div class="border-t border-border-subtle px-2 py-1.5">
        <div class="flex gap-1 overflow-x-auto scrollbar-hidden">
          {#each images as img, i (img.id)}
            <button
              type="button"
              onclick={() => (index = i)}
              class={`flex-shrink-0 aspect-square w-12 overflow-hidden border transition-all ${
                i === index
                  ? "border-border-accent ring-1 ring-accent-500/40"
                  : "border-transparent hover:border-border-subtle opacity-60 hover:opacity-100"
              }`}
              aria-label={`Image ${i + 1}`}
            >
              <img
                src={toApiUrl(img.thumbnailPath) ?? ""}
                alt=""
                class="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .lightbox-video-button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid rgb(255 255 255 / 0.14);
    background: rgb(0 0 0 / 0.68);
    padding: 0.45rem 0.65rem;
    color: rgb(255 255 255 / 0.82);
    font-size: 0.72rem;
    line-height: 1;
    backdrop-filter: blur(12px);
    transition:
      border-color 150ms ease,
      color 150ms ease,
      box-shadow 150ms ease;
  }

  .lightbox-video-button:hover,
  .lightbox-video-button:focus-visible {
    border-color: rgb(196 154 90 / 0.5);
    color: rgb(250 232 198);
    box-shadow: 0 0 18px rgb(196 154 90 / 0.24);
    outline: none;
  }
</style>
