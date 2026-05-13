<script lang="ts">
  import type { AcceptFieldMask } from "$lib/v1/api/scrapers-v1";
  import { Checkbox, cn } from "@obscura/ui-svelte";

  type FieldKey = keyof AcceptFieldMask;

  interface Props {
    fields: Array<{ key: FieldKey; label: string }>;
    mask: AcceptFieldMask;
    onToggle: (key: FieldKey) => void;
    compact?: boolean;
  }

  let { fields, mask, onToggle, compact = false }: Props = $props();
</script>

<div
  class={cn(
    "grid gap-1.5",
    compact
      ? "grid-cols-2 sm:grid-cols-3"
      : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
  )}
>
  {#each fields as field (field.key)}
    <label class="flex items-center gap-1.5 text-[0.65rem] text-text-muted cursor-pointer">
      <Checkbox
        checked={!!mask[field.key]}
        onchange={() => onToggle(field.key)}
      />
      <span>{field.label}</span>
    </label>
  {/each}
</div>
