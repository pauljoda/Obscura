<script lang="ts">
  import { invalidate, invalidateAll } from "$app/navigation";
  import { onMount } from "svelte";
  import { Images, LayoutGrid, LayoutList, Pencil, Rows3 } from "@lucide/svelte";
  import { Badge, dur } from "@obscura/ui-svelte";
  import { deleteImage, updateGallery } from "$lib/api/media";
  import type { ImageListItemDto } from "@obscura/contracts";
  import ConfirmDeleteDialog from "$lib/components/ConfirmDeleteDialog.svelte";
  import ImageLightbox from "$lib/components/ImageLightbox.svelte";
  import GalleryEdit from "$lib/components/GalleryEdit.svelte";
  import ChildGalleryGrid from "$lib/components/galleries/ChildGalleryGrid.svelte";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import HierarchySection from "$lib/components/shared/HierarchySection.svelte";
  import ImportButton from "$lib/components/ImportButton.svelte";
  import InlineRating from "$lib/components/InlineRating.svelte";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";
  import { imagesSurfaceConfig } from "$lib/media-surface/configs/images";
  import UploadDropZone from "$lib/components/UploadDropZone.svelte";
  import { createServerPrefs } from "$lib/server-prefs.svelte";
  import {
    detectUiPrefsFormFactor,
    formFactorUiPrefKey,
  } from "$lib/prefs/form-factor-prefs";
  import { useAppChrome, type AppBreadcrumb } from "$lib/stores/app-chrome.svelte";

  type ChildGalleryViewPrefs = { cols: number };
  const childGalleryPrefsDefault: ChildGalleryViewPrefs = { cols: 3 };

  function validateChildGalleryPrefs(raw: unknown): ChildGalleryViewPrefs | null {
    if (!raw || typeof raw !== "object") return null;
    const cols = (raw as { cols?: unknown }).cols;
    if (typeof cols !== "number" || !Number.isFinite(cols)) return null;
    return { cols: Math.min(8, Math.max(2, Math.round(cols))) };
  }

  let { data } = $props();
  const appChrome = useAppChrome();
  const childGalleryFormFactor = detectUiPrefsFormFactor();
  let overrideRating = $state<number | null | undefined>(undefined);
  const g = $derived(
    overrideRating === undefined
      ? data.gallery
      : { ...data.gallery, rating: overrideRating },
  );

  async function handleRatingSave(next: number | null) {
    const previous = data.gallery.rating ?? null;
    overrideRating = next;
    try {
      await updateGallery(data.gallery.id, { rating: next });
    } catch {
      overrideRating = previous;
      throw new Error("Failed to update rating");
    }
  }

  let images = $state.raw<ImageListItemDto[]>([]);
  let imageTotal = $state(0);
  let syncedGalleryId = $state<string | null>(null);

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);
  let lightboxSourceId = $state<string | null>(null);
  let editing = $state(false);
  let deleteDialogOpen = $state(false);
  let pendingDelete = $state<ImageListItemDto[]>([]);
  let bulkBusy = $state(false);
  // svelte-ignore state_referenced_locally
  const childGalleryPrefs = createServerPrefs<ChildGalleryViewPrefs>(
    formFactorUiPrefKey("galleries:interiorView", childGalleryFormFactor),
    childGalleryPrefsDefault,
    data.viewPrefsByFormFactor?.[childGalleryFormFactor],
    validateChildGalleryPrefs,
  );
  const childGalleryCols = $derived(childGalleryPrefs.current.cols);

  onMount(() => {
    void childGalleryPrefs.load();
  });

  function openAt(i: number) {
    openLightboxAt(i);
  }

  function openLightboxAt(i: number) {
    lightboxIndex = i;
    lightboxSourceId = images[i]?.id ?? null;
    lightboxOpen = true;
  }

  function openImage(item: ImageListItemDto) {
    const existingIndex = images.findIndex((image) => image.id === item.id);
    if (existingIndex < 0) {
      images = [...images, item];
      lightboxIndex = images.length - 1;
    } else {
      lightboxIndex = existingIndex;
    }
    lightboxSourceId = item.id;
    lightboxOpen = true;
  }

  function closeLightbox() {
    lightboxOpen = false;
    window.setTimeout(() => {
      if (!lightboxOpen) lightboxSourceId = null;
    }, dur.moderate + 40);
  }

  function patchImageRating(imageId: string, rating: number | null) {
    images = images.map((image) =>
      image.id === imageId ? { ...image, rating } : image,
    );
  }

  async function refreshGallery() {
    await invalidate(`galleries:${data.gallery.id}`);
    editing = false;
  }

  async function confirmDelete(deleteFromDisk: boolean) {
    if (bulkBusy) return;
    bulkBusy = true;
    try {
      await Promise.all(pendingDelete.map((i) => deleteImage(i.id, deleteFromDisk)));
      deleteDialogOpen = false;
      pendingDelete = [];
      await invalidateAll();
    } finally {
      bulkBusy = false;
    }
  }

  const visibleChildGalleries = $derived(g.children ?? []);
  const galleryImageSurface = $derived(
    imagesSurfaceConfig({
      initial: { items: data.gallery.images, total: data.gallery.imageTotal },
      pageSize: data.pageSize,
      page: 1,
      nsfwMode: data.nsfwMode,
      galleryId: g.id,
      surfaceId: `gallery:${g.id}:images`,
      defaultViewMode: "masonry",
      defaultSortBy: "recent",
      defaultSortDir: "desc",
      layoutByViewMode: { masonry: "masonry", grid: "grid", list: "list" },
      viewModes: [
        { mode: "masonry", icon: Rows3, label: "Masonry view" },
        { mode: "grid", icon: LayoutGrid, label: "Grid view" },
        { mode: "list", icon: LayoutList, label: "List view" },
      ],
      onMutated: () => invalidateAll(),
      onConfirmDelete: (selected) => {
        pendingDelete = selected;
        deleteDialogOpen = true;
      },
      onItemActivate: (item) => openImage(item),
      onItemsChange: (items) => {
        images = items;
      },
      decorateItem: (image) =>
        image.id === lightboxSourceId && lightboxOpen
          ? { ...image, __lightboxSource: true }
          : image,
    }),
  );

  $effect(() => {
    if (syncedGalleryId !== data.gallery.id) {
      images = data.gallery.images;
      imageTotal = data.gallery.imageTotal;
      syncedGalleryId = data.gallery.id;
    }
  });

  $effect(() => {
    const crumbs: AppBreadcrumb[] = [{ label: "Galleries", href: "/galleries" }];
    if (g.parentId) {
      crumbs.push({ label: "Parent", href: `/galleries/${g.parentId}` });
    }
    crumbs.push({ label: g.title });
    return appChrome.setBreadcrumbs(crumbs);
  });
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<UploadDropZone target={{ kind: "image", galleryId: g.id }} enabled={Boolean(g.folderPath)}>
<div class="space-y-4">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="space-y-1.5">
      <h1 class="flex items-center gap-2.5 text-text-primary">
        <Images class="h-5 w-5 text-text-accent" />
        {g.title}
      </h1>
      <div class="flex flex-wrap items-center gap-2 text-[0.78rem] text-text-muted">
        <span>{g.imageCount} image{g.imageCount === 1 ? "" : "s"}</span>
        {#if g.studio}
          <a
            href={`/studios/${encodeURIComponent(g.studio.name)}`}
            class="text-text-accent hover:text-text-accent-bright transition-colors"
          >
            · {g.studio.name}
          </a>
        {/if}
        {#if g.date}<span>· {g.date}</span>{/if}
        {#if g.isNsfw}
          <Badge variant="warning">
            {#snippet children()}NSFW{/snippet}
          </Badge>
        {/if}
      </div>
      <InlineRating
        value={g.rating}
        onSave={handleRatingSave}
        ariaLabelPrefix="Rate gallery with"
      />
      {#if g.details}
        <p class="mt-2 text-[0.82rem] text-text-secondary leading-relaxed whitespace-pre-wrap max-w-2xl">
          {g.details}
        </p>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      {#if !editing}
        <button
          type="button"
          onclick={() => (editing = true)}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.78rem] border border-border-default hover:border-border-accent hover:text-text-accent transition-colors"
        >
          <Pencil class="h-3.5 w-3.5" />
          Edit
        </button>
      {/if}
    </div>
  </div>

  {#if editing}
    <GalleryEdit
      gallery={data.gallery}
      onSaved={() => void refreshGallery()}
      onCancel={() => (editing = false)}
    />
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
    <div class="space-y-6 min-w-0 order-2 lg:order-1">
      {#if visibleChildGalleries.length > 0}
        <HierarchySection title="Sub-galleries">
          {#snippet children()}
            <ChildGalleryGrid
              galleries={visibleChildGalleries}
              cols={childGalleryCols}
              onColsChange={(cols) => childGalleryPrefs.update({ cols })}
            />
          {/snippet}
        </HierarchySection>
      {/if}

      {#if imageTotal > 0}
        <HierarchySection title={visibleChildGalleries.length > 0 ? "Images" : ""}>
          {#snippet action()}
            {#if g.folderPath}
              <ImportButton target={{ kind: "image", galleryId: g.id }} onUploaded={refreshGallery} />
            {/if}
          {/snippet}
          {#snippet children()}
            <MediaSurface
              config={galleryImageSurface}
              initialPrefsByFormFactor={data.surfacePrefs}
              legacyPrefsKey={`gallery:${g.id}:imageFilterPresets`}
            />
          {/snippet}
        </HierarchySection>
      {:else if visibleChildGalleries.length === 0}
        <div class="surface-well flex flex-col items-center justify-center py-16 text-center">
          <Images class="h-8 w-8 text-text-disabled mb-2" />
          <p class="text-text-muted text-sm">This gallery is empty</p>
        </div>
      {/if}
    </div>

    <!-- Metadata sidebar -->
    <aside class="space-y-4 order-1 lg:order-2 lg:sticky lg:top-5 lg:self-start">
      <div class="surface-well p-4 space-y-4">
        {#if g.performers && g.performers.length > 0}
          <div class="space-y-2">
            <h2 class="text-kicker">Performers</h2>
            <div class="flex flex-wrap gap-1.5">
              {#each g.performers as p (p.id)}
                <a
                  href={`/performers/${p.id}`}
                  class="inline-flex items-center gap-1.5 tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                >
                  <EntityThumbnail
                    kind="performer"
                    performer={p}
                    compact
                    showChips={false}
                    class="h-4 w-3 flex-shrink-0"
                  />
                  {p.name}
                </a>
              {/each}
            </div>
          </div>
        {/if}

        {#if g.tags && g.tags.length > 0}
          <div class="space-y-2">
            <h2 class="text-kicker">Tags</h2>
            <div class="flex flex-wrap gap-1.5">
              {#each g.tags as t (t.id)}
                <a
                  href={`/tags/${encodeURIComponent(t.name)}`}
                  class="tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                >
                  {t.name}
                </a>
              {/each}
            </div>
          </div>
        {/if}

        <div class="space-y-2">
          <h2 class="text-kicker">Info</h2>
          <dl class="text-[0.78rem] space-y-1">
            <div class="flex justify-between gap-2">
              <dt class="text-text-muted">Type</dt>
              <dd class="text-text-primary">{g.galleryType}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-text-muted">Images</dt>
              <dd class="text-text-primary">{g.imageCount}</dd>
            </div>
            {#if g.photographer}
              <div class="flex justify-between gap-2">
                <dt class="text-text-muted">Photographer</dt>
                <dd class="text-text-primary truncate">{g.photographer}</dd>
              </div>
            {/if}
            {#if g.folderPath}
              <div class="flex justify-between gap-2">
                <dt class="text-text-muted">Path</dt>
                <dd class="text-text-primary truncate font-mono text-[0.7rem]" title={g.folderPath}>
                  {g.folderPath.split("/").slice(-2).join("/")}
                </dd>
              </div>
            {/if}
          </dl>
        </div>
      </div>
    </aside>
  </div>
</div>
</UploadDropZone>

<ConfirmDeleteDialog
  open={deleteDialogOpen}
  entityType="image"
  count={pendingDelete.length}
  loading={bulkBusy}
  allowDeleteFromDisk
  onClose={() => (deleteDialogOpen = false)}
  onDeleteFromLibrary={() => void confirmDelete(false)}
  onDeleteFromDisk={() => void confirmDelete(true)}
/>

{#if lightboxOpen}
  <ImageLightbox
    {images}
    initialIndex={lightboxIndex}
    sharedKey={lightboxSourceId ?? undefined}
    onClose={closeLightbox}
    onIndexChange={(index) => (lightboxIndex = index)}
    onRatingChange={patchImageRating}
  />
{/if}
