<script lang="ts">
  import type { CollectionItemDto } from "@obscura/contracts";
  import CollectionItemCard from "./CollectionItemCard.svelte";
  import { provideNsfw } from "$lib/nsfw/store.svelte";

  interface Props {
    item: CollectionItemDto;
  }

  let { item }: Props = $props();

  provideNsfw(() => ({ initialMode: "show", lanAutoEnable: false }));
</script>

<CollectionItemCard {item} />
