<script lang="ts">
  import { Building2, Star, ExternalLink } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";

  let { data } = $props();
  const s = data.studio;
</script>

<svelte:head>
  <title>{s.name} — Studio — Obscura</title>
</svelte:head>

<div class="max-w-4xl space-y-6">
  <header class="flex flex-col sm:flex-row gap-4 items-start">
    <div class="w-32 h-24 shrink-0 bg-surface-1 border border-border-subtle overflow-hidden">
      {#if s.imagePath || s.imageUrl}
        <img
          src={toApiUrl(s.imagePath) ?? s.imageUrl ?? undefined}
          alt=""
          class="h-full w-full object-cover"
        />
      {:else}
        <div class="flex h-full items-center justify-center">
          <Building2 class="h-8 w-8 text-text-disabled" />
        </div>
      {/if}
    </div>
    <div class="flex-1 space-y-1.5">
      <p class="text-kicker text-text-muted">Studio</p>
      <h1 class="text-h1 text-text-primary flex items-center gap-2">
        {s.name}
        {#if s.favorite}
          <Star class="h-4 w-4 text-accent-500 fill-current" />
        {/if}
      </h1>
      {#if s.url}
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-body-sm text-text-accent hover:text-accent-400 transition-colors duration-fast"
        >
          <ExternalLink class="h-3 w-3" />
          {s.url}
        </a>
      {/if}
      <div class="flex flex-wrap gap-1 pt-1">
        {#if (s.videoCount ?? 0) > 0}<Badge>{s.videoCount} video{s.videoCount === 1 ? "" : "s"}</Badge>{/if}
        {#if (s.imageAppearanceCount ?? 0) > 0}<Badge>{s.imageAppearanceCount} image{s.imageAppearanceCount === 1 ? "" : "s"}</Badge>{/if}
        {#if (s.audioLibraryCount ?? 0) > 0}<Badge>{s.audioLibraryCount} album{s.audioLibraryCount === 1 ? "" : "s"}</Badge>{/if}
        {#if s.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
      </div>
    </div>
  </header>

  {#if s.description}
    <section class="surface-panel p-5 space-y-2">
      <h2 class="text-label text-text-muted">Description</h2>
      <p class="text-body text-text-secondary whitespace-pre-wrap">{s.description}</p>
    </section>
  {/if}

  {#if s.aliases}
    <section class="surface-panel p-5 space-y-2">
      <h2 class="text-label text-text-muted">Aliases</h2>
      <div class="flex flex-wrap gap-2">
        {#each s.aliases.split(/\s*,\s*/).filter(Boolean) as alias}
          <Badge>{alias}</Badge>
        {/each}
      </div>
    </section>
  {/if}

  <!-- TODO deep port: parent/children hierarchy, scraped stash IDs, associated videos/galleries/albums, rating picker, edit -->
</div>
