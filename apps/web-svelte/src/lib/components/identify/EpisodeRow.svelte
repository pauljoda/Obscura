<script lang="ts">
  import { AlertCircle, ChevronDown } from "@lucide/svelte";
  import { Checkbox, cn } from "@obscura/ui-svelte";
  import type { NormalizedEpisodeResult } from "@obscura/contracts";
  import type { AcceptFieldMask } from "$lib/v1/api/scrapers-v1";
  import FieldMaskGrid from "./FieldMaskGrid.svelte";

  type FieldKey = keyof AcceptFieldMask;
  type EpisodeState = {
    accepted: boolean;
    mask: AcceptFieldMask;
    still: string | null | undefined;
  };

  interface Props {
    episode: NormalizedEpisodeResult;
    episodeState: EpisodeState;
    onAccepted: (accepted: boolean) => void;
    onToggleField: (key: FieldKey) => void;
  }

  let { episode, episodeState, onAccepted, onToggleField }: Props = $props();

  const EPISODE_FIELDS: Array<{ key: FieldKey; label: string }> = [
    { key: "title", label: "Title" },
    { key: "overview", label: "Overview" },
    { key: "airDate", label: "Air date" },
    { key: "runtime", label: "Runtime" },
    { key: "cast", label: "Guest stars" },
    { key: "externalIds", label: "External IDs" },
  ];

  let expanded = $state(false);
  const matched = $derived(episode.matched !== false);
</script>

<div
  class={cn(
    "border border-border-subtle/40 bg-surface-2/40",
    !matched && "opacity-70",
  )}
>
  <button
    type="button"
    onclick={() => (expanded = !expanded)}
    class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2/60"
  >
    <Checkbox
      checked={episodeState.accepted}
      onchange={(e) => {
        e.stopPropagation();
        onAccepted((e.currentTarget as HTMLInputElement).checked);
      }}
      onclick={(e) => e.stopPropagation()}
    />
    <span class="w-12 flex-shrink-0 font-mono text-[0.62rem] text-text-muted">
      {episode.seasonNumber}×{String(episode.episodeNumber).padStart(2, "0")}
    </span>
    <span class="flex-1 truncate text-[0.72rem] text-text-primary">
      {#if episode.title}
        {episode.title}
      {:else}
        <em class="text-text-muted">(no title)</em>
      {/if}
    </span>
    {#if !matched}
      <span
        class="flex items-center gap-1 text-[0.55rem] uppercase tracking-wide text-status-warning-text"
      >
        <AlertCircle class="h-3 w-3" /> unmatched
      </span>
    {/if}
    {#if episode.localFilePath}
      <span
        class="hidden max-w-[180px] truncate font-mono text-[0.55rem] text-text-disabled md:inline"
      >
        {episode.localFilePath.split("/").pop()}
      </span>
    {/if}
    <ChevronDown
      class={cn(
        "h-3 w-3 flex-shrink-0 text-text-disabled transition-transform duration-fast",
        expanded && "rotate-180",
      )}
    />
  </button>
  {#if expanded}
    <div class="space-y-2 border-t border-border-subtle/40 p-3">
      {#if episode.overview}
        <p class="text-[0.68rem] text-text-muted line-clamp-3">{episode.overview}</p>
      {/if}
      {#if episode.airDate}
        <p class="text-[0.6rem] text-text-muted">Air date: {episode.airDate}</p>
      {/if}
      <FieldMaskGrid fields={EPISODE_FIELDS} mask={episodeState.mask} onToggle={onToggleField} compact />
    </div>
  {/if}
</div>
