<script lang="ts">
  import { Check, Loader2 } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { NormalizedEpisodeResult } from "@obscura/contracts";
  import {
    acceptVideoEpisodeScrape,
    type AcceptFieldMask,
    type SelectedImages,
  } from "$lib/v1/api/scrapers-v1";
  import FieldMaskGrid from "./FieldMaskGridV1.svelte";
  import ImagePicker from "./ImagePickerV1.svelte";

  type FieldKey = keyof AcceptFieldMask;

  interface Props {
    result: NormalizedEpisodeResult;
    scrapeResultId: string;
    episodeId: string;
    onAccepted: () => void;
    onAcceptAndNext?: () => void;
  }

  let { result, scrapeResultId, episodeId, onAccepted, onAcceptAndNext }: Props = $props();

  const EPISODE_FIELDS: Array<{ key: FieldKey; label: string }> = [
    { key: "title", label: "Title" },
    { key: "overview", label: "Overview" },
    { key: "airDate", label: "Air date" },
    { key: "runtime", label: "Runtime" },
    { key: "cast", label: "Guest stars" },
    { key: "externalIds", label: "External IDs" },
  ];

  function allOn(fields: Array<{ key: FieldKey }>): AcceptFieldMask {
    return fields.reduce<AcceptFieldMask>((m, f) => {
      m[f.key] = true;
      return m;
    }, {});
  }

  let mask = $state<AcceptFieldMask>(allOn(EPISODE_FIELDS));
  let selectedImages = $state<SelectedImages>({});
  let busy = $state(false);
  let error = $state<string | null>(null);

  function toggleField(k: FieldKey) {
    mask = { ...mask, [k]: !mask[k] };
  }

  async function submit(andNext: boolean) {
    busy = true;
    error = null;
    try {
      await acceptVideoEpisodeScrape(episodeId, {
        scrapeResultId,
        fieldMask: mask,
        selectedImages,
      });
      if (andNext && onAcceptAndNext) onAcceptAndNext();
      else onAccepted();
    } catch (err) {
      error = err instanceof Error ? err.message : "Accept failed";
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex flex-col">
  <div class="space-y-4 p-5">
    <div class="flex flex-col md:flex-row gap-4">
      <div class="min-w-0 flex-1 space-y-2">
        <h3 class="text-lg font-semibold text-text-primary">
          {#if result.title}
            {result.title}
          {:else}
            <em>(no title)</em>
          {/if}
        </h3>
        <p class="font-mono text-[0.65rem] text-text-muted">
          {result.seasonNumber}×{String(result.episodeNumber).padStart(2, "0")}
        </p>
        {#if result.airDate}
          <p class="text-[0.7rem] text-text-muted">
            Aired: {result.airDate}{#if result.runtime} · {result.runtime}min{/if}
          </p>
        {/if}
        {#if result.overview}
          <p class="text-[0.72rem] text-text-muted line-clamp-5">{result.overview}</p>
        {/if}
      </div>
      <ImagePicker
        label="Still"
        aspect="still"
        candidates={result.stillCandidates}
        value={selectedImages.still ?? undefined}
        onSelect={(url) => (selectedImages = { ...selectedImages, still: url ?? undefined })}
        class="w-36"
      />
    </div>
    <FieldMaskGrid fields={EPISODE_FIELDS} {mask} onToggle={toggleField} />
  </div>
  <div
    class="sticky bottom-0 z-20 flex items-center justify-end gap-3 border-t border-border-subtle bg-bg px-5 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.3)]"
  >
    {#if error}
      <p class="flex-1 text-[0.68rem] text-status-error-text text-right mr-2">{error}</p>
    {/if}
    <div class="flex items-center gap-2">
      {#if onAcceptAndNext}
        <button
          type="button"
          onclick={() => void submit(false)}
          disabled={busy}
          class={cn(
            "px-4 py-1.5 text-[0.72rem] font-medium text-text-muted hover:text-text-primary transition-colors",
            busy && "opacity-50 cursor-not-allowed",
          )}
        >
          Apply
        </button>
      {/if}
      <button
        type="button"
        onclick={() => void submit(!!onAcceptAndNext)}
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
            <Check class="h-3 w-3" />
            {onAcceptAndNext ? "Apply & next" : "Apply"}
          </span>
        {/if}
      </button>
    </div>
  </div>
</div>
