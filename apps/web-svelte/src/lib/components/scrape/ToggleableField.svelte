<script lang="ts">
  import { Checkbox, cn } from "@obscura/ui-svelte";

  interface Props {
    field: string;
    label: string;
    value: string;
    enabled: boolean;
    onToggle: () => void;
  }

  // `field` is part of the public prop shape callers use for semantic keys;
  // this component doesn't need to read it directly.
  let { label, value, enabled, onToggle }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class={cn(
    "col-span-2 sm:col-span-1 flex items-start gap-2 cursor-pointer transition-opacity",
    !enabled && "opacity-40",
  )}
  onclick={(e) => {
    e.stopPropagation();
    onToggle();
  }}
>
  <Checkbox
    checked={enabled}
    class="mt-0.5 flex-shrink-0"
    onchange={() => onToggle()}
    onclick={(e: MouseEvent) => e.stopPropagation()}
  />
  <div class="min-w-0">
    <span class="text-text-disabled text-[0.6rem] uppercase tracking-wider font-semibold">
      {label}
    </span>
    <p
      class={cn(
        "truncate text-[0.78rem]",
        enabled ? "text-text-primary" : "text-text-disabled line-through",
      )}
    >
      {value}
    </p>
  </div>
</div>
