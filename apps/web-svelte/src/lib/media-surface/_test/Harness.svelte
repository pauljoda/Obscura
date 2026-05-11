<script lang="ts">
  import { provideNsfw } from "$lib/nsfw/store.svelte";
  import { providePageSnapshots } from "$lib/stores/page-snapshots.svelte";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";

  // Type-erased prop on the test boundary — callers pass a typed config
  // and we forward it to MediaSurface, which is itself fully generic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { config, initialPrefsByFormFactor }: { config: any; initialPrefsByFormFactor?: any } = $props();
  provideNsfw(() => ({ initialMode: "show", lanAutoEnable: false }));
  providePageSnapshots({
    captureScroll: () => ({ top: 0, left: 0 }),
    restoreScroll: () => {},
  });
</script>

<MediaSurface {config} {initialPrefsByFormFactor} />
