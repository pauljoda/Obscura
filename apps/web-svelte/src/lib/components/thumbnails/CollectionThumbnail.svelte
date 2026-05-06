<script module lang="ts">
  export type CollectionThumbnailSize = "grid" | "list" | "compact" | "hero";
</script>

<script lang="ts">
  import { FolderOpen } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import NsfwBlur from "../nsfw/NsfwBlur.svelte";

  interface CollectionThumbLike {
    name: string;
    coverImagePath?: string | null;
    updatedAt?: string | null;
    itemCount?: number | null;
    isNsfw?: boolean;
  }

  interface Props {
    collection: CollectionThumbLike;
    size?: CollectionThumbnailSize;
    aspectClass?: string;
    loading?: "eager" | "lazy";
    class?: string;
    gradientIndex?: number;
  }

  let {
    collection,
    size = "grid",
    aspectClass,
    loading = "lazy",
    class: className,
    gradientIndex = 0,
  }: Props = $props();

  const coverSrc = $derived(
    toApiUrl(collection.coverImagePath, collection.updatedAt ?? undefined),
  );
  const gradient = $derived(
    VIDEO_CARD_GRADIENTS[Math.abs(gradientIndex) % VIDEO_CARD_GRADIENTS.length] ?? "",
  );

  const aspect = $derived.by(() => {
    if (aspectClass) return aspectClass;
    switch (size) {
      case "compact":
        return "aspect-square";
      case "list":
        return "aspect-video";
      case "hero":
        return "aspect-[4/3]";
      case "grid":
      default:
        return "aspect-video";
    }
  });

  const iconSize = $derived.by(() => {
    switch (size) {
      case "compact":
        return "h-4 w-4";
      case "list":
        return "h-6 w-6";
      case "hero":
        return "h-16 w-16";
      case "grid":
      default:
        return "h-10 w-10";
    }
  });
</script>

<div class={cn("relative overflow-hidden bg-surface-1", aspect, className)}>
  <NsfwBlur isNsfw={collection.isNsfw === true} class="block h-full w-full">
    {#if coverSrc}
      <img
        src={coverSrc}
        alt={collection.name}
        {loading}
        decoding="async"
        class="absolute inset-0 h-full w-full object-cover"
      />
    {:else}
      <div class={cn(gradient, "flex h-full w-full items-center justify-center")}>
        <FolderOpen class={cn("text-white/20", iconSize)} />
      </div>
    {/if}
  </NsfwBlur>
</div>
