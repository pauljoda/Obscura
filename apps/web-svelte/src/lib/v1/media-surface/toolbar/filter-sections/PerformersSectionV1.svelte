<script lang="ts">
  import { Users } from "@lucide/svelte";
  import AlphabeticalFilterSection, {
    type AlphabeticalFilterSectionItem,
  } from "../AlphabeticalFilterSectionV1.svelte";
  import type { SectionAddFilter, SectionPanelFilter } from "./types-v1.ts";

  interface Props {
    items: AlphabeticalFilterSectionItem[];
    panelFilters: SectionPanelFilter[];
    onAddFilter: SectionAddFilter;
  }

  let { items, panelFilters, onAddFilter }: Props = $props();
</script>

<div class="md:col-span-2 xl:col-span-3">
  <AlphabeticalFilterSection
    title="Performers"
    icon={Users}
    items={items}
    searchPlaceholder="Filter performers..."
    emptyIcon={Users}
    emptyLabel="performers"
    chipVariant="info"
    isActive={(item) =>
      panelFilters.some((f) => f.type === "performer" && f.value === item.name)}
    onToggle={(item) => onAddFilter("performer", "Performer", item.name)}
  />
</div>
