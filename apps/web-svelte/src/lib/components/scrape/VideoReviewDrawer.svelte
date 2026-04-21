<script lang="ts">
  import { Check, X, Loader2 } from "@lucide/svelte";
  import { Checkbox, cn } from "@obscura/ui-svelte";
  import type { VideoRow, VideoField } from "$lib/identify/scrape-types";
  import { entityTerms } from "$lib/terminology";
  import ReviewDrawer from "../identify/ReviewDrawer.svelte";
  import ToggleableField from "./ToggleableField.svelte";

  interface Props {
    row: VideoRow;
    onClose: () => void;
    onToggleField: (field: VideoField) => void;
    onTogglePerformer: (name: string) => void;
    onToggleTag: (name: string) => void;
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
    onTogglePerformer,
    onToggleTag,
    onAccept,
    onNext,
    onPrev,
    hasNext,
    hasPrev,
    onAcceptAndNext,
  }: Props = $props();

  let busy = $state(false);

  async function handleAccept() {
    busy = true;
    try {
      await onAccept();
    } finally {
      busy = false;
    }
  }

  async function handleAcceptAndNext() {
    busy = true;
    try {
      if (onAcceptAndNext) await onAcceptAndNext();
      else await onAccept();
    } finally {
      busy = false;
    }
  }
</script>

<ReviewDrawer
  label={row.video.title}
  {onClose}
  {onNext}
  {onPrev}
  {hasNext}
  {hasPrev}
>
  {#snippet footer()}
    <div class="flex items-center justify-end gap-3">
      {#if onAcceptAndNext}
        <button
          type="button"
          onclick={() => void handleAccept()}
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
        onclick={() => void handleAcceptAndNext()}
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
      {#if row.normalized}
        {@const n = row.normalized}
        <div class="flex flex-col md:flex-row gap-4">
          {#if n.imageUrl}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class={cn(
                "flex-shrink-0 cursor-pointer transition-opacity",
                !row.selectedFields.has("image") && "opacity-40",
              )}
              onclick={(e) => {
                e.stopPropagation();
                onToggleField("image");
              }}
            >
              <div class="relative">
                <img
                  src={n.imageUrl}
                  alt=""
                  class={cn(
                    "w-48 h-32 object-cover border transition-all",
                    row.selectedFields.has("image")
                      ? "border-border-accent/40"
                      : "border-border-subtle grayscale",
                  )}
                />
                <div class="absolute top-1 left-1">
                  <Checkbox
                    checked={row.selectedFields.has("image")}
                    onchange={() => onToggleField("image")}
                    onclick={(e: MouseEvent) => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>
          {/if}

          <div class="flex-1 min-w-0 space-y-3">
            <div class="grid grid-cols-2 gap-x-4 gap-y-2">
              {#if n.title}
                <ToggleableField
                  field="title"
                  label="Title"
                  value={n.title}
                  enabled={row.selectedFields.has("title")}
                  onToggle={() => onToggleField("title")}
                />
              {/if}
              {#if n.date}
                <ToggleableField
                  field="date"
                  label="Date"
                  value={n.date}
                  enabled={row.selectedFields.has("date")}
                  onToggle={() => onToggleField("date")}
                />
              {/if}
              {#if n.studioName}
                <ToggleableField
                  field="studio"
                  label="Studio"
                  value={n.studioName}
                  enabled={row.selectedFields.has("studio")}
                  onToggle={() => onToggleField("studio")}
                />
              {/if}
              {#if n.url}
                <ToggleableField
                  field="url"
                  label="URL"
                  value={n.url}
                  enabled={row.selectedFields.has("url")}
                  onToggle={() => onToggleField("url")}
                />
              {/if}
            </div>

            {#if n.performerNames.length > 0}
              <div
                class={cn("transition-opacity", !row.selectedFields.has("performers") && "opacity-40")}
              >
                <div class="flex items-center gap-2 mb-1.5">
                  <Checkbox
                    checked={row.selectedFields.has("performers")}
                    onchange={() => onToggleField("performers")}
                    onclick={(e: MouseEvent) => e.stopPropagation()}
                  />
                  <span class="text-kicker">{entityTerms.performers}</span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  {#each n.performerNames as name (name)}
                    {@const excluded = row.excludedPerformers.has(name)}
                    <span
                      class={cn(
                        "inline-flex items-center gap-1 tag-chip transition-all",
                        excluded ? "tag-chip-default opacity-40 line-through" : "tag-chip-accent",
                      )}
                    >
                      {name}
                      <button
                        type="button"
                        onclick={(e) => {
                          e.stopPropagation();
                          onTogglePerformer(name);
                        }}
                        class="hover:text-status-error-text transition-colors"
                        aria-label={`Toggle ${name}`}
                      >
                        <X class="h-2.5 w-2.5" />
                      </button>
                    </span>
                  {/each}
                </div>
              </div>
            {/if}

            {#if n.tagNames.length > 0}
              <div
                class={cn("transition-opacity", !row.selectedFields.has("tags") && "opacity-40")}
              >
                <div class="flex items-center gap-2 mb-1.5">
                  <Checkbox
                    checked={row.selectedFields.has("tags")}
                    onchange={() => onToggleField("tags")}
                    onclick={(e: MouseEvent) => e.stopPropagation()}
                  />
                  <span class="text-kicker">Tags</span>
                </div>
                <div class="flex flex-wrap gap-1">
                  {#each n.tagNames as name (name)}
                    {@const excluded = row.excludedTags.has(name)}
                    <span
                      class={cn(
                        "inline-flex items-center gap-1 tag-chip transition-all",
                        excluded ? "tag-chip-default opacity-40 line-through" : "tag-chip-default",
                      )}
                    >
                      {name}
                      <button
                        type="button"
                        onclick={(e) => {
                          e.stopPropagation();
                          onToggleTag(name);
                        }}
                        class="hover:text-status-error-text transition-colors"
                        aria-label={`Toggle ${name}`}
                      >
                        <X class="h-2.5 w-2.5" />
                      </button>
                    </span>
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
