<script lang="ts">
  import { provideNsfw } from "$lib/nsfw/store.svelte";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";

  // Type-erased prop on the test boundary — callers pass a typed config
  // and we forward it to MediaSurface, which is itself fully generic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { config }: { config: any } = $props();
  provideNsfw(() => ({ initialMode: "show", lanAutoEnable: false }));
</script>

<MediaSurface {config} />
