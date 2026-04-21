<script lang="ts">
  import CollectionEditor from "$lib/components/CollectionEditor.svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title>New Collection — Obscura</title>
</svelte:head>

<CollectionEditor
  isNew
  availableTags={data.availableTags}
  availablePerformers={data.availablePerformers}
  availableStudios={data.availableStudios}
/>
