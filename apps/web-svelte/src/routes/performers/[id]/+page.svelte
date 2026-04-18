<script lang="ts">
  import { Users, Star } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";

  let { data } = $props();
  const p = data.performer as {
    id: string;
    name: string;
    disambiguation?: string | null;
    aliases?: string | null;
    gender?: string | null;
    birthdate?: string | null;
    country?: string | null;
    imagePath?: string | null;
    favorite?: boolean;
    rating?: number | null;
    isNsfw?: boolean;
    videoCount?: number;
    imageAppearanceCount?: number;
    audioLibraryCount?: number;
  };
</script>

<svelte:head>
  <title>{p.name} — Actor — Obscura</title>
</svelte:head>

<div class="max-w-4xl space-y-6">
  <header class="flex flex-col sm:flex-row gap-4 items-start">
    <div class="w-32 h-44 shrink-0 bg-surface-1 border border-border-subtle overflow-hidden">
      {#if p.imagePath}
        <img src={toApiUrl(p.imagePath)} alt="" class="h-full w-full object-cover" />
      {:else}
        <div class="flex h-full items-center justify-center">
          <Users class="h-10 w-10 text-text-disabled" />
        </div>
      {/if}
    </div>
    <div class="flex-1 space-y-1.5">
      <p class="text-kicker text-text-muted">Actor</p>
      <h1 class="text-h1 text-text-primary flex items-center gap-2 flex-wrap">
        {p.name}
        {#if p.disambiguation}
          <span class="text-text-muted text-lg">({p.disambiguation})</span>
        {/if}
        {#if p.favorite}
          <Star class="h-4 w-4 text-accent-500 fill-current" />
        {/if}
      </h1>

      <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-body-sm text-text-secondary mt-2">
        {#if p.gender}
          <div class="flex gap-2"><dt class="text-text-muted">Gender:</dt><dd>{p.gender.replaceAll("_", " ")}</dd></div>
        {/if}
        {#if p.country}
          <div class="flex gap-2"><dt class="text-text-muted">Country:</dt><dd>{p.country}</dd></div>
        {/if}
        {#if p.birthdate}
          <div class="flex gap-2"><dt class="text-text-muted">Born:</dt><dd>{p.birthdate}</dd></div>
        {/if}
      </dl>

      <div class="flex flex-wrap gap-1 pt-2">
        {#if (p.videoCount ?? 0) > 0}<Badge>{p.videoCount} video{p.videoCount === 1 ? "" : "s"}</Badge>{/if}
        {#if (p.imageAppearanceCount ?? 0) > 0}<Badge>{p.imageAppearanceCount} image{p.imageAppearanceCount === 1 ? "" : "s"}</Badge>{/if}
        {#if (p.audioLibraryCount ?? 0) > 0}<Badge>{p.audioLibraryCount} album{p.audioLibraryCount === 1 ? "" : "s"}</Badge>{/if}
        {#if p.isNsfw}<Badge variant="warning">NSFW</Badge>{/if}
      </div>
    </div>
  </header>

  {#if p.aliases}
    <section class="surface-panel p-5 space-y-2">
      <h2 class="text-label text-text-muted">Aliases</h2>
      <div class="flex flex-wrap gap-2">
        {#each p.aliases.split(/\s*,\s*/).filter(Boolean) as alias}
          <Badge>{alias}</Badge>
        {/each}
      </div>
    </section>
  {/if}

  <!-- TODO deep port: saved video roles (Known For), appearances, stash id chips, edit/scrape actions -->
</div>
