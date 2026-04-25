<script lang="ts" generics="T extends { id: string; title?: string }">
  import type { CardProps } from "$lib/media-surface/config";

  let {
    item,
    index,
  }: CardProps<T> = $props();
</script>

<article data-card-index={index} data-card-id={item.id}>
  {item.title ?? item.id}
</article>
