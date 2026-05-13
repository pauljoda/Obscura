<script lang="ts">
  import { Check, Plus, Trash2, X } from "@lucide/svelte";
  import type {
    PhashContributionItem,
  } from "$lib/v1/api/phash-contributions-v1";
  import type { StashBoxEndpoint } from "$lib/v1/api/types-v1";

  interface Props {
    item: PhashContributionItem;
    availableEndpoints: StashBoxEndpoint[];
    onRemove: (linkId: string) => void;
    onAdd: (endpointId: string, stashId: string) => void;
  }

  let { item, availableEndpoints, onRemove, onAdd }: Props = $props();

  let showAdd = $state(false);
  let newEndpointId = $state("");
  let newStashId = $state("");

  function truncateHash(hash: string | null, length = 10): string {
    if (!hash) return "—";
    return hash.length > length ? `${hash.slice(0, length)}…` : hash;
  }

  function openAdd() {
    showAdd = true;
    if (availableEndpoints.length > 0) newEndpointId = availableEndpoints[0].id;
  }

  function commit() {
    onAdd(newEndpointId, newStashId);
    newStashId = "";
    showAdd = false;
  }
</script>

<div class="flex flex-wrap items-center gap-1.5">
  {#each item.stashIds as link (link.id)}
    <div class="flex items-center gap-1.5 px-2 py-1 bg-surface-3/60 border border-border-subtle text-xs">
      <span class="text-text-muted">{link.endpointName}</span>
      <span class="text-text-disabled">·</span>
      <span class="text-mono-sm text-text-primary">{truncateHash(link.stashId, 10)}</span>
      <button
        type="button"
        onclick={() => onRemove(link.id)}
        class="text-text-disabled hover:text-status-error-text transition-colors"
        title="Remove link"
        aria-label="Remove link"
      >
        <Trash2 class="h-3 w-3" />
      </button>
    </div>
  {/each}

  {#if availableEndpoints.length > 0 && !showAdd}
    <button
      type="button"
      onclick={openAdd}
      class="flex items-center gap-1 px-2 py-1 text-xs text-text-muted border border-dashed border-border-subtle hover:text-text-accent hover:border-border-accent transition-colors"
    >
      <Plus class="h-3 w-3" />
      Add link
    </button>
  {/if}

  {#if showAdd}
    <div class="flex items-center gap-1.5 px-2 py-1 bg-surface-3/60 border border-border text-xs">
      <select
        bind:value={newEndpointId}
        class="control-input py-0.5 text-xs"
      >
        {#each availableEndpoints as ep (ep.id)}
          <option value={ep.id}>{ep.name}</option>
        {/each}
      </select>
      <input
        bind:value={newStashId}
        placeholder="remote video UUID"
        class="control-input py-0.5 text-xs w-56"
      />
      <button
        type="button"
        onclick={commit}
        disabled={!newStashId.trim() || !newEndpointId}
        class="text-text-accent hover:text-accent-100 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Save link"
      >
        <Check class="h-3 w-3" />
      </button>
      <button
        type="button"
        onclick={() => {
          showAdd = false;
          newStashId = "";
        }}
        class="text-text-muted hover:text-text-primary"
        aria-label="Cancel"
      >
        <X class="h-3 w-3" />
      </button>
    </div>
  {/if}
</div>
