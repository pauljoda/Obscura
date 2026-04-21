<script lang="ts">
  import { Check, Loader2 } from "@lucide/svelte";
  import { Checkbox, cn } from "@obscura/ui-svelte";
  import type { GalleryRow, GalleryField } from "$lib/identify/identify-types";
  import { entityTerms } from "$lib/terminology";
  import ReviewDrawer from "./ReviewDrawer.svelte";
  import ToggleableField from "../scrape/ToggleableField.svelte";

  interface Props {
    row: GalleryRow;
    onClose: () => void;
    onToggleField: (field: GalleryField) => void;
    onAccept: () => Promise<void> | void;
    onNext?: () => void;
    onPrev?: () => void;
    hasNext?: boolean;
    hasPrev?: boolean;
    onAcceptAndNext?: () => Promise<void> | void;
  }

  let {
    row,
    onClose,
    onToggleField,
    onAccept,
    onNext,
    onPrev,
    hasNext,
    hasPrev,
    onAcceptAndNext,
  }: Props = $props();

  let busy = $state(false);

  async function doAccept() {
    busy = true;
    try {
      await onAccept();
    } finally {
      busy = false;
    }
  }

  async function doAcceptNext() {
    busy = true;
    try {
      if (onAcceptAndNext) await onAcceptAndNext();
      else await onAccept();
    } finally {
      busy = false;
    }
  }
</script>

<ReviewDrawer label={row.gallery.title} {onClose} {onNext} {onPrev} {hasNext} {hasPrev}>
  {#snippet footer()}
    <div class="flex items-center justify-end gap-3">
      {#if onAcceptAndNext}
        <button
          type="button"
          onclick={() => void doAccept()}
          disabled={busy}
          class={cn(
            "px-4 py-1.5 text-[0.72rem] font-medium text-text-muted hover:text-text-primary transition-colors",
            busy && "opacity-50 cursor-not-allowed",
          )}
        >
          Accept
        </button>
      {/if}
      <button
        type="button"
        onclick={() => void doAcceptNext()}
        disabled={busy}
        class={cn(
          "surface-card px-4 py-1.5 text-[0.72rem] font-medium hover:border-border-accent",
          busy && "opacity-50 cursor-not-allowed",
        )}
      >
        {#if busy}
          <span class="flex items-center gap-1.5">
            <Loader2 class="h-3 w-3 animate-spin" /> Applying…
          </span>
        {:else}
          <span class="flex items-center gap-1.5">
            <Check class="h-3 w-3" /> {onAcceptAndNext ? "Accept & next" : "Accept"}
          </span>
        {/if}
      </button>
    </div>
  {/snippet}
  {#snippet children()}
    <div class="p-5 space-y-4">
      {#if row.result}
        {@const r = row.result}
        <div class="flex flex-col md:flex-row gap-4">
          {#if r.imageUrl}
            <img src={r.imageUrl} alt="" class="w-32 h-24 object-cover border border-border-subtle flex-shrink-0" />
          {/if}
          <div class="flex-1 min-w-0 space-y-3">
            <div class="grid grid-cols-2 gap-x-4 gap-y-2">
              {#if r.title}
                <ToggleableField field="title" label="Title" value={r.title} enabled={row.selectedFields.has("title")} onToggle={() => onToggleField("title")} />
              {/if}
              {#if r.date}
                <ToggleableField field="date" label="Date" value={r.date} enabled={row.selectedFields.has("date")} onToggle={() => onToggleField("date")} />
              {/if}
              {#if r.studioName}
                <ToggleableField field="studio" label="Studio" value={r.studioName} enabled={row.selectedFields.has("studio")} onToggle={() => onToggleField("studio")} />
              {/if}
            </div>
            {#if r.performerNames.length > 0}
              <div class={cn("transition-opacity", !row.selectedFields.has("performers") && "opacity-40")}>
                <div class="flex items-center gap-2 mb-1.5">
                  <Checkbox
                    checked={row.selectedFields.has("performers")}
                    onchange={() => onToggleField("performers")}
                  />
                  <span class="text-kicker">{entityTerms.performers}</span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  {#each r.performerNames as name (name)}
                    <span class="tag-chip tag-chip-accent">{name}</span>
                  {/each}
                </div>
              </div>
            {/if}
            {#if r.tagNames.length > 0}
              <div class={cn("transition-opacity", !row.selectedFields.has("tags") && "opacity-40")}>
                <div class="flex items-center gap-2 mb-1.5">
                  <Checkbox
                    checked={row.selectedFields.has("tags")}
                    onchange={() => onToggleField("tags")}
                  />
                  <span class="text-kicker">Tags</span>
                </div>
                <div class="flex flex-wrap gap-1">
                  {#each r.tagNames as name (name)}
                    <span class="tag-chip tag-chip-default">{name}</span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/snippet}
</ReviewDrawer>
