<script lang="ts">
  import { LoaderCircle } from "@lucide/svelte";
  import { onMount, untrack } from "svelte";

  interface Props {
    error?: string | null;
    hasMore: boolean;
    label?: string;
    loading: boolean;
    loadKey?: string | number;
    nextHref: string;
    onLoad: () => void | Promise<void>;
    /** Distance from the bottom, in pixels, at which to fire onLoad. */
    threshold?: number;
  }

  let {
    error = null,
    hasMore,
    label = "Load more",
    loading,
    loadKey,
    nextHref,
    onLoad,
    threshold = 500,
  }: Props = $props();

  let sentinelEl: HTMLDivElement | undefined = $state();
  let lastFiredKey: typeof loadKey | undefined;
  let scrollTarget: HTMLElement | Window | null = null;
  let raf: number | null = null;

  function findScrollContainer(el: HTMLElement): HTMLElement | Window {
    let parent: HTMLElement | null = el.parentElement;
    while (parent) {
      const overflow = getComputedStyle(parent).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return window;
  }

  function readMetrics() {
    if (scrollTarget === window) {
      const root = document.scrollingElement ?? document.documentElement;
      return {
        clientHeight: window.innerHeight,
        scrollHeight: root.scrollHeight,
        scrollTop: window.scrollY,
      };
    }

    const el = scrollTarget as HTMLElement;
    return {
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
    };
  }

  function check() {
    if (!hasMore || loading || error || !scrollTarget) return;
    if (loadKey !== undefined && loadKey === lastFiredKey) return;

    const metrics = readMetrics();
    const remaining = metrics.scrollHeight - (metrics.scrollTop + metrics.clientHeight);
    if (remaining < threshold) {
      lastFiredKey = loadKey;
      untrack(() => void onLoad());
    }
  }

  function onScroll() {
    if (raf !== null) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      check();
    });
  }

  onMount(() => {
    if (!sentinelEl) return;
    scrollTarget = findScrollContainer(sentinelEl);
    const target: EventTarget = scrollTarget;
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    queueMicrotask(check);

    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  });

  $effect(() => {
    if (loadKey === undefined || loadKey === lastFiredKey || loading || !hasMore || error) return;
    queueMicrotask(check);
  });
</script>

{#if hasMore || error}
  <div bind:this={sentinelEl} class="flex items-center justify-center border-t border-border-subtle pt-4">
    {#if error}
      <button
        type="button"
        class="surface-well px-3 py-1 text-body-sm text-text-muted transition-colors hover:text-text-primary"
        onclick={() => void onLoad()}
      >
        Try again
      </button>
    {:else if loading}
      <div
        class="inline-flex items-center gap-2 text-body-sm text-text-muted"
        aria-live="polite"
      >
        <LoaderCircle class="h-4 w-4 animate-spin text-text-accent" aria-hidden="true" />
        Loading
      </div>
    {:else}
      <a
        href={nextHref}
        class="surface-well px-3 py-1 text-body-sm text-text-muted transition-colors hover:text-text-primary"
        onclick={(event) => {
          event.preventDefault();
          void onLoad();
        }}
      >
        {label}
      </a>
    {/if}
  </div>
{/if}
