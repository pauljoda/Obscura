<script lang="ts">
  import { ArrowUpDown, ChevronDown, Check } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { SortDir, SortOption } from "$lib/media-surface/config";

  interface Props {
    sortBy: string;
    sortDir: SortDir;
    sortOptions: SortOption[];
    /** Per-key default direction applied when switching to that key. */
    defaultSortDir?: Record<string, SortDir>;
    onSortChange: (sort: string, dir?: SortDir) => void;
  }

  let {
    sortBy,
    sortDir,
    sortOptions,
    defaultSortDir = {},
    onSortChange,
  }: Props = $props();

  let open = $state(false);
  const currentSort = $derived(sortOptions.find((s) => s.value === sortBy));
</script>

<div class="flex items-center">
  <div class="relative">
    <button
      type="button"
      onclick={() => (open = !open)}
      class={cn(
        "flex items-center gap-1.5 px-2 py-1.5",
        "text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2",
        "transition-colors duration-fast",
      )}
    >
      <ArrowUpDown class="h-3.5 w-3.5" />
      <span class="hidden sm:inline">{currentSort?.label}</span>
      <ChevronDown class="h-3 w-3 text-text-disabled" />
    </button>

    {#if open}
      <button
        type="button"
        class="fixed inset-0 z-40"
        aria-label="Close sort menu"
        onclick={() => (open = false)}
      ></button>
      <div class="absolute right-0 top-full mt-1 z-50 w-44 surface-elevated py-1">
        {#each sortOptions as opt (opt.value)}
          <button
            type="button"
            onclick={() => {
              onSortChange(opt.value, defaultSortDir[opt.value]);
              open = false;
            }}
            class={cn(
              "flex items-center gap-2 w-full px-3 py-1.5 text-[0.72rem] text-left transition-colors duration-fast",
              sortBy === opt.value
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-3",
            )}
          >
            <Check class={cn("h-3 w-3", sortBy === opt.value ? "opacity-100" : "opacity-0")} />
            {opt.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <button
    type="button"
    onclick={() => onSortChange(sortBy, sortDir === "asc" ? "desc" : "asc")}
    title={sortDir === "asc"
      ? "Ascending — click to reverse"
      : "Descending — click to reverse"}
    class={cn(
      "flex h-7 w-7 items-center justify-center",
      "text-text-muted hover:text-text-primary hover:bg-surface-2",
      "transition-colors duration-fast",
    )}
    aria-label={`Sort direction ${sortDir}`}
  >
    <ChevronDown class={cn("h-3.5 w-3.5", sortDir === "asc" && "rotate-180")} />
  </button>
</div>
