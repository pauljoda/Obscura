<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { Layers } from "@lucide/svelte";
  import type { GalleryListItemDto } from "@obscura/contracts";
  import type { PageData } from "./$types";
  import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte";
  import { deleteGallery } from "$lib/v1/api/media-v1";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";
  import { galleriesSurfaceConfig } from "$lib/media-surface/configs/galleries";

  let { data }: { data: PageData } = $props();

  let deleteDialogOpen = $state(false);
  let pendingDelete = $state<GalleryListItemDto[]>([]);
  let bulkBusy = $state(false);

  const config = $derived(
    galleriesSurfaceConfig({
      initial: { items: data.galleries, total: data.total },
      pageSize: data.pageSize,
      page: data.page,
      nsfwMode: data.nsfwMode,
      onMutated: () => invalidateAll(),
      onConfirmDelete: (selected) => {
        pendingDelete = selected;
        deleteDialogOpen = true;
      },
    }),
  );

  async function confirmDelete(deleteFromDisk: boolean) {
    if (bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(pendingDelete.map((g) => deleteGallery(g.id, deleteFromDisk)));
      deleteDialogOpen = false;
      pendingDelete = [];
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }

</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <Layers class="h-5 w-5 text-text-accent" />
        Galleries
      </h1>
      <p class="text-text-muted text-[0.78rem] mt-1">Browse galleries in your library</p>
    </div>
    <span class="text-mono-sm text-text-disabled mt-1">
      {data.total.toLocaleString()} total
    </span>
  </div>

  <MediaSurface
    {config}
    initialPrefsByFormFactor={data.surfacePrefs}
    legacyPrefsKey="galleries:filterPresets"
  />
</div>

<ConfirmDeleteDialog
  open={deleteDialogOpen}
  entityType="gallery"
  count={pendingDelete.length}
  loading={bulkBusy}
  allowDeleteFromDisk
  onClose={() => (deleteDialogOpen = false)}
  onDeleteFromLibrary={() => void confirmDelete(false)}
  onDeleteFromDisk={() => void confirmDelete(true)}
/>
