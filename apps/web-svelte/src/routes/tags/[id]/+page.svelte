<script lang="ts">
  import { Tag as TagIcon } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.tag.name} — Tag — Obscura</title>
</svelte:head>

<div class="max-w-3xl space-y-6">
  <header>
    <p class="text-kicker text-text-muted">Tag</p>
    <h1 class="text-h1 text-text-primary flex items-center gap-3">
      <TagIcon class="h-6 w-6 text-accent-500" />
      {data.tag.name}
    </h1>
  </header>

  {#if data.tag.aliases && data.tag.aliases.length > 0}
    <section class="surface-panel p-5 space-y-2">
      <h2 class="text-label text-text-muted">Aliases</h2>
      <div class="flex flex-wrap gap-2">
        {#each data.tag.aliases as alias}
          <Badge>{alias}</Badge>
        {/each}
      </div>
    </section>
  {/if}

  <!-- TODO Phase 5 deep-port: associated videos, galleries, performers, edit actions -->
  <section class="surface-panel p-5 text-body-sm text-text-muted">
    Associated media and full edit UI land with the deep-port of the tag detail route.
  </section>
</div>
