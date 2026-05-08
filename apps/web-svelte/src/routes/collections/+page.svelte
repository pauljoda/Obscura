<script lang="ts">
  import { page } from "$app/state";
  import { invalidateAll } from "$app/navigation";
  import { FolderOpen, Plus } from "@lucide/svelte";
  import { Button } from "@obscura/ui-svelte";
  import type { PageData } from "./$types";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";
  import { collectionsSurfaceConfig } from "$lib/media-surface/configs/collections";

  let { data }: { data: PageData } = $props();

  const config = $derived(
    collectionsSurfaceConfig({
      initial: { items: data.collections, total: data.total },
      pageSize: data.pageSize,
      page: data.page,
      mode: page.url.searchParams.get("mode") ?? undefined,
      onMutated: () => invalidateAll(),
    }),
  );
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <FolderOpen class="h-5 w-5 text-text-accent" />
        Collections
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Curated groupings across your media</p>
    </div>
    <a href="/collections/new">
      <Button variant="primary" size="md">
        {#snippet children()}
          <Plus class="h-4 w-4" />
          New Collection
        {/snippet}
      </Button>
    </a>
  </div>

  <MediaSurface
    {config}
    initialPrefsByFormFactor={data.surfacePrefs}
    legacyPrefsKey="collections:filterPresets"
  />
</div>
