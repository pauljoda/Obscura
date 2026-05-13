<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { Music } from "@lucide/svelte";
  import type { AudioLibraryListItemDto } from "@obscura/contracts";
  import type { PageData } from "./$types";
  import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte";
  import ImportButton from "$lib/components/ImportButton.svelte";
  import UploadDropZone from "$lib/components/UploadDropZone.svelte";
  import { deleteAudioLibrary } from "$lib/v1/api/media-v1";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";
  import { audioSurfaceConfig } from "$lib/media-surface/configs/audio";

  let { data }: { data: PageData } = $props();

  let deleteDialogOpen = $state(false);
  let pendingDelete = $state<AudioLibraryListItemDto[]>([]);
  let bulkBusy = $state(false);

  const config = $derived(
    audioSurfaceConfig({
      initial: { items: data.libraries, total: data.total },
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
      await Promise.all(
        pendingDelete.map((l) => deleteAudioLibrary(l.id, deleteFromDisk)),
      );
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

<UploadDropZone target={{ kind: "audio" }}>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="flex items-center gap-2.5">
          <Music class="h-5 w-5 text-text-accent" />
          Audio
        </h1>
        <p class="text-text-muted text-[0.78rem] mt-1">
          Browse audio libraries in your collection
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ImportButton target={{ kind: "audio" }} />
        <span class="text-mono-sm text-text-disabled mt-1">
          {data.total.toLocaleString()} total
        </span>
      </div>
    </div>

    <MediaSurface
      {config}
      initialPrefsByFormFactor={data.surfacePrefs}
      legacyPrefsKey="audio:filterPresets"
    />
  </div>
</UploadDropZone>

<ConfirmDeleteDialog
  open={deleteDialogOpen}
  entityType="audio-library"
  count={pendingDelete.length}
  loading={bulkBusy}
  allowDeleteFromDisk
  onClose={() => (deleteDialogOpen = false)}
  onDeleteFromLibrary={() => void confirmDelete(false)}
  onDeleteFromDisk={() => void confirmDelete(true)}
/>
