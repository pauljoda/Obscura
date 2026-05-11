<script lang="ts">
  import { cn } from "@obscura/ui-svelte";
  import FilterSection from "../FilterSection.svelte";
  import type { SectionAddFilter, SectionPanelFilter } from "./types.ts";

  interface Props {
    panelFilters: SectionPanelFilter[];
    onAddFilter: SectionAddFilter;
    /** When false, hide the Interactive toggles (used for non-video surfaces). */
    showInteractive?: boolean;
    /** When true, include comic/non-comic library filters. */
    showComic?: boolean;
    /** When true, include read/unread comic progress filters. */
    showRead?: boolean;
    /** When true, include explicit NSFW / not NSFW filters. */
    showNsfw?: boolean;
  }

  let {
    panelFilters,
    onAddFilter,
    showInteractive = true,
    showComic = false,
    showRead = false,
    showNsfw = false,
  }: Props = $props();

  const choices = $derived([
    { type: "organized", value: "true", label: "Organized", chipLabel: "Organized" },
    { type: "organized", value: "false", label: "Not organized", chipLabel: "Organized" },
    ...(showNsfw
      ? [
          { type: "isNsfw", value: "true", label: "Is NSFW", chipLabel: "NSFW" },
          { type: "isNsfw", value: "false", label: "Not NSFW", chipLabel: "NSFW" },
        ]
      : []),
    ...(showInteractive
      ? [
          { type: "interactive", value: "true", label: "Interactive", chipLabel: "Interactive" },
          { type: "interactive", value: "false", label: "Not interactive", chipLabel: "Interactive" },
        ]
      : []),
    ...(showComic
      ? [
          { type: "comic", value: "true", label: "Comic", chipLabel: "Comic" },
          { type: "comic", value: "false", label: "Not comic", chipLabel: "Comic" },
        ]
      : []),
    ...(showRead
      ? [
          { type: "read", value: "unread", label: "Unread", chipLabel: "Reading" },
          { type: "read", value: "read", label: "Read", chipLabel: "Reading" },
        ]
      : []),
  ]);
</script>

<FilterSection title="Library flags">
  {#snippet children()}
    <div class="flex flex-wrap gap-1">
      {#each choices as item (`${item.type}-${item.value}`)}
        <button
          type="button"
          onclick={() => onAddFilter(item.type, item.chipLabel, item.value)}
          class={cn(
            "tag-chip cursor-pointer transition-colors duration-fast",
            panelFilters.some((f) => f.type === item.type && f.value === item.value)
              ? "tag-chip-accent"
              : "tag-chip-default hover:tag-chip-accent",
          )}
        >
          {item.label}
        </button>
      {/each}
    </div>
  {/snippet}
</FilterSection>
