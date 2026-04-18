<script lang="ts">
  import { page } from "$app/stores";
  import VideoEdit from "$lib/components/VideoEdit.svelte";
  import BackLink from "$lib/components/BackLink.svelte";
  import { entityTerms } from "$lib/terminology";

  const id = $derived($page.params.id);
</script>

<svelte:head>
  <title>Edit {entityTerms.video} — Obscura</title>
</svelte:head>

<div class="space-y-5">
  <BackLink
    fallback={`/videos/${id}`}
    label={entityTerms.video}
    class="py-1.5 font-medium hover:border-border-accent w-fit"
  />
  <VideoEdit {id} />
</div>
