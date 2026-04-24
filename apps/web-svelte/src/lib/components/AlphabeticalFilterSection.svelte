<script module lang="ts">
  export interface AlphabeticalFilterSectionItem {
    id: string;
    name: string;
    count: number;
  }
</script>

<script lang="ts">
  import type { Component } from "svelte";
  import { Search as SearchIcon, X } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";

  interface Props {
    title: string;
    icon?: Component<Record<string, unknown>>;
    items: AlphabeticalFilterSectionItem[];
    searchPlaceholder: string;
    emptyIcon?: Component<Record<string, unknown>>;
    emptyLabel?: string;
    chipVariant?: "info" | "accent";
    groupingThreshold?: number;
    searchThreshold?: number;
    isActive: (item: AlphabeticalFilterSectionItem) => boolean;
    onToggle: (item: AlphabeticalFilterSectionItem) => void;
  }

  let {
    title,
    icon: Icon,
    items,
    searchPlaceholder,
    emptyIcon: EmptyIcon,
    emptyLabel,
    chipVariant = "info",
    groupingThreshold = 24,
    searchThreshold = 12,
    isActive,
    onToggle,
  }: Props = $props();

  let search = $state("");

  const filtered = $derived.by(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  });

  const grouped = $derived.by(() => {
    if (filtered.length <= groupingThreshold) return null;
    const groups: Record<string, AlphabeticalFilterSectionItem[]> = {};
    for (const item of filtered) {
      const letter = item.name[0]?.toUpperCase() || "#";
      (groups[letter] ??= []).push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  });

  const showSearch = $derived(items.length > searchThreshold);
  const activeClass = $derived(chipVariant === "accent" ? "tag-chip-accent" : "tag-chip-info");
  const hoverClass = $derived(
    chipVariant === "accent"
      ? "tag-chip-default hover:tag-chip-accent"
      : "tag-chip-default hover:tag-chip-info",
  );
</script>

<div>
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-1.5 text-kicker">
      {#if Icon}
        <Icon class="h-3 w-3 text-text-disabled" />
      {/if}
      {title}
    </div>
    <span class="text-[0.6rem] font-mono text-text-disabled tabular-nums">
      {filtered.length !== items.length ? `${filtered.length} / ${items.length}` : items.length}
    </span>
  </div>

  {#if showSearch}
    <div class="relative mb-2">
      <SearchIcon
        class="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-disabled pointer-events-none"
      />
      <input
        type="text"
        placeholder={searchPlaceholder}
        bind:value={search}
        class={cn(
          "w-full bg-surface-1 border border-border-subtle",
          "pl-6 pr-2 py-1 text-[0.7rem] text-text-primary",
          "placeholder:text-text-disabled",
          "focus:outline-none focus:border-border-accent",
          "transition-colors duration-fast",
        )}
      />
      {#if search}
        <button
          type="button"
          onclick={() => (search = "")}
          class="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
          aria-label="Clear search"
        >
          <X class="h-3 w-3" />
        </button>
      {/if}
    </div>
  {/if}

  <div class="max-h-48 overflow-y-auto tag-scroll-area">
    {#if filtered.length === 0}
      <div class="flex items-center justify-center py-4 text-[0.68rem] text-text-disabled">
        {#if EmptyIcon}<EmptyIcon class="h-3 w-3 mr-1.5 opacity-50" />{/if}
        {search ? `No matching ${emptyLabel ?? "items"}` : `No ${emptyLabel ?? "items"} available`}
      </div>
    {:else if grouped}
      <div class="space-y-2">
        {#each grouped as [letter, letterItems] (letter)}
          <div>
            <div
              class="sticky top-0 z-10 text-[0.55rem] font-mono font-semibold text-text-disabled uppercase tracking-widest px-0.5 py-0.5 bg-surface-2/90 backdrop-blur-sm border-b border-border-subtle mb-1"
            >
              {letter}
            </div>
            <div class="flex flex-wrap gap-1">
              {#each letterItems as item (item.id)}
                <button
                  type="button"
                  onclick={() => onToggle(item)}
                  class={cn(
                    "tag-chip cursor-pointer transition-colors duration-fast",
                    isActive(item) ? activeClass : hoverClass,
                  )}
                >
                  {item.name}
                  <span class="text-text-disabled ml-1">{item.count}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="flex flex-wrap gap-1">
        {#each filtered as item (item.id)}
          <button
            type="button"
            onclick={() => onToggle(item)}
            class={cn(
              "tag-chip cursor-pointer transition-colors duration-fast",
              isActive(item) ? activeClass : hoverClass,
            )}
          >
            {item.name}
            <span class="text-text-disabled ml-1">{item.count}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
