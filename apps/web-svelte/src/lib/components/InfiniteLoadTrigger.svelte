<script lang="ts">
  import { LoaderCircle } from "@lucide/svelte";
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

  const sentinel = elementInView({ rootMargin: "1800px 0px" });
  const currentLoadKey = $derived(loadKey ?? nextHref);
  let lastTriggeredKey: string | number | undefined;

  $effect(() => {
    if (!sentinel.inView || !hasMore || loading || error) return;
    if (lastTriggeredKey === currentLoadKey) return;
    lastTriggeredKey = currentLoadKey;
    void onLoad();
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
