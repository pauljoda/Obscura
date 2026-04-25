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

  // Margin is intentionally smaller than before — a huge eager margin made
  // the sentinel stay "in view" through every append, which combined with
  // level-triggered firing produced a load-cascade. We now require the
  // sentinel to exit and re-enter the viewport to fire again.
  const sentinel = elementInView({ rootMargin: "600px 0px" });

  let armed = true;

  $effect(() => {
    const inView = sentinel.inView;
    if (!inView) {
      // Sentinel has scrolled out of view → re-arm for the next entry.
      armed = true;
      return;
    }
    if (!armed) return;
    if (!hasMore || loading || error) return;
    armed = false;
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
      <div class="inline-flex items-center gap-2 text-body-sm text-text-muted">
        <LoaderCircle class="h-4 w-4 animate-spin text-text-accent" />
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
