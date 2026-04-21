<script lang="ts">
  import { Puzzle } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";

  let { data } = $props();

  type PluginLike = {
    id?: string;
    packageId?: string;
    name?: string;
    version?: string;
    status?: string;
    isNsfw?: boolean;
    description?: string;
    capabilities?: string[];
  };

  const plugins: PluginLike[] = Array.isArray(data.plugins) ? (data.plugins as PluginLike[]) : [];
  const scrapers: PluginLike[] = Array.isArray(data.scrapers)
    ? (data.scrapers as PluginLike[])
    : [];
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header>
    <p class="text-kicker text-text-muted">Operate</p>
    <h1 class="text-h1 text-text-primary">Plugins</h1>
  </header>

  <section class="space-y-3">
    <h2 class="text-label text-text-muted">Obscura plugins ({plugins.length})</h2>
    {#if plugins.length === 0}
      <div class="surface-panel p-5 text-body text-text-muted">No plugins installed.</div>
    {:else}
      <ul class="surface-panel divide-y divide-border-subtle">
        {#each plugins as p, i}
          <li class="flex items-center gap-3 px-4 py-2">
            <Puzzle class="h-4 w-4 text-accent-500 shrink-0" />
            <span class="flex-1 min-w-0 truncate text-body text-text-primary">
              {p.name ?? p.packageId ?? "unnamed plugin"}
            </span>
            {#if p.version}
              <span class="font-mono text-[0.65rem] text-text-disabled">v{p.version}</span>
            {/if}
            {#if p.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
            {#if p.status}<Badge>{p.status}</Badge>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="space-y-3">
    <h2 class="text-label text-text-muted">Stash-compat scrapers ({scrapers.length})</h2>
    {#if scrapers.length === 0}
      <div class="surface-panel p-5 text-body text-text-muted">No scrapers installed.</div>
    {:else}
      <ul class="surface-panel divide-y divide-border-subtle">
        {#each scrapers as s, i}
          <li class="flex items-center gap-3 px-4 py-2">
            <Puzzle class="h-4 w-4 text-text-muted shrink-0" />
            <span class="flex-1 min-w-0 truncate text-body text-text-primary">
              {s.name ?? s.packageId}
            </span>
            {#if s.version}
              <span class="font-mono text-[0.65rem] text-text-disabled">v{s.version}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
