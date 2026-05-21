<script lang="ts">
  import { Users } from "@lucide/svelte";
  import EntityIndexPage from "$lib/components/entities/EntityIndexPage.svelte";
</script>

<EntityIndexPage
  kind="person"
  title="Actors"
  description="Browse actors in your library"
  icon={Users}
  prefsKey="performers"
  emptyTitle="No actors"
  emptyMessage="No actors in your library yet. They will appear as you tag media with performer credits."
  errorMessage="Failed to load actors."
/>
