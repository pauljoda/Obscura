<script lang="ts">
  import type { VideoCardListItem } from "$lib/v1/api/types-v1";
  import type { CardProps } from "$lib/v1/media-surface/config-v1";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import { videoListItemToCardData } from "$lib/video-card-data";

  let {
    item,
    index,
    imageLoading,
    selected = false,
    onToggleSelect,
    layout = "grid",
  }: CardProps<VideoCardListItem> = $props();

  // Map MediaSurface CardProps onto VideoCard's existing API.
  const variant = $derived(layout === "list" ? "list" : "grid");

  function handleToggle(_id: string) {
    onToggleSelect?.();
  }
</script>

<VideoCard
  video={videoListItemToCardData(item, "/videos")}
  variant={variant}
  {index}
  {imageLoading}
  {selected}
  onToggleSelect={onToggleSelect ? handleToggle : undefined}
/>
