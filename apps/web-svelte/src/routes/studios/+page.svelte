<script lang="ts">
  import { Plus, Building2, Star } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";

  let { data } = $props();
</script>

<svelte:head>
  <title>Studios — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-center justify-between gap-4">
    <div>
      <p class="text-kicker text-text-muted">Browse</p>
      <h1 class="text-h1 text-text-primary">Studios</h1>
      <p class="text-body text-text-muted mt-1">
        {data.studios.length} studio{data.studios.length === 1 ? "" : "s"}
      </p>
    </div>
    <a href="/studios/new">
      <Button variant="primary" size="md">
        <Plus class="h-4 w-4" />
        New studio
      </Button>
    </a>
  </header>

  {#if data.studios.length === 0}
    <div class="surface-panel p-8 text-center">
      <Building2 class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No studios yet.</p>
    </div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {#each data.studios as studio (studio.id)}
        <a
          href={`/studios/${encodeURIComponent(studio.name)}`}
          class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast"
        >
          <div class="aspect-[4/3] bg-surface-1 relative">
            {#if studio.imagePath || studio.imageUrl}
              <img
                src={toApiUrl(studio.imagePath) ?? studio.imageUrl ?? undefined}
                alt=""
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover"
              />
            {:else}
              <div class="flex h-full items-center justify-center">
                <Building2 class="h-8 w-8 text-text-disabled" />
              </div>
            {/if}
            {#if studio.favorite}
              <Star class="absolute top-1.5 right-1.5 h-3 w-3 text-accent-500 fill-current drop-shadow-[0_0_4px_rgba(199,155,92,0.5)]" />
            {/if}
          </div>
          <div class="p-2.5 space-y-1.5">
            <h4 class="truncate text-body font-medium text-text-primary">{studio.name}</h4>
            <div class="flex flex-wrap items-center gap-1">
              {#if studio.videoCount > 0}
                <Badge>{studio.videoCount} video{studio.videoCount === 1 ? "" : "s"}</Badge>
              {/if}
              {#if studio.imageAppearanceCount > 0}
                <Badge>{studio.imageAppearanceCount} image{studio.imageAppearanceCount === 1 ? "" : "s"}</Badge>
              {/if}
              {#if studio.audioLibraryCount > 0}
                <Badge>{studio.audioLibraryCount} album{studio.audioLibraryCount === 1 ? "" : "s"}</Badge>
              {/if}
              {#if studio.isNsfw}
                <Badge variant="warning">NSFW</Badge>
              {/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
