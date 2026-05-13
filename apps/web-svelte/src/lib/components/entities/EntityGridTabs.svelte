<script lang="ts">
  import { cn } from "@obscura/ui-svelte";
  import { ENTITY_GRID_ALL_KINDS, type EntityGridKindTab } from "$lib/entities/entity-grid";

  interface Props {
    activeKind: string;
    onActiveKindChange: (kind: string) => void;
    tabs: EntityGridKindTab[];
    totalCount: number;
  }

  let { activeKind, onActiveKindChange, tabs, totalCount }: Props = $props();
</script>

{#if tabs.length > 1}
  <nav class="tabs" aria-label="Entity kinds">
    <button
      type="button"
      class={cn("tab", activeKind === ENTITY_GRID_ALL_KINDS && "is-active")}
      aria-pressed={activeKind === ENTITY_GRID_ALL_KINDS}
      onclick={() => onActiveKindChange(ENTITY_GRID_ALL_KINDS)}
    >
      <span>All</span>
      <strong>{totalCount}</strong>
    </button>
    {#each tabs as tab (tab.kind)}
      <button
        type="button"
        class={cn("tab", activeKind === tab.kind && "is-active")}
        aria-pressed={activeKind === tab.kind}
        onclick={() => onActiveKindChange(tab.kind)}
      >
        <span>{tab.label}</span>
        <strong>{tab.count}</strong>
      </button>
    {/each}
  </nav>
{/if}

<style>
  .tabs {
    display: flex;
    gap: 0.25rem;
    overflow-x: auto;
    border-bottom: 1px solid var(--color-border-subtle);
    padding: 0 0 0.35rem;
    scrollbar-width: thin;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex: 0 0 auto;
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-muted);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    line-height: 1;
    padding: 0.48rem 0.58rem;
    text-transform: uppercase;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .tab:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .tab.is-active {
    border-color: var(--color-border-accent);
    background: var(--color-accent-950);
    color: var(--color-text-accent);
  }

  .tab strong {
    color: var(--color-text-disabled);
    font-weight: 700;
  }

  .tab.is-active strong {
    color: var(--color-text-accent);
  }
</style>
