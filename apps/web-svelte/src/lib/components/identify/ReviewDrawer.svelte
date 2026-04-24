<script lang="ts">
  import type { Snippet } from "svelte";
  import { X, ChevronUp, ChevronDown, Loader2, AlertCircle } from "@lucide/svelte";

  interface Props {
    label: string;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    hasNext?: boolean;
    hasPrev?: boolean;
    loading?: boolean;
    error?: string | null;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    label,
    onClose,
    onNext,
    onPrev,
    hasNext,
    hasPrev,
    loading,
    error,
    children,
    footer,
  }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-[90] flex justify-end bg-bg/70 backdrop-blur-sm"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <div class="glass-1 flex h-full w-full max-w-3xl flex-col border-l border-border-subtle shadow-2xl">
    <div class="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
      <div class="min-w-0 flex-1">
        <div class="text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
          Review scrape
        </div>
        <h2 class="truncate text-base font-semibold text-text-primary">{label}</h2>
      </div>
      <div class="flex items-center gap-2">
        {#if onPrev || onNext}
          <div class="flex items-center gap-1 border-r border-border-subtle pr-3 mr-1">
            <button
              type="button"
              onclick={onPrev}
              disabled={!hasPrev}
              class="p-1.5 text-text-muted hover:bg-surface-2/40 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous"
            >
              <ChevronUp class="h-4 w-4" />
            </button>
            <button
              type="button"
              onclick={onNext}
              disabled={!hasNext}
              class="p-1.5 text-text-muted hover:bg-surface-2/40 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next"
            >
              <ChevronDown class="h-4 w-4" />
            </button>
          </div>
        {/if}
        <button
          type="button"
          onclick={onClose}
          class="p-1 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="flex h-32 items-center justify-center text-text-muted">
          <Loader2 class="mr-2 h-4 w-4 animate-spin" /> Loading scrape result…
        </div>
      {/if}
      {#if !loading && error}
        <div class="m-5 flex items-center gap-2 border border-status-error/30 bg-status-error/10 px-3 py-2 text-[0.72rem] text-status-error-text">
          <AlertCircle class="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      {/if}
      {#if !loading && !error}
        {@render children()}
      {/if}
    </div>

    {#if footer}
      <div class="border-t border-border-subtle bg-bg px-5 py-3">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>
