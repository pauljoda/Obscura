<script lang="ts">
  import { cn } from "@obscura/ui-svelte";
  import type { ViewModeSpec } from "$lib/v1/media-surface/config-v1";

  interface Props {
    value: string;
    modes: ViewModeSpec[];
    onChange: (mode: string) => void;
  }

  let { value, modes, onChange }: Props = $props();
</script>

<div class="flex items-center border border-border-subtle overflow-hidden">
  {#each modes as m (m.mode)}
    <button
      type="button"
      title={m.label}
      aria-label={m.label}
      aria-pressed={value === m.mode}
      onclick={() => onChange(m.mode)}
      class={cn(
        "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
        value === m.mode
          ? "text-text-accent bg-accent-950"
          : "text-text-muted hover:text-text-primary hover:bg-surface-2",
      )}
    >
      <m.icon class="h-3.5 w-3.5" />
    </button>
  {/each}
</div>
