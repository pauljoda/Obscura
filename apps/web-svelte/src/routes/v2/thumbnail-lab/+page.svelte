<script lang="ts">
  import V2EntityThumbnail from "$lib/components/thumbnails/V2EntityThumbnail.svelte";
  import { thumbnailLabRows } from "$lib/entities/thumbnail-lab-data";

  let thumbnailScale = $state(14);
</script>

<svelte:head>
  <title>Thumbnail Lab | Obscura v2</title>
</svelte:head>

<main class="thumbnail-lab">
  <header>
    <div>
      <p>v2 entity surface</p>
      <h1>Thumbnail Lab</h1>
    </div>
    <div class="controls">
      <label for="thumbnail-scale">
        <span>Scale</span>
        <strong>{thumbnailScale}rem</strong>
      </label>
      <input id="thumbnail-scale" type="range" min="9" max="21" step="1" bind:value={thumbnailScale} />
      <span>{thumbnailLabRows.length} entity kinds</span>
    </div>
  </header>

  <div class="rows" style={`--thumb-size: ${thumbnailScale}rem;`}>
    {#each thumbnailLabRows as row (row.kind)}
      <section class="kind-row" aria-labelledby={`${row.kind}-heading`}>
        <div class="row-heading">
          <div>
            <p>{row.kind}</p>
            <h2 id={`${row.kind}-heading`}>{row.label}</h2>
          </div>
          <span>{row.cards.length} sample{row.cards.length === 1 ? "" : "s"}</span>
        </div>

        <div class="strip">
          {#each row.cards as card (card.entity.id)}
            <V2EntityThumbnail {card} />
          {/each}
        </div>
      </section>
    {/each}
  </div>
</main>

<style>
  .thumbnail-lab {
    min-height: 100vh;
    background:
      linear-gradient(180deg, rgb(10 10 11 / 0.96), rgb(19 18 16 / 0.98)),
      #080808;
    color: #f4efe6;
    padding: clamp(1rem, 3vw, 2rem);
  }

  header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid rgb(255 255 255 / 0.1);
    padding-bottom: 1rem;
  }

  header p,
  .row-heading p {
    margin: 0;
    color: rgb(196 154 90 / 0.9);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.72rem;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  h1,
  h2 {
    margin: 0;
    font-family: var(--font-heading, Geist, sans-serif);
    letter-spacing: 0;
  }

  h1 {
    margin-top: 0.2rem;
    font-size: clamp(2rem, 5vw, 4.25rem);
    line-height: 0.96;
  }

  .controls > span,
  .row-heading > span {
    border: 1px solid rgb(255 255 255 / 0.12);
    background: rgb(255 255 255 / 0.045);
    color: rgb(244 239 230 / 0.7);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.72rem;
    padding: 0.45rem 0.58rem;
    white-space: nowrap;
  }

  .controls {
    display: grid;
    grid-template-columns: auto minmax(9rem, 14rem) auto;
    gap: 0.7rem;
    align-items: center;
  }

  .controls label {
    display: grid;
    gap: 0.15rem;
    color: rgb(244 239 230 / 0.6);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    line-height: 1;
    text-transform: uppercase;
  }

  .controls strong {
    color: rgb(244 239 230 / 0.82);
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: none;
  }

  .controls input {
    accent-color: #c49a5a;
    inline-size: 100%;
  }

  .rows {
    display: grid;
    gap: 1.25rem;
    padding-top: 1.25rem;
  }

  .kind-row {
    display: grid;
    gap: 0.8rem;
  }

  .row-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
  }

  h2 {
    margin-top: 0.15rem;
    font-size: clamp(1.05rem, 2vw, 1.35rem);
    line-height: 1.05;
  }

  .strip {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--thumb-size)), var(--thumb-size)));
    gap: 0.9rem;
    align-items: stretch;
    border-top: 1px solid rgb(255 255 255 / 0.08);
    padding-top: 0.9rem;
  }

  @media (max-width: 640px) {
    .thumbnail-lab {
      padding: 0.9rem;
    }

    header,
    .row-heading {
      align-items: start;
      flex-direction: column;
    }

    .controls {
      grid-template-columns: 1fr;
      inline-size: 100%;
    }

    .strip {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--thumb-size)), 1fr));
    }
  }
</style>
