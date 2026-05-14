<script lang="ts">
  import EntityDetail from "$lib/components/entities/EntityDetail.svelte";
  import { detailLabRows } from "$lib/entities/detail-lab-data";
  import type { EntityDetailCard } from "$lib/entities/entity-detail";
  import { presentSections } from "$lib/entities/entity-detail";

  const allCards = detailLabRows.flatMap((row) => row.cards);

  let activeIndex = $state(0);
  let ratingBusy = $state(false);

  const card = $derived(allCards[activeIndex]);
  const sections = $derived(card ? presentSections(card) : []);

  function handleRatingChange(value: number | null) {
    ratingBusy = true;
    setTimeout(() => {
      ratingBusy = false;
    }, 400);
  }
</script>

<svelte:head>
  <title>Entity Detail Lab | Obscura v2</title>
</svelte:head>

<main class="detail-lab">
  <header>
    <div>
      <p>v2 entity surface</p>
      <h1>Entity Detail Lab</h1>
    </div>
    <div class="state-switch" aria-label="Entity selector">
      {#each allCards as c, i (c.entity.id)}
        <button
          type="button"
          class:is-active={i === activeIndex}
          onclick={() => (activeIndex = i)}
        >
          {c.kindLabel}
        </button>
      {/each}
    </div>
  </header>

  <section class="status-strip" aria-label="Detail state">
    <span>{card?.entity.kind ?? "—"}</span>
    <span>{sections.length} sections</span>
    <span>{card?.presentCapabilities.length ?? 0} capabilities</span>
  </section>

  {#if card}
    <EntityDetail
      {card}
      onRatingChange={handleRatingChange}
      {ratingBusy}
    />
  {/if}
</main>

<style>
  .detail-lab {
    min-height: 100vh;
    background: var(--color-bg, #07080b);
    color: var(--color-text-primary, #f2eed8);
    padding: clamp(1rem, 3vw, 2rem);
  }

  header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border-subtle, #1c2235);
    flex-wrap: wrap;
  }

  header p {
    margin: 0;
    color: var(--color-text-accent, #c49a5a);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.72rem;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  h1 {
    margin: 0.2rem 0 0;
    font-family: var(--font-heading, Geist, sans-serif);
    font-size: clamp(1.7rem, 3vw, 2.5rem);
    line-height: 1;
    letter-spacing: 0;
  }

  .state-switch {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .state-switch button {
    padding: 0.3rem 0.6rem;
    font-size: 0.72rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-3, #151a28);
    color: var(--color-text-muted, #8a93a6);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
  }

  .state-switch button:hover {
    color: var(--color-text-primary, #f2eed8);
    border-color: rgba(196, 154, 90, 0.35);
  }

  .state-switch button.is-active {
    color: #c49a5a;
    border-color: #c49a5a;
    box-shadow: 0 0 12px rgba(196, 154, 90, 0.2);
  }

  .status-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.2rem;
    margin: 0.75rem 0;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.7rem;
    color: var(--color-text-muted, #8a93a6);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
</style>
