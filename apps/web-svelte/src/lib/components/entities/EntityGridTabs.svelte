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
    position: relative;
    display: flex;
    gap: 0.05rem;
    overflow-x: auto;
    padding: 0;
    scrollbar-width: thin;
  }

  .tabs::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      to right,
      transparent,
      var(--color-border-subtle) 12%,
      var(--color-border-subtle) 88%,
      transparent
    );
    pointer-events: none;
  }

  .tab {
    position: relative;
    display: inline-flex;
    align-items: baseline;
    gap: 0.45rem;
    flex: 0 0 auto;
    background: transparent;
    color: var(--color-text-disabled);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.66rem;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.14em;
    padding: 0.7rem 0.85rem 0.7rem;
    text-transform: uppercase;
    transition:
      color var(--duration-fast) var(--ease-default);
  }

  .tab::before {
    content: "";
    position: absolute;
    left: 0.3rem;
    right: 0.3rem;
    bottom: 0;
    height: 2px;
    background: transparent;
    transition:
      background var(--duration-normal) var(--ease-mechanical),
      box-shadow var(--duration-normal) var(--ease-mechanical);
    z-index: 1;
  }

  .tab:hover {
    color: var(--color-text-secondary);
  }

  .tab:hover::before {
    background: rgb(255 255 255 / 0.16);
  }

  .tab.is-active {
    color: var(--color-text-accent-bright);
  }

  .tab.is-active::before {
    background: linear-gradient(
      to right,
      rgb(196 154 90 / 0.05),
      rgb(221 180 119) 50%,
      rgb(196 154 90 / 0.05)
    );
    box-shadow:
      0 0 8px rgb(196 154 90 / 0.55),
      0 0 16px rgb(196 154 90 / 0.2);
  }

  .tab strong {
    color: var(--color-text-disabled);
    font-weight: 600;
    font-size: 0.62rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }

  .tab.is-active strong {
    color: var(--color-text-accent);
  }
</style>
