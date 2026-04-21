<script lang="ts">
  /**
   * Condensed first-pass port of the React CascadeReviewDrawer.
   *
   * The React version (1,455 lines) shows a full cascade editor: series
   * header with poster / backdrop pickers, disambiguation candidates,
   * per-season poster pickers, and per-episode field masks. This Svelte
   * port keeps the core accept flow functional end-to-end while the
   * per-season / per-episode editors come in a follow-up pass. On open
   * it fetches the scrape result, renders the series / movie / episode
   * fields with per-field toggles, and submits a `CascadeAcceptSpec`
   * via the appropriate accept endpoint.
   */
  import { onMount } from "svelte";
  import { AlertCircle, Check, Loader2 } from "@lucide/svelte";
  import { Checkbox, cn } from "@obscura/ui-svelte";
  import {
    fetchScrapeResult,
    acceptVideoSeriesScrape,
    acceptVideoMovieScrape,
    acceptVideoEpisodeScrape,
    type AcceptFieldMask,
    type CascadeAcceptSpec,
  } from "$lib/api/scrapers";
  import type { ScrapeResult } from "$lib/api/types";
  import ReviewDrawer from "./ReviewDrawer.svelte";

  interface Props {
    scrapeResultId: string;
    entityKind: "video_series" | "video_movie" | "video_episode";
    entityId: string;
    label: string;
    onAccepted: () => void;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    hasNext?: boolean;
    hasPrev?: boolean;
    onAcceptAndNext?: () => void;
  }

  let {
    scrapeResultId,
    entityKind,
    entityId,
    label,
    onAccepted,
    onClose,
    onNext,
    onPrev,
    hasNext,
    hasPrev,
    onAcceptAndNext,
  }: Props = $props();

  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let result = $state<ScrapeResult | null>(null);
  let acceptError = $state<string | null>(null);
  let busy = $state(false);

  /**
   * Keys we surface in the drawer. Mask keys match the `AcceptFieldMask`
   * shape; the `proposedResult` lookup keys mirror the React drawer's
   * per-field selector (series payloads use `studioName`/`tagNames`
   * while the mask keys stay in the React contract's vocabulary).
   */
  const FIELD_KEYS: Array<{
    mask: keyof AcceptFieldMask;
    propKey: string;
    label: string;
  }> = [
    { mask: "title", propKey: "title", label: "Title" },
    { mask: "releaseDate", propKey: "date", label: "Date" },
    { mask: "overview", propKey: "details", label: "Details" },
    { mask: "externalIds", propKey: "urls", label: "URLs" },
    { mask: "studio", propKey: "studioName", label: "Studio" },
    { mask: "genres", propKey: "tagNames", label: "Tags" },
  ];
  let fieldMask = $state<Record<string, boolean>>(
    Object.fromEntries(FIELD_KEYS.map(({ mask }) => [mask, true])),
  );

  onMount(() => {
    void load();
  });

  async function load() {
    loading = true;
    loadError = null;
    try {
      result = await fetchScrapeResult(scrapeResultId);
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Failed to load";
    } finally {
      loading = false;
    }
  }

  function buildMask(): AcceptFieldMask {
    return Object.fromEntries(
      FIELD_KEYS.filter(({ mask }) => fieldMask[mask]).map(({ mask }) => [mask, true]),
    ) as AcceptFieldMask;
  }

  function buildSeriesCascade(): CascadeAcceptSpec {
    // Placeholder — the full per-season / per-episode tree is built in
    // the React drawer. The first-pass port defaults to "accept all
    // seasons" once the user clicks Accept.
    return { acceptAllSeasons: true };
  }

  async function submit(accept: () => Promise<unknown>, next: boolean) {
    busy = true;
    acceptError = null;
    try {
      await accept();
      if (next && onAcceptAndNext) onAcceptAndNext();
      else onAccepted();
    } catch (err) {
      acceptError = err instanceof Error ? err.message : "Accept failed";
    } finally {
      busy = false;
    }
  }

  function acceptByKind() {
    const fieldMaskBody = buildMask();
    switch (entityKind) {
      case "video_series":
        return acceptVideoSeriesScrape(entityId, {
          scrapeResultId,
          fieldMask: fieldMaskBody,
          cascade: buildSeriesCascade(),
        });
      case "video_movie":
        return acceptVideoMovieScrape(entityId, {
          scrapeResultId,
          fieldMask: fieldMaskBody,
        });
      case "video_episode":
        return acceptVideoEpisodeScrape(entityId, {
          scrapeResultId,
          fieldMask: fieldMaskBody,
        });
    }
  }

  function toggleField(key: string) {
    fieldMask = { ...fieldMask, [key]: !fieldMask[key] };
  }

  const proposed = $derived(
    result?.proposedResult as Record<string, unknown> | undefined,
  );
</script>

<ReviewDrawer
  {label}
  {onClose}
  {onNext}
  {onPrev}
  {hasNext}
  {hasPrev}
  {loading}
  error={loadError}
>
  {#snippet footer()}
    <div class="flex items-center justify-end gap-3">
      {#if acceptError}
        <span class="text-[0.7rem] text-status-error-text flex items-center gap-1.5">
          <AlertCircle class="h-3 w-3" />
          {acceptError}
        </span>
      {/if}
      {#if onAcceptAndNext}
        <button
          type="button"
          onclick={() => void submit(acceptByKind, false)}
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
        onclick={() => void submit(acceptByKind, !!onAcceptAndNext)}
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
    {#if proposed}
      <div class="p-5 space-y-4">
        <div class="surface-well p-4 space-y-3">
          <h3 class="text-label text-text-muted">Proposed fields</h3>
          <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-[0.8rem]">
            {#each FIELD_KEYS as field (field.mask)}
              {@const value = proposed[field.propKey] ?? null}
              {#if value}
                <label class="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={!!fieldMask[field.mask]}
                    onchange={() => toggleField(field.mask)}
                  />
                  <div class="min-w-0">
                    <div class="text-text-disabled text-[0.6rem] uppercase tracking-wider font-semibold">
                      {field.label}
                    </div>
                    <div class="truncate text-text-primary">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </div>
                  </div>
                </label>
              {/if}
            {/each}
          </div>
        </div>

        {#if proposed.seasons || proposed.episodes}
          <div class="surface-well p-4 text-[0.72rem] text-text-muted">
            Cascade accept applies the selected top-level fields plus every
            matched season and episode. Per-season and per-episode picker
            UI is tracked as a follow-up port — see the React
            `CascadeReviewDrawer` for the full shape.
          </div>
        {/if}
      </div>
    {:else if !loading}
      <div class="m-5 flex items-center gap-2 border border-border-subtle bg-surface-2 px-3 py-2 text-[0.72rem] text-text-muted">
        <AlertCircle class="h-4 w-4 flex-shrink-0" />
        No proposed payload to review.
      </div>
    {/if}
  {/snippet}
</ReviewDrawer>
