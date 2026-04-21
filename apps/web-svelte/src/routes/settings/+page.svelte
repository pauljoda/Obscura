<script lang="ts">
  import { FolderOpen, HardDrive, Settings } from "@lucide/svelte";
  import { Badge, StatusLed } from "@obscura/ui-svelte";

  let { data } = $props();
  const cfg = data.config;

  function formatBytes(bytes: number | null | undefined) {
    if (!bytes) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i += 1;
    }
    return `${n.toFixed(1)} ${units[i]}`;
  }
</script>

<svelte:head>
  <title>Settings — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header>
    <p class="text-kicker text-text-muted">Operate</p>
    <h1 class="text-h1 text-text-primary">Settings</h1>
  </header>

  {#if !cfg}
    <div class="surface-panel p-5 text-body text-text-muted">Settings unavailable.</div>
  {:else}
    <section class="surface-panel p-5 space-y-3">
      <h2 class="text-label text-text-muted flex items-center gap-2">
        <FolderOpen class="h-3 w-3" />
        Library roots ({cfg.roots?.length ?? 0})
      </h2>
      {#if !cfg.roots || cfg.roots.length === 0}
        <p class="text-body text-text-muted">No library roots configured.</p>
      {:else}
        <ul class="divide-y divide-border-subtle">
          {#each cfg.roots as r (r.id)}
            <li class="flex items-center gap-3 py-2 text-body-sm">
              <StatusLed status={r.enabled ? "active" : "idle"} />
              <span class="flex-1 min-w-0 truncate text-text-primary font-mono">{r.path}</span>
              {#if !r.enabled}<Badge>disabled</Badge>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="surface-panel p-5 space-y-3">
      <h2 class="text-label text-text-muted flex items-center gap-2">
        <HardDrive class="h-3 w-3" />
        Storage
      </h2>
      <dl class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-body-sm text-text-secondary">
        <div class="flex gap-2"><dt class="text-text-muted">Thumbnails:</dt><dd>{formatBytes(cfg.storage?.thumbnailsBytes)}</dd></div>
        <div class="flex gap-2"><dt class="text-text-muted">Previews:</dt><dd>{formatBytes(cfg.storage?.previewsBytes)}</dd></div>
        <div class="flex gap-2"><dt class="text-text-muted">Trickplay:</dt><dd>{formatBytes(cfg.storage?.trickplayBytes)}</dd></div>
        <div class="flex gap-2"><dt class="text-text-muted">Total:</dt><dd>{formatBytes(cfg.storage?.totalBytes)}</dd></div>
      </dl>
    </section>

    <section class="surface-panel p-5 space-y-3">
      <h2 class="text-label text-text-muted flex items-center gap-2">
        <Settings class="h-3 w-3" />
        Library settings
      </h2>
      <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-body-sm text-text-secondary">
        {#if cfg.settings}
          {#each Object.entries(cfg.settings) as [k, v]}
            <div class="flex gap-2 min-w-0">
              <dt class="text-text-muted shrink-0">{k}:</dt>
              <dd class="truncate">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</dd>
            </div>
          {/each}
        {/if}
      </dl>
      <p class="text-body-sm text-text-disabled border-t border-border-subtle pt-3">
        Editable controls (subtitle defaults, NSFW toggles, diagnostics) land with the deep port
        <strong>APP-85</strong>.
      </p>
    </section>
  {/if}
</div>
