<script lang="ts">
  import { Edit, FolderOpen } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";

  let { data } = $props();
  const c = data.collection;
</script>

<svelte:head>
  <title>{c.name} — Collection — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-start justify-between gap-4 flex-wrap">
    <div class="flex-1 space-y-1.5">
      <p class="text-kicker text-text-muted">Collection</p>
      <h1 class="text-h1 text-text-primary">{c.name}</h1>
      <div class="flex flex-wrap items-center gap-2 text-body-sm text-text-muted">
        <span>{c.itemCount} item{c.itemCount === 1 ? "" : "s"}</span>
        <Badge>{c.mode}</Badge>
        {#if c.slideshowAutoAdvance}<Badge>auto-advance {c.slideshowDurationSeconds}s</Badge>{/if}
      </div>
    </div>
    <a href={`/collections/${c.id}/edit`}>
      <Button variant="secondary" size="md">
        <Edit class="h-3.5 w-3.5" />
        Edit
      </Button>
    </a>
  </header>

  {#if c.coverImagePath}
    <div class="surface-panel overflow-hidden aspect-[21/9] bg-surface-1">
      <img src={toApiUrl(c.coverImagePath)} alt="" class="h-full w-full object-cover" />
    </div>
  {/if}

  {#if c.description}
    <section class="surface-panel p-5 space-y-2">
      <h2 class="text-label text-text-muted">Description</h2>
      <p class="text-body text-text-secondary whitespace-pre-wrap break-words">{c.description}</p>
    </section>
  {/if}

  <section class="surface-panel p-5 space-y-2">
    <h2 class="text-label text-text-muted">Type breakdown</h2>
    <div class="flex flex-wrap gap-2">
      {#each Object.entries(c.typeCounts) as [type, count]}
        {#if count > 0}
          <Badge>{type}: {count}</Badge>
        {/if}
      {/each}
    </div>
  </section>

  <!-- TODO deep port (APP-75): queue sheet, shuffle/loop, slideshow player, rule-builder UI for smart collections -->
  <section class="surface-panel p-5 text-body-sm text-text-muted">
    Playback queue, shuffle/loop, and smart-rule editor land with the deep port
    <strong>APP-75</strong>.
  </section>
</div>
