<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { Film } from "@lucide/svelte";
  import type { PageData } from "./$types";
  import type { VideoCardListItem } from "$lib/api/types";
  import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte";
  import ImportButton from "$lib/components/ImportButton.svelte";
  import UploadDropZone from "$lib/components/UploadDropZone.svelte";
  import { deleteVideo } from "$lib/api/videos";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";
  import { videosSurfaceConfig } from "$lib/media-surface/configs/videos";

  let { data }: { data: PageData } = $props();

  let deleteDialogOpen = $state(false);
  let pendingDelete = $state<VideoCardListItem[]>([]);
  let bulkBusy = $state(false);

  // Streamed filter-panel data — adopt as the promises resolve so the
  // alphabetical-id-list sections in the drawer are populated.
  type FacetItem = { id: string; name: string; count?: number; isNsfw?: boolean };
  let studiosList = $state<FacetItem[]>([]);
  let tagsList = $state<FacetItem[]>([]);
  let performersList = $state<FacetItem[]>([]);

  $effect(() => {
    void data.streamed.studios.then((r) => {
      studiosList = r.map((s) => ({
        id: s.id,
        name: s.name,
        count: s.videoCount,
        isNsfw: s.isNsfw,
      }));
    });
  });
  $effect(() => {
    void data.streamed.tags.then((r) => {
      tagsList = r.map((t) => ({
        id: t.id,
        name: t.name,
        count: t.videoCount,
        isNsfw: t.isNsfw,
      }));
    });
  });
  $effect(() => {
    void data.streamed.performers.then((r) => {
      performersList = r.map((p) => ({
        id: p.id,
        name: p.name,
        count: p.videoCount,
        isNsfw: p.isNsfw,
      }));
    });
  });

  const seasonNumber = $derived.by(() => {
    const raw = page.url.searchParams.get("season");
    return raw != null && /^\d+$/.test(raw) ? raw : undefined;
  });

  const config = $derived(
    videosSurfaceConfig({
      initial: { items: data.videos, total: data.total },
      pageSize: data.pageSize,
      page: data.page,
      nsfwMode: data.nsfwMode,
      seasonNumber,
      available: {
        tags: tagsList,
        performers: performersList,
        studios: studiosList,
      },
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
      await Promise.all(pendingDelete.map((v) => deleteVideo(v.id, deleteFromDisk)));
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

<UploadDropZone target={{ kind: "video" }}>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="flex items-center gap-2.5">
          <Film class="h-5 w-5 text-text-accent" />
          Videos
        </h1>
        <p class="mt-1 text-[0.78rem] text-text-muted">
          Browse and manage your media library
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ImportButton target={{ kind: "video" }} />
        <span class="mt-1 text-mono-sm text-text-disabled">
          {data.total.toLocaleString()} total
        </span>
      </div>
    </div>

    <MediaSurface
      {config}
      initialPrefsByFormFactor={data.surfacePrefs}
      legacyPrefsKey="videos:listPrefs"
    />
  </div>
</UploadDropZone>

<ConfirmDeleteDialog
  open={deleteDialogOpen}
  entityType="video"
  count={pendingDelete.length}
  loading={bulkBusy}
  allowDeleteFromDisk
  onClose={() => (deleteDialogOpen = false)}
  onDeleteFromLibrary={() => void confirmDelete(false)}
  onDeleteFromDisk={() => void confirmDelete(true)}
/>
