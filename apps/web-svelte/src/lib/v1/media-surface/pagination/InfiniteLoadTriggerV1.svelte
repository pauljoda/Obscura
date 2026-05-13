<script lang="ts">
  import { LoaderCircle } from "@lucide/svelte";
  import { onMount, untrack } from "svelte";

  interface Props {
    hasMore: boolean;
    loading: boolean;
    error?: string | null;
    nextHref: string;
    loadKey?: string | number;
    label?: string;
    /** Distance from the bottom (in pixels) at which to fire onLoad. */
    threshold?: number;
    onLoad: () => void | Promise<void>;
  }

  let {
    hasMore,
    loading,
    error = null,
    nextHref,
    loadKey,
    label = "Load more",
    threshold = 500,
    onLoad,
  }: Props = $props();

  // Scroll-event-based trigger (Rich Harris's sveltesnaps Scroller pattern):
  //
  //   const remaining = scrollHeight - (scrollTop + clientHeight);
  //   if (remaining < threshold) fire('more');
  //
  // Why this avoids cascade where IntersectionObserver did not:
  //
  //   - Scroll events only fire when the user actively scrolls. Mounting
  //     items into the DOM does NOT dispatch a scroll event, so no
  //     auto-refire after a successful append.
  //   - After a load completes, `scrollHeight` grew by the appended
  //     content's pixel height while `scrollTop` is unchanged. The new
  //     `remaining` is therefore larger by exactly that delta, so the
  //     next user scroll only fires again once they scroll past the
  //     new content.
  //   - `loadKey` cursor dedupe protects against multiple scroll events
  //     within the same prefetch zone firing more than one request for
  //     the same offset.
  //   - An initial check on mount handles the case where the first SSR
  //     page is shorter than the viewport+threshold (auto-fills the
  //     visible area before requiring user input).
  //
  // The trigger walks up from itself to find the nearest ancestor with
  // `overflow-y: auto|scroll`; if none, it falls back to the window. In
  // this app the relevant container is `<main>`, which has its own
  // scrollbar.

  let sentinelEl: HTMLDivElement | undefined = $state();
  let lastFiredKey: typeof loadKey | undefined;
  let scrollTarget: HTMLElement | Window | null = null;
  let raf: number | null = null;

  function findScrollContainer(el: HTMLElement): HTMLElement | Window {
    let p: HTMLElement | null = el.parentElement;
    while (p) {
      const cs = getComputedStyle(p);
      const overflow = cs.overflowY;
      if ((overflow === "auto" || overflow === "scroll") && p.scrollHeight > p.clientHeight) {
        return p;
      }
      p = p.parentElement;
    }
    return window;
  }

  function readMetrics() {
    if (scrollTarget === window) {
      const root = document.scrollingElement ?? document.documentElement;
      return {
        scrollTop: window.scrollY,
        scrollHeight: root.scrollHeight,
        clientHeight: window.innerHeight,
      };
    }
    const el = scrollTarget as HTMLElement;
    return {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    };
  }

  function check() {
    if (!hasMore || loading || error) return;
    if (loadKey !== undefined && loadKey === lastFiredKey) return;
    if (!scrollTarget) return;
    const m = readMetrics();
    const remaining = m.scrollHeight - (m.scrollTop + m.clientHeight);
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
    // Initial check: if the SSR page already fits well within the
    // viewport+threshold (small library or short results), kick off
    // a follow-up load to fill the screen.
    queueMicrotask(check);
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  });

  // Re-check whenever loadKey advances (a successful append) — a single
  // user-initiated scroll might span enough to span past two thresholds,
  // and we want the next page primed without requiring another scroll
  // event. The cursor dedupe keeps this from looping.
  $effect(() => {
    if (loadKey === undefined) return;
    if (loadKey === lastFiredKey) return;
    if (loading || !hasMore || error) return;
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
