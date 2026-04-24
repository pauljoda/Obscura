<script lang="ts">
  import type { ImageListItemDto } from "@obscura/contracts";
  import ImageLightbox from "./ImageLightbox.svelte";
  import { provideNsfw } from "$lib/stores/nsfw.svelte";

  interface Props {
    images: ImageListItemDto[];
    initialIndex: number;
    onClose: () => void;
    autoAdvanceSeconds?: number;
    onAutoAdvance?: () => void;
  }

  let {
    images,
    initialIndex,
    onClose,
    autoAdvanceSeconds,
    onAutoAdvance,
  }: Props = $props();

  provideNsfw(() => ({ initialMode: "show", lanAutoEnable: false }));
</script>

<ImageLightbox
  {images}
  {initialIndex}
  {onClose}
  {autoAdvanceSeconds}
  {onAutoAdvance}
/>
