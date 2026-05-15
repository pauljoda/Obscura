<script lang="ts">
  import { AlertTriangle, DatabaseBackup, Grid2x2, LayoutList, Palette, Play, RotateCcw, ShieldAlert, Trash2 } from "@lucide/svelte";

  interface GateStatus {
    gateId: string;
    accepted: boolean;
  }

  interface ImportCounts {
    seriesImported?: number;
    videosImported?: number;
    peopleImported?: number;
    tagsImported?: number;
    studiosImported?: number;
    imagesImported?: number;
    galleriesImported?: number;
    booksImported?: number;
    audioLibrariesImported?: number;
    audioTracksImported?: number;
    collectionsImported?: number;
    linksImported?: number;
  }

  interface FreshStartResult {
    backupPath: string;
    preservedLibraryRoots: number;
    preservedSettings: boolean;
    mediaReset: boolean;
    videoImport: ImportCounts | null;
    mediaImport: ImportCounts | null;
  }

  let gate: GateStatus | null = $state(null);
  let gateError: string | null = $state(null);
  let actionMessage: { ok: boolean; text: string; details?: string } | null = $state(null);
  let busy: string | null = $state(null);

  async function loadGate() {
    try {
      const res = await fetch("/api/system/v2-upgrade-gate");
      if (res.ok) {
        gate = await res.json();
        gateError = null;
      } else {
        gateError = `Gate status ${res.status}`;
      }
    } catch (err) {
      gateError = err instanceof Error ? err.message : String(err);
    }
  }

  loadGate();

  async function promptGate() {
    busy = "promptGate";
    actionMessage = null;
    try {
      const res = await fetch("/api/system/v2-upgrade-gate/prompt", { method: "POST" });
      if (res.ok) {
        gate = await res.json();
        actionMessage = { ok: true, text: "Gate re-armed. Reload the app to see the consent prompt." };
      } else if (res.status === 404) {
        actionMessage = { ok: false, text: "Prompt endpoint returned 404 — the .NET backend may not be running in Development mode." };
      } else {
        actionMessage = { ok: false, text: `Prompt gate failed: ${res.status}` };
      }
    } catch (err) {
      actionMessage = { ok: false, text: err instanceof Error ? err.message : String(err) };
    } finally {
      busy = null;
    }
  }

  async function runFreshStart() {
    busy = "freshStart";
    actionMessage = null;
    try {
      const acceptRes = await fetch("/api/system/v2-upgrade-gate/accept", { method: "POST" });
      if (!acceptRes.ok) {
        actionMessage = { ok: false, text: `Accept gate failed: ${acceptRes.status}` };
        return;
      }
      gate = await acceptRes.json();

      const prepareRes = await fetch("/api/system/v2-fresh-start/prepare", { method: "POST" });
      if (!prepareRes.ok) {
        const body = await prepareRes.text();
        actionMessage = { ok: false, text: `Fresh-start prepare failed: ${prepareRes.status}`, details: body };
        return;
      }

      const result: FreshStartResult = await prepareRes.json();
      const lines: string[] = [
        `Backup: ${result.backupPath}`,
        `Library roots preserved: ${result.preservedLibraryRoots}`,
        `Settings preserved: ${result.preservedSettings}`,
        `Media reset: ${result.mediaReset}`,
      ];

      if (result.videoImport) {
        const v = result.videoImport;
        lines.push("");
        lines.push("Video import:");
        if (v.seriesImported) lines.push(`  Series: ${v.seriesImported}`);
        if (v.videosImported) lines.push(`  Videos: ${v.videosImported}`);
        if (v.peopleImported) lines.push(`  People: ${v.peopleImported}`);
        if (v.tagsImported) lines.push(`  Tags: ${v.tagsImported}`);
        if (v.studiosImported) lines.push(`  Studios: ${v.studiosImported}`);
        if (v.linksImported) lines.push(`  Links: ${v.linksImported}`);
      }

      if (result.mediaImport) {
        const m = result.mediaImport;
        lines.push("");
        lines.push("Media import:");
        if (m.imagesImported) lines.push(`  Images: ${m.imagesImported}`);
        if (m.galleriesImported) lines.push(`  Galleries: ${m.galleriesImported}`);
        if (m.booksImported) lines.push(`  Books: ${m.booksImported}`);
        if (m.audioLibrariesImported) lines.push(`  Audio libraries: ${m.audioLibrariesImported}`);
        if (m.audioTracksImported) lines.push(`  Audio tracks: ${m.audioTracksImported}`);
        if (m.collectionsImported) lines.push(`  Collections: ${m.collectionsImported}`);
        if (m.linksImported) lines.push(`  Links: ${m.linksImported}`);
      }

      actionMessage = {
        ok: true,
        text: "Fresh-start completed with legacy data migration.",
        details: lines.join("\n"),
      };
    } catch (err) {
      actionMessage = { ok: false, text: err instanceof Error ? err.message : String(err) };
    } finally {
      busy = null;
    }
  }

  async function importVideosOnly() {
    busy = "importVideos";
    actionMessage = null;
    try {
      const res = await fetch("/api/system/v2-legacy-video-import", { method: "POST" });
      if (!res.ok) {
        actionMessage = { ok: false, text: `Video import failed: ${res.status}` };
        return;
      }
      const result: ImportCounts = await res.json();
      const lines = [
        `Series: ${result.seriesImported ?? 0}`,
        `Videos: ${result.videosImported ?? 0}`,
        `People: ${result.peopleImported ?? 0}`,
        `Tags: ${result.tagsImported ?? 0}`,
        `Studios: ${result.studiosImported ?? 0}`,
        `Links: ${result.linksImported ?? 0}`,
      ];
      actionMessage = { ok: true, text: "Legacy video import complete.", details: lines.join("\n") };
    } catch (err) {
      actionMessage = { ok: false, text: err instanceof Error ? err.message : String(err) };
    } finally {
      busy = null;
    }
  }

  async function importMediaOnly() {
    busy = "importMedia";
    actionMessage = null;
    try {
      const res = await fetch("/api/system/v2-legacy-media-import", { method: "POST" });
      if (!res.ok) {
        actionMessage = { ok: false, text: `Media import failed: ${res.status}` };
        return;
      }
      const result: ImportCounts = await res.json();
      const lines = [
        `Images: ${result.imagesImported ?? 0}`,
        `Galleries: ${result.galleriesImported ?? 0}`,
        `Books: ${result.booksImported ?? 0}`,
        `Audio libraries: ${result.audioLibrariesImported ?? 0}`,
        `Audio tracks: ${result.audioTracksImported ?? 0}`,
        `Collections: ${result.collectionsImported ?? 0}`,
        `Links: ${result.linksImported ?? 0}`,
      ];
      actionMessage = { ok: true, text: "Legacy media import complete.", details: lines.join("\n") };
    } catch (err) {
      actionMessage = { ok: false, text: err instanceof Error ? err.message : String(err) };
    } finally {
      busy = null;
    }
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
      {#if gateError}
        <span class="led led-error"></span>
        <span>Backend unavailable</span>
      {:else if gate}
        <span class={gate.accepted ? "led led-idle" : "led led-warn"}></span>
        <span>{gate.accepted ? "Gate clear" : "Gate waiting"}</span>
      {:else}
        <span class="led"></span>
        <span>Loading…</span>
      {/if}
    </div>
  </header>

  {#if actionMessage}
    <section class={["notice", !actionMessage.ok && "notice-error"]} aria-live="polite">
      <strong>{actionMessage.ok ? "Done" : "Action failed"}</strong>
      <span>{actionMessage.text}</span>
      {#if actionMessage.details}
        <pre>{actionMessage.details}</pre>
      {/if}
    </section>
  {/if}

  <section class="quick-links">
    <a href="/design-language" class="quick-link">
      <Palette class="h-4 w-4" />
      Design System
    </a>
    <a href="/settings" class="quick-link">
      <Grid2x2 class="h-4 w-4" />
      Settings
    </a>
    <a href="/jobs" class="quick-link">
      <LayoutList class="h-4 w-4" />
      Operations
    </a>
  </section>

  <section class="tool-grid">
    <div class="tool-panel">
      <div class="tool-heading">
        <ShieldAlert class="h-5 w-5" />
        <div>
          <h2>Prompt Upgrade Gate</h2>
          <p>Remove the consent marker so the first-boot gate blocks entry on next load.</p>
        </div>
      </div>

      <dl>
        <div>
          <dt>Status</dt>
          <dd>{gate ? (gate.accepted ? "Accepted" : "Awaiting consent") : gateError ?? "Loading…"}</dd>
        </div>
      </dl>

      <button type="button" onclick={promptGate} disabled={busy !== null} class="danger-action">
        <AlertTriangle class="h-4 w-4" />
        {busy === "promptGate" ? "Re-arming…" : "Prompt Upgrade Gate"}
      </button>
    </div>

    <div class="tool-panel wide-panel">
      <div class="tool-heading">
        <DatabaseBackup class="h-5 w-5" />
        <div>
          <h2>Full Migration</h2>
          <p>Accept gate, back up DB, reset v2 tables, and import all legacy data in one pass.</p>
        </div>
      </div>

      <button type="button" onclick={runFreshStart} disabled={busy !== null}>
        <RotateCcw class="h-4 w-4" />
        {busy === "freshStart" ? "Running migration…" : "Run Full Migration"}
      </button>
    </div>

    <div class="tool-panel">
      <div class="tool-heading">
        <Play class="h-5 w-5" />
        <div>
          <h2>Import Videos Only</h2>
          <p>Run the legacy video import into existing v2 tables without resetting first.</p>
        </div>
      </div>

      <button type="button" onclick={importVideosOnly} disabled={busy !== null}>
        <Play class="h-4 w-4" />
        {busy === "importVideos" ? "Importing…" : "Import Legacy Videos"}
      </button>
    </div>

    <div class="tool-panel">
      <div class="tool-heading">
        <Play class="h-5 w-5" />
        <div>
          <h2>Import Media Only</h2>
          <p>Run the legacy media import (images, galleries, books, audio, collections) without resetting.</p>
        </div>
      </div>

      <button type="button" onclick={importMediaOnly} disabled={busy !== null}>
        <Play class="h-4 w-4" />
        {busy === "importMedia" ? "Importing…" : "Import Legacy Media"}
      </button>
    </div>
  </section>
</main>

<style>
  .dev-page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 100%;
    padding: 1.5rem;
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

  .led {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--color-text-muted);
  }

  .led-warn {
    background: var(--color-accent-500);
    box-shadow: var(--shadow-glow-accent);
  }

  .led-idle {
    background: #4ade80;
    box-shadow: 0 0 6px #4ade8066;
  }

  .led-error {
    background: var(--color-error, #a84850);
    box-shadow: 0 0 6px color-mix(in srgb, var(--color-error, #a84850) 50%, transparent);
  }

  .quick-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .quick-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-1);
    color: var(--color-text-muted);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.72rem;
    text-transform: uppercase;
    text-decoration: none;
    padding: 0.45rem 0.75rem;
    transition:
      border-color var(--duration-fast) var(--ease-mechanical),
      box-shadow var(--duration-fast) var(--ease-mechanical),
      color var(--duration-fast) var(--ease-mechanical);
  }

  .quick-link:hover {
    border-color: var(--color-border-accent);
    color: var(--color-text-accent);
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
    max-height: 16rem;
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
    cursor: pointer;
    padding: 0 1rem;
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
