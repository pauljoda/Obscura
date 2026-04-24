<script lang="ts">
  import CollectionEditor from "$lib/components/CollectionEditor.svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title>Edit {data.collection.name} — Obscura</title>
</svelte:head>

<CollectionEditor
  collection={data.collection}
  availableTags={data.availableTags}
  availablePerformers={data.availablePerformers}
  availableStudios={data.availableStudios}
/>
