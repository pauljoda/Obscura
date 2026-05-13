<script lang="ts">
  import {
    Calendar,
    Flag,
    Hash,
    Image as ImageIcon,
    Search,
    SlidersHorizontal,
    Star,
    Tag,
    X,
  } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { Component } from "svelte";
  import type { EntityGridFilterOption } from "$lib/entities/entity-grid";

  interface FilterSection {
    className?: string;
    icon: Component<Record<string, unknown>>;
    options: EntityGridFilterOption[];
    title: string;
    variant?: "accent" | "info";
  }

  interface Props {
    activeFilterIds: string[];
    filterOptions: EntityGridFilterOption[];
    onActiveFilterIdsChange: (ids: string[]) => void;
  }

  let { activeFilterIds, filterOptions, onActiveFilterIdsChange }: Props = $props();
  let tagSearch = $state("");

  const activeSet = $derived(new Set(activeFilterIds));

  function optionsFor(kind: string): EntityGridFilterOption[] {
    return filterOptions.filter((option) => option.capabilityKind === kind);
  }

  const sections = $derived.by<FilterSection[]>(() => {
    const technical = optionsFor("technical");
    const structural = [...optionsFor("stats"), ...optionsFor("position")];
    const dates = [...optionsFor("dates"), ...optionsFor("classification")];
    return [
      { title: "Library Flags", icon: Flag, options: optionsFor("flags") },
      { title: "Rating", icon: Star, options: optionsFor("rating") },
      { title: "Artwork", icon: ImageIcon, options: optionsFor("images"), variant: "info" as const },
      { title: "Technical", icon: SlidersHorizontal, options: technical },
      { title: "Stats & Position", icon: Hash, options: structural },
      { title: "Dates & Class", icon: Calendar, options: dates },
    ].filter((section) => section.options.length > 0);
  });

  const tagOptions = $derived(optionsFor("tags"));
  const filteredTagOptions = $derived.by(() => {
    const query = tagSearch.trim().toLowerCase();
    if (!query) return tagOptions;
    return tagOptions.filter((option) => option.label.toLowerCase().includes(query));
  });
  const groupedTags = $derived.by(() => {
    if (filteredTagOptions.length <= 24) return null;
    const groups: Record<string, EntityGridFilterOption[]> = {};
    for (const option of filteredTagOptions) {
      const label = option.label.replace(/^Tag:\s*/i, "");
      const letter = label[0]?.toUpperCase() ?? "#";
      (groups[letter] ??= []).push(option);
    }
    return Object.entries(groups).sort(([left], [right]) => left.localeCompare(right));
  });

  function isActive(id: string): boolean {
    return activeSet.has(id);
  }

  function toggleFilter(id: string) {
    onActiveFilterIdsChange(
      isActive(id)
        ? activeFilterIds.filter((filterId) => filterId !== id)
        : [...activeFilterIds, id],
    );
  }

  function chipClass(option: EntityGridFilterOption, variant: "accent" | "info" = "accent"): string {
    const activeClass = variant === "info" ? "tag-chip-info" : "tag-chip-accent";
    const hoverClass =
      variant === "info"
        ? "tag-chip-default hover:tag-chip-info"
        : "tag-chip-default hover:tag-chip-accent";
    return cn("tag-chip cursor-pointer transition-colors duration-fast", isActive(option.id) ? activeClass : hoverClass);
  }

  function cleanLabel(option: EntityGridFilterOption): string {
    return option.label.replace(/^Has\s+/i, "").replace(/^Tag:\s*/i, "");
  }
</script>

<div class="surface-well mt-px p-3">
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {#each sections as section (section.title)}
      <div class={section.className}>
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-kicker">
            <section.icon class="h-3 w-3 text-text-disabled" />
            {section.title}
          </div>
          <span class="font-mono text-[0.6rem] tabular-nums text-text-disabled">
            {section.options.length}
          </span>
        </div>
        <div class="flex flex-wrap gap-1">
          {#each section.options as option (option.id)}
            <button
              type="button"
              class={chipClass(option, section.variant)}
              aria-pressed={isActive(option.id)}
              onclick={() => toggleFilter(option.id)}
            >
              {cleanLabel(option)}
              <span class="ml-1 text-text-disabled">{option.count}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}

    {#if tagOptions.length > 0}
      <div class="md:col-span-2 xl:col-span-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-kicker">
            <Tag class="h-3 w-3 text-text-disabled" />
            Tags
          </div>
          <span class="font-mono text-[0.6rem] tabular-nums text-text-disabled">
            {filteredTagOptions.length !== tagOptions.length
              ? `${filteredTagOptions.length} / ${tagOptions.length}`
              : tagOptions.length}
          </span>
        </div>

        {#if tagOptions.length > 12}
          <div class="relative mb-2">
            <Search
              class="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-disabled"
            />
            <input
              type="text"
              placeholder="Filter tags..."
              bind:value={tagSearch}
              class={cn(
                "w-full border border-border-subtle bg-surface-1 py-1 pl-6 pr-7 text-[0.7rem] text-text-primary",
                "placeholder:text-text-disabled focus:border-border-accent focus:outline-none",
                "transition-colors duration-fast",
              )}
            />
            {#if tagSearch}
              <button
                type="button"
                class="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
                aria-label="Clear tag search"
                onclick={() => (tagSearch = "")}
              >
                <X class="h-3 w-3" />
              </button>
            {/if}
          </div>
        {/if}

        <div class="tag-scroll-area max-h-48 overflow-y-auto">
          {#if filteredTagOptions.length === 0}
            <div class="flex items-center justify-center py-4 text-[0.68rem] text-text-disabled">
              <Tag class="mr-1.5 h-3 w-3 opacity-50" />
              No matching tags
            </div>
          {:else if groupedTags}
            <div class="space-y-2">
              {#each groupedTags as [letter, letterOptions] (letter)}
                <div>
                  <div
                    class="sticky top-0 z-10 mb-1 border-b border-border-subtle bg-surface-2/90 px-0.5 py-0.5 font-mono text-[0.55rem] font-semibold uppercase tracking-widest text-text-disabled backdrop-blur-sm"
                  >
                    {letter}
                  </div>
                  <div class="flex flex-wrap gap-1">
                    {#each letterOptions as option (option.id)}
                      <button
                        type="button"
                        class={chipClass(option, "info")}
                        aria-pressed={isActive(option.id)}
                        onclick={() => toggleFilter(option.id)}
                      >
                        {cleanLabel(option)}
                        <span class="ml-1 text-text-disabled">{option.count}</span>
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="flex flex-wrap gap-1">
              {#each filteredTagOptions as option (option.id)}
                <button
                  type="button"
                  class={chipClass(option, "info")}
                  aria-pressed={isActive(option.id)}
                  onclick={() => toggleFilter(option.id)}
                >
                  {cleanLabel(option)}
                  <span class="ml-1 text-text-disabled">{option.count}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
