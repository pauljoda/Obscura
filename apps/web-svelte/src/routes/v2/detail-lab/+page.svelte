<script lang="ts">
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
  </header>

  <section class="placeholder">
    <p>EntityDetail component will render here.</p>
  </section>
</main>

<style>
  .detail-lab {
    min-height: 100vh;
    background: var(--color-bg);
    color: var(--color-text-primary);
    padding: clamp(1rem, 3vw, 2rem);
  }

  header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  header p {
    margin: 0;
    color: var(--color-text-accent);
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

  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 24rem;
    margin-top: 1.5rem;
    border: 1px dashed var(--color-border-subtle);
    color: var(--color-text-muted);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.82rem;
  }
</style>
