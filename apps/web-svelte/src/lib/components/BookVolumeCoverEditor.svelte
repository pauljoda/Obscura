<script lang="ts">
  import { BookOpen, Loader2, Upload, X } from "@lucide/svelte";
  import type { BookVolumeDto } from "@obscura/contracts";
  import {
    deleteBookVolumeCover,
    uploadBookVolumeCover,
  } from "$lib/v1/api/media-v1";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";

  interface Props {
    volumes: BookVolumeDto[];
    isNsfw: boolean;
    onChanged?: () => void | Promise<void>;
  }

  let { volumes, isNsfw, onChanged }: Props = $props();

  let uploadInput: HTMLInputElement | null = $state(null);
  let uploadVolumeId = $state<string | null>(null);
  let busyVolumeId = $state<string | null>(null);
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);

  function openUpload(volumeId: string) {
    uploadVolumeId = volumeId;
    uploadInput?.click();
  }

  async function handleUpload() {
    const file = uploadInput?.files?.[0];
    const volumeId = uploadVolumeId;
    if (!file || !volumeId) return;
    busyVolumeId = volumeId;
    error = null;
    message = null;
    try {
      await uploadBookVolumeCover(volumeId, file);
      message = "Volume cover updated";
      await onChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Upload failed";
    } finally {
      busyVolumeId = null;
      uploadVolumeId = null;
      if (uploadInput) uploadInput.value = "";
    }
  }

  async function clearCover(volumeId: string) {
    busyVolumeId = volumeId;
    error = null;
    message = null;
    try {
      await deleteBookVolumeCover(volumeId);
      message = "Volume cover reset";
      await onChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to clear cover";
    } finally {
      busyVolumeId = null;
    }
  }
</script>

{#if volumes.length > 0}
  <section class="surface-panel space-y-4 p-5">
    <div class="space-y-1">
      <h3 class="text-kicker flex items-center gap-2">
        <BookOpen class="h-3.5 w-3.5" />
        Volume Covers
      </h3>
      <p class="text-[0.78rem] text-text-muted">
        Use a custom image for each volume group.
      </p>
    </div>

    {#if message}
      <div class="surface-well border border-border-accent p-2.5 text-sm text-text-secondary">
        {message}
      </div>
    {/if}
    {#if error}
      <div class="surface-well border border-status-error/60 p-2.5 text-sm text-error-text">
        {error}
      </div>
    {/if}

    <input
      bind:this={uploadInput}
      type="file"
      accept="image/*"
      class="hidden"
      onchange={() => void handleUpload()}
    />

    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {#each volumes as volume (volume.id)}
        {@const busy = busyVolumeId === volume.id}
        <article class="surface-card-sharp overflow-hidden">
          <div class="grid grid-cols-[92px_1fr] gap-3 p-3">
            <div class="border border-border-subtle bg-surface-2">
              <EntityThumbnail
                kind="book"
                title={volume.title}
                coverImagePath={volume.coverImagePath ?? volume.chapters[0]?.coverImagePath ?? null}
                pageCount={volume.chapterCount}
                {isNsfw}
                aspectClass="aspect-[2/3]"
                fit="contain"
                showCount={false}
              />
            </div>
            <div class="min-w-0 space-y-2">
              <div>
                <h4 class="truncate text-[0.86rem] font-medium text-text-primary">
                  {volume.title}
                </h4>
                <div class="mt-1 text-[0.68rem] text-text-muted">
                  {volume.chapterCount} chapter{volume.chapterCount === 1 ? "" : "s"}
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onclick={() => openUpload(volume.id)}
                  disabled={busy}
                  class="inline-flex items-center gap-1.5 border border-border-default px-2 py-1 text-[0.68rem] text-text-secondary transition-colors hover:border-border-accent hover:text-text-accent disabled:opacity-60"
                >
                  {#if busy}
                    <Loader2 class="h-3 w-3 animate-spin" />
                  {:else}
                    <Upload class="h-3 w-3" />
                  {/if}
                  Upload
                </button>
                {#if volume.hasCustomCover}
                  <button
                    type="button"
                    onclick={() => void clearCover(volume.id)}
                    disabled={busy}
                    class="inline-flex items-center gap-1.5 border border-border-default px-2 py-1 text-[0.68rem] text-text-muted transition-colors hover:border-error-text hover:text-error-text disabled:opacity-60"
                  >
                    <X class="h-3 w-3" />
                    Clear
                  </button>
                {/if}
              </div>
            </div>
          </div>
        </article>
      {/each}
    </div>
  </section>
{/if}
