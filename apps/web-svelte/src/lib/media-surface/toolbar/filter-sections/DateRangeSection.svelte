<script lang="ts">
  import { CalendarRange } from "@lucide/svelte";
  import FilterSection from "../FilterSection.svelte";
  import type { SectionAddFilter } from "./types.ts";

  interface Props {
    onAddFilter: SectionAddFilter;
  }

  let { onAddFilter }: Props = $props();
</script>

<FilterSection title="Date">
  {#snippet children()}
    <div class="flex flex-col gap-2">
      <label class="flex items-center gap-2 text-[0.7rem] text-text-muted">
        <CalendarRange class="h-3 w-3 shrink-0 text-text-disabled" />
        <span class="font-mono text-[0.6rem] uppercase tracking-wider">From</span>
        <input
          type="date"
          class="flex-1 min-w-0 bg-surface-1 border border-border-subtle px-2 py-1 text-[0.72rem] text-text-primary focus:outline-none focus:border-border-accent"
          onchange={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            if (v) onAddFilter("dateFrom", "Date from", v);
          }}
        />
      </label>
      <label class="flex items-center gap-2 text-[0.7rem] text-text-muted">
        <CalendarRange class="h-3 w-3 shrink-0 text-text-disabled" />
        <span class="font-mono text-[0.6rem] uppercase tracking-wider">To</span>
        <input
          type="date"
          class="flex-1 min-w-0 bg-surface-1 border border-border-subtle px-2 py-1 text-[0.72rem] text-text-primary focus:outline-none focus:border-border-accent"
          onchange={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            if (v) onAddFilter("dateTo", "Date to", v);
          }}
        />
      </label>
    </div>
  {/snippet}
</FilterSection>
