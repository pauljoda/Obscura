<script lang="ts">
  import { Building2 } from "@lucide/svelte";
  import AlphabeticalFilterSection, {
    type AlphabeticalFilterSectionItem,
  } from "../AlphabeticalFilterSection.svelte";
  import type { SectionAddFilter, SectionPanelFilter } from "./types.ts";

  interface Props {
    items: AlphabeticalFilterSectionItem[];
    panelFilters: SectionPanelFilter[];
    onAddFilter: SectionAddFilter;
  }

  let { items, panelFilters, onAddFilter }: Props = $props();
</script>

<div class="md:col-span-2 xl:col-span-3">
  <AlphabeticalFilterSection
    title="Studios"
    icon={Building2}
    items={items}
    searchPlaceholder="Filter studios..."
    emptyIcon={Building2}
    emptyLabel="studios"
    chipVariant="accent"
    isActive={(item) =>
      panelFilters.some((f) => f.type === "studio" && f.value === item.id)}
    onToggle={(item) => onAddFilter("studio", "Studio", item.id)}
  />
</div>
