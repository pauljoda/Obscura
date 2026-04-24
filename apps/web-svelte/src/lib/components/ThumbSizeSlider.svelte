<script lang="ts">
  import { Grid2x2, Grid3x3 } from "@lucide/svelte";

  interface Props {
    /** Current column count. */
    value: number;
    /** Minimum columns (most zoomed in). */
    min?: number;
    /** Maximum columns (most zoomed out). */
    max?: number;
    onChange: (next: number) => void;
    label?: string;
  }

  let { value, min = 2, max = 12, onChange, label = "Size" }: Props = $props();
</script>

<label
  class="flex items-center gap-1.5 px-2 py-1.5 text-[0.72rem] text-text-muted"
  title="Drag to change thumbnail size"
>
  <Grid2x2 class="h-3.5 w-3.5 shrink-0 text-text-disabled" />
  <span class="sr-only">{label}</span>
  <input
    type="range"
    aria-label={label}
    {min}
    {max}
    step="1"
    bind:value={
      () => value,
      (v: number) => onChange(v)
    }
    class="thumb-size-range cursor-pointer w-20 sm:w-24"
  />
  <Grid3x3 class="h-3 w-3 shrink-0 text-text-disabled rotate-180" />
</label>

<style>
  /* Thin, brass-accent-on-track range input matching design tokens. */
  .thumb-size-range {
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    height: 14px;
  }
  .thumb-size-range::-webkit-slider-runnable-track {
    height: 2px;
    background: var(--color-border-subtle, rgba(255, 255, 255, 0.08));
  }
  .thumb-size-range::-moz-range-track {
    height: 2px;
    background: var(--color-border-subtle, rgba(255, 255, 255, 0.08));
  }
  .thumb-size-range::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 10px;
    height: 10px;
    background: var(--color-accent-500, #c49a5a);
    border: 1px solid var(--color-accent-500, #c49a5a);
    box-shadow: 0 0 6px rgba(196, 154, 90, 0.35);
    margin-top: -4px;
    cursor: grab;
  }
  .thumb-size-range::-moz-range-thumb {
    width: 10px;
    height: 10px;
    background: var(--color-accent-500, #c49a5a);
    border: 1px solid var(--color-accent-500, #c49a5a);
    box-shadow: 0 0 6px rgba(196, 154, 90, 0.35);
    cursor: grab;
  }
  .thumb-size-range:active::-webkit-slider-thumb {
    cursor: grabbing;
  }
  .thumb-size-range:active::-moz-range-thumb {
    cursor: grabbing;
  }
</style>
