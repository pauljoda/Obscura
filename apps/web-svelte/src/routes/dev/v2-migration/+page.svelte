<script lang="ts">
  import { AlertTriangle, DatabaseBackup, RotateCcw, ShieldAlert, Trash2 } from "@lucide/svelte";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const selectedBackup = $derived(data.backups[0]?.name ?? "");

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kib = bytes / 1024;
    if (kib < 1024) return `${kib.toFixed(1)} KiB`;
    const mib = kib / 1024;
    if (mib < 1024) return `${mib.toFixed(1)} MiB`;
    return `${(mib / 1024).toFixed(2)} GiB`;
  }

  function formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }
</script>

<svelte:head>
  <title>Migration Dev | Obscura</title>
</svelte:head>

<main class="dev-page">
  <header class="page-header">
    <div>
      <p>Developer tools</p>
      <h1>v2 Migration Control</h1>
    </div>
    <div class="gate-state">
      <span class={data.gate?.awaitingBreakingConsent ? "led led-warn" : "led led-idle"}></span>
      <span>{data.gate?.awaitingBreakingConsent ? "Gate waiting" : "Gate clear"}</span>
    </div>
  </header>

  {#if form?.message}
    <section class={["notice", !form.ok && "notice-error"]} aria-live="polite">
      <strong>{form.ok ? "Done" : "Action failed"}</strong>
      <span>{form.message}</span>
      {#if form.details}
        <pre>{form.details}</pre>
      {/if}
    </section>
  {/if}

  <section class="tool-grid">
    <form method="POST" action="?/promptGate" class="tool-panel">
      <div class="tool-heading">
        <ShieldAlert class="h-5 w-5" />
        <div>
          <h2>Prompt Upgrade Gate</h2>
          <p>Remove the local consent marker, then open the app so the first-boot gate can block entry.</p>
        </div>
      </div>

      <dl>
        <div>
          <dt>Status</dt>
          <dd>{data.gate ? (data.gate.accepted ? "Accepted" : "Awaiting consent") : "Unavailable"}</dd>
        </div>
        <div>
          <dt>Gate</dt>
          <dd>{data.gateMarkerPath}</dd>
        </div>
      </dl>

      <button type="submit" class="danger-action">
        <AlertTriangle class="h-4 w-4" />
        Prompt Upgrade Gate
      </button>
    </form>

    <form method="POST" action="?/createBackup" class="tool-panel">
      <div class="tool-heading">
        <DatabaseBackup class="h-5 w-5" />
        <div>
          <h2>Create Backup</h2>
          <p>Capture the current local database before another migration pass.</p>
        </div>
      </div>

      <dl>
        <div>
          <dt>Target</dt>
          <dd>{data.backupDir}</dd>
        </div>
      </dl>

      <button type="submit">
        <DatabaseBackup class="h-4 w-4" />
        Create Backup
      </button>
    </form>

    <form method="POST" action="?/restoreAndClear" class="tool-panel wide-panel">
      <div class="tool-heading">
        <RotateCcw class="h-5 w-5" />
        <div>
          <h2>Restore Backup and Clear v2</h2>
          <p>Restore one local dump, wipe v2 migration data, and re-preserve legacy roots/settings.</p>
        </div>
      </div>

      <label>
        <span>Backup</span>
        <select name="backup" disabled={data.backups.length === 0}>
          {#each data.backups as backup (backup.name)}
            <option value={backup.name} selected={backup.name === selectedBackup}>
              {backup.name} - {formatBytes(backup.bytes)} - {formatDate(backup.createdAt)}
            </option>
          {/each}
        </select>
      </label>

      <button type="submit" class="danger-action" disabled={data.backups.length === 0}>
        <RotateCcw class="h-4 w-4" />
        Restore and Clear v2
      </button>
    </form>

    <form method="POST" action="?/clearV2" class="tool-panel">
      <div class="tool-heading">
        <Trash2 class="h-5 w-5" />
        <div>
          <h2>Clear v2 Data</h2>
          <p>Keep the current legacy database state, but reset v2 tables for another import.</p>
        </div>
      </div>

      <button type="submit" class="danger-action">
        <Trash2 class="h-4 w-4" />
        Clear v2 Data
      </button>
    </form>
  </section>
</main>

<style>
  .dev-page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 100%;
    color: var(--color-text-primary);
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--color-border-subtle);
    padding-bottom: 1rem;
  }

  .page-header p,
  .tool-heading p,
  dt,
  label span {
    margin: 0;
    color: var(--color-text-muted);
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
    font-size: clamp(1.7rem, 3vw, 2.4rem);
    line-height: 1;
  }

  h2 {
    font-size: 1rem;
  }

  .gate-state {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-1);
    color: var(--color-text-muted);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.72rem;
    padding: 0.5rem 0.65rem;
    text-transform: uppercase;
  }

  .led-warn {
    background: var(--color-accent-500);
    box-shadow: var(--shadow-glow-accent);
  }

  .notice {
    display: grid;
    gap: 0.35rem;
    border: 1px solid var(--color-border-accent);
    background: var(--color-accent-950);
    padding: 0.85rem;
  }

  .notice-error {
    border-color: color-mix(in srgb, var(--color-error, #a84850) 72%, var(--color-border-subtle));
    background: color-mix(in srgb, var(--color-error-muted, #5a2c30) 55%, transparent);
    color: var(--color-error-text);
  }

  pre {
    max-height: 12rem;
    overflow: auto;
    margin: 0.25rem 0 0;
    border: 1px solid var(--color-border-subtle);
    background: rgb(0 0 0 / 0.25);
    color: var(--color-text-muted);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.72rem;
    padding: 0.65rem;
    white-space: pre-wrap;
  }

  .tool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 0.8rem;
  }

  .tool-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-1);
    padding: 1rem;
  }

  .wide-panel {
    grid-column: span 2;
  }

  .tool-heading {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .tool-heading :global(svg) {
    flex: 0 0 auto;
    color: var(--color-text-accent);
    filter: drop-shadow(0 0 8px rgb(196 154 90 / 0.35));
  }

  .tool-heading p {
    margin-top: 0.28rem;
    line-height: 1.5;
    text-transform: none;
  }

  dl {
    display: grid;
    gap: 0.65rem;
    margin: 0;
  }

  dt {
    margin-bottom: 0.2rem;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--color-text-primary);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.76rem;
  }

  label {
    display: grid;
    gap: 0.35rem;
  }

  select {
    min-height: 2.5rem;
    border: 1px solid var(--color-border-subtle);
    border-radius: 0;
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    font: inherit;
    padding: 0 0.65rem;
  }

  button {
    display: inline-flex;
    min-height: 2.4rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border: 1px solid var(--color-border-subtle);
    border-radius: 0;
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.74rem;
    text-transform: uppercase;
    transition:
      border-color var(--duration-fast) var(--ease-mechanical),
      box-shadow var(--duration-fast) var(--ease-mechanical),
      color var(--duration-fast) var(--ease-mechanical);
  }

  button:hover:not(:disabled),
  button:focus-visible {
    border-color: var(--color-border-accent);
    color: var(--color-text-accent);
    box-shadow: var(--shadow-glow-accent);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .danger-action {
    border-color: color-mix(in srgb, var(--color-error, #a84850) 55%, var(--color-border-subtle));
  }

  @media (max-width: 720px) {
    .page-header {
      flex-direction: column;
    }

    .wide-panel {
      grid-column: span 1;
    }
  }
</style>
