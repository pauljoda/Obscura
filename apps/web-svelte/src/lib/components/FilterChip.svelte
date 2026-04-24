<script lang="ts">
  import { X } from "@lucide/svelte";

  interface Props {
    label: string;
    value: string;
    onRemove?: () => void;
  }

  let { label, value, onRemove }: Props = $props();
</script>

<span class="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap">
  <span class="text-accent-400/70">{label}:</span>
  <span class="text-accent-200">{value}</span>
  {#if onRemove}
    <button
      type="button"
      onclick={onRemove}
      class="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
      aria-label={`Remove ${label}: ${value}`}
    >
      <X class="h-2.5 w-2.5" />
    </button>
  {/if}
</span>
