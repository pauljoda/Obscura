<script lang="ts">
  import { FolderOpen, Images } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import NsfwBlur from "./NsfwBlur.svelte";
  import NsfwShowModeChip from "./NsfwShowModeChip.svelte";

  interface Props {
    title: string;
    coverImagePath?: string | null;
    previewThumbnailPaths?: string[] | null;
    updatedAt?: string | null;
    isNsfw?: boolean;
    videoCount?: number | null;
    loading?: "eager" | "lazy";
    showCount?: boolean;
    class?: string;
  }

  let {
    title,
    coverImagePath = null,
    previewThumbnailPaths = [],
    updatedAt = null,
    isNsfw = false,
    videoCount = null,
    loading = "lazy",
    showCount = true,
    class: className,
  }: Props = $props();

  const cover = $derived(toApiUrl(coverImagePath, updatedAt ?? undefined));
  const previews = $derived(
    (previewThumbnailPaths ?? [])
      .map((path) => toApiUrl(path, updatedAt ?? undefined))
      .filter(Boolean) as string[],
  );

  let hoverIndex = $state(0);
  let hovering = $state(false);

  function startHover() {
    hovering = true;
  }

  function endHover() {
    hovering = false;
    hoverIndex = 0;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class={cn("relative aspect-[2/3] bg-surface-2", className)}
  onmouseenter={startHover}
  onmouseleave={endHover}
  onmousemove={(e) => {
    if (!hovering || previews.length === 0 || cover) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    hoverIndex = Math.min(
      previews.length - 1,
      Math.max(0, Math.floor(ratio * previews.length)),
    );
  }}
>
  <NsfwBlur {isNsfw} class="block h-full w-full">
    {#if cover}
      <img
        src={cover}
        alt={title}
        class="absolute inset-0 h-full w-full object-cover"
        {loading}
      />
    {:else if previews.length > 0}
      <img
        src={previews[hoverIndex] ?? previews[0]}
        alt={title}
        class="absolute inset-0 h-full w-full object-cover"
        {loading}
      />
    {:else}
      <div class="flex h-full w-full items-center justify-center text-text-disabled">
        <FolderOpen class="h-8 w-8" />
      </div>
    {/if}
  </NsfwBlur>

  <NsfwShowModeChip
    {isNsfw}
    class="pointer-events-none absolute bottom-2 right-2 z-10"
  />
  {#if showCount && videoCount != null}
    <div
      class="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 text-[0.65rem] text-white/90 backdrop-blur-sm"
    >
      <Images class="h-3 w-3" />
      {videoCount}
    </div>
  {/if}
</div>
