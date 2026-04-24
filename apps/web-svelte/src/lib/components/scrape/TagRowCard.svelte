<script lang="ts">
  import { Check, X, Loader2, ChevronDown, Tag } from "@lucide/svelte";
  import { Badge, cn } from "@obscura/ui-svelte";
  import type { TagRow } from "$lib/identify/scrape-types";
  import StatusDot from "./StatusDot.svelte";
  import ToggleableField from "./ToggleableField.svelte";

  interface Props {
    row: TagRow;
    expanded: boolean;
    onToggleExpand: () => void;
    onAccept: () => void;
    onReject: () => void;
    onToggleField: (field: string) => void;
  }

  let { row, expanded, onToggleExpand, onAccept, onReject, onToggleField }: Props = $props();
</script>

<div>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    onclick={onToggleExpand}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") onToggleExpand();
    }}
    class={cn(
      "surface-card no-lift flex items-center gap-3 px-3 py-2.5 transition-all duration-fast cursor-pointer",
      expanded && "border-border-accent/40",
      row.status === "accepted" && "opacity-50",
      row.status === "rejected" && "opacity-30",
    )}
  >
    <StatusDot status={row.status} />
    <Tag class="h-4 w-4 text-text-disabled flex-shrink-0" />
    <div class="flex-1 min-w-0">
      <div class="text-[0.8rem] font-medium text-text-primary truncate">{row.tag.name}</div>
      {#if row.result && row.status === "found" && row.result.description}
        <div class="text-[0.62rem] text-text-muted truncate mt-0.5">
          {row.result.description.slice(0, 80)}
        </div>
      {/if}
      {#if row.matchedScraper && row.status !== "pending"}
        <span class="text-text-disabled text-[0.58rem] font-mono">via {row.matchedScraper}</span>
      {/if}
    </div>

    <div class="flex items-center gap-1.5 flex-shrink-0">
      {#if row.status === "scraping"}
        <Loader2 class="h-3.5 w-3.5 text-text-accent animate-spin" />
      {/if}
      {#if row.status === "found"}
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation();
            onAccept();
          }}
          class="flex items-center gap-1 px-2 py-1 text-[0.62rem] text-status-success-text border border-status-success/25 hover:bg-status-success/10 transition-colors"
        >
          <Check class="h-2.5 w-2.5" /> Accept
        </button>
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation();
            onReject();
          }}
          aria-label="Reject"
          class="p-1 text-text-disabled hover:text-status-error-text transition-colors"
        >
          <X class="h-3 w-3" />
        </button>
      {/if}
      {#if row.status === "no-result"}<span class="text-[0.62rem] text-text-disabled">No result</span>{/if}
      {#if row.status === "error"}<span class="text-[0.62rem] text-status-error-text">Error</span>{/if}
      {#if row.status === "accepted"}
        <Badge variant="accent" class="text-[0.55rem]">
          {#snippet children()}Applied{/snippet}
        </Badge>
      {/if}
    </div>

    <ChevronDown
      class={cn(
        "h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast",
        expanded && "rotate-180",
      )}
    />
  </div>

  {#if expanded && row.result}
    {@const r = row.result}
    <div class="surface-card no-lift ml-6 mr-1 mb-1 p-3 border-border-accent/20">
      <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-[0.8rem]">
        {#if r.name}
          <ToggleableField field="name" label="Name" value={r.name} enabled={row.selectedFields.has("name")} onToggle={() => onToggleField("name")} />
        {/if}
        {#if r.description}
          <ToggleableField
            field="description"
            label="Description"
            value={r.description.slice(0, 200)}
            enabled={row.selectedFields.has("description")}
            onToggle={() => onToggleField("description")}
          />
        {/if}
        {#if r.aliases}
          <ToggleableField
            field="aliases"
            label="Aliases"
            value={r.aliases}
            enabled={row.selectedFields.has("aliases")}
            onToggle={() => onToggleField("aliases")}
          />
        {/if}
      </div>
    </div>
  {/if}

  {#if expanded && row.error}
    <div class="surface-card no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
      <p class="text-[0.7rem] text-status-error-text">{row.error}</p>
    </div>
  {/if}
</div>
