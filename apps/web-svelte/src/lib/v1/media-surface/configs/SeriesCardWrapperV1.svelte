<script lang="ts">
  import type { VideoSeriesListItemDto } from "@obscura/contracts";
  import type { CardProps } from "$lib/v1/media-surface/config-v1";
  import SeriesCard from "$lib/components/SeriesCard.svelte";

  let { item, layout = "grid" }: CardProps<VideoSeriesListItemDto> = $props();
</script>

<SeriesCard
  series={item}
  href={`/series?series=${item.id}`}
  compact={layout !== "list"}
/>
