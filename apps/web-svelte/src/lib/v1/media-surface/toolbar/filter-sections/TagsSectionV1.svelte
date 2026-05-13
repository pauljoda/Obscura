<script lang="ts">
  import { Tag } from "@lucide/svelte";
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
    title="Tags"
    icon={Tag}
    items={items}
    searchPlaceholder="Filter tags..."
    emptyIcon={Tag}
    emptyLabel="tags"
    chipVariant="info"
    isActive={(item) =>
      panelFilters.some(
        (f) => (f.type === "tag" || f.label === "Tag") && f.value === item.name,
      )}
    onToggle={(item) => onAddFilter("tag", "Tag", item.name)}
  />
</div>
