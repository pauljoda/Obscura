<script lang="ts">
  import { LoaderCircle } from "@lucide/svelte";
  import { untrack } from "svelte";
  import { elementInView } from "$lib/hooks/element-in-view.svelte";

  interface Props {
    hasMore: boolean;
    loading: boolean;
    error?: string | null;
    nextHref: string;
    loadKey?: string | number;
    label?: string;
    onLoad: () => void | Promise<void>;
  }

  let {
    hasMore,
    loading,
    error = null,
    nextHref,
    loadKey,
    label = "Load more",
    onLoad,
  }: Props = $props();

  // Bottom-only prefetch margin. Pages dedupe by passing a `loadKey` that
  // strictly increases per appended page; the trigger fires once per
  // distinct key while the sentinel is in view. A duplicate-only response
  // (which `mergeUniquePage` collapses by zeroing `total`) flips `hasMore`
  // off, so the trigger goes quiet without needing edge-detection state.
  const sentinel = elementInView({ rootMargin: "0px 0px 320px 0px" });

  let lastFiredKey: typeof loadKey | undefined;

  $effect(() => {
    if (!sentinel.inView) return;
    if (!hasMore || loading || error) return;
    if (loadKey !== undefined && loadKey === lastFiredKey) return;
    lastFiredKey = loadKey;
    untrack(() => void onLoad());
  });
</script>

{#if hasMore || error}
  <div use:sentinel.attach class="flex items-center justify-center border-t border-border-subtle pt-4">
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
