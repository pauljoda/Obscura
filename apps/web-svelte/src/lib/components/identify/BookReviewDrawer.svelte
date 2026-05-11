<script lang="ts">
  import { Check, Loader2 } from "@lucide/svelte";
  import type { BookChapterDto, ImageCandidate } from "@obscura/contracts";
  import { Checkbox, cn } from "@obscura/ui-svelte";
  import { fetchBookDetail } from "$lib/api/media";
  import { executePlugin, fetchScrapeResult } from "$lib/api/scrapers";
  import type {
    BookField,
    BookRow,
    NormalizedBookCandidate,
    NormalizedBookIdentifyResult,
  } from "$lib/identify/identify-types";
  import { bookResult } from "$lib/identify/book-runner";
  import { entityTerms } from "$lib/terminology";
  import ReviewDrawer from "./ReviewDrawer.svelte";
  import ToggleableField from "../scrape/ToggleableField.svelte";
  import CandidatePicker from "./CandidatePicker.svelte";
  import ImagePicker from "./ImagePicker.svelte";

  type BookSelectedImages = Record<string, string | null | undefined>;

  interface Props {
    row: BookRow;
    onClose: () => void;
    onToggleField: (field: BookField) => void;
    onAccept: (selectedImages?: BookSelectedImages) => Promise<void> | void;
    onNext?: () => void;
    onPrev?: () => void;
    hasNext?: boolean;
    hasPrev?: boolean;
    onAcceptAndNext?: (selectedImages?: BookSelectedImages) => Promise<void> | void;
    onCandidateResult?: (result: NormalizedBookIdentifyResult, scrapeResultId: string) => void;
    includeNsfw?: boolean;
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
    onCandidateResult,
    includeNsfw = false,
  }: Props = $props();

  let busy = $state(false);
  let rerunning = $state(false);
  let rerunError = $state<string | null>(null);
  let pickedCandidate = $state<string | null>(null);
  let selectedImages = $state<BookSelectedImages>({});
  let chapters = $state<BookChapterDto[]>([]);
  let chaptersLoading = $state(false);
  let chapterError = $state<string | null>(null);

  function fallbackImageCandidate(url: string | null | undefined, source: string): ImageCandidate[] {
    return url ? [{ url, source }] : [];
  }

  function bookCoverCandidates(r: NormalizedBookIdentifyResult): ImageCandidate[] {
    return r.imageCandidates?.length
      ? r.imageCandidates
      : fallbackImageCandidate(r.imageUrl, "plugin");
  }

  function chapterCoverCandidates(r: NormalizedBookIdentifyResult): ImageCandidate[] {
    if (r.chapterImageCandidates?.length) return r.chapterImageCandidates;
    if (r.imageCandidates?.length) return r.imageCandidates;
    return fallbackImageCandidate(r.chapterImageUrl ?? r.imageUrl, "plugin");
  }

  function exactChapterCandidate(
    r: NormalizedBookIdentifyResult,
    chapter: BookChapterDto,
  ): ImageCandidate | null {
    return r.chapterImageByNumber?.[String(chapter.chapterNumber)] ?? null;
  }

  function chapterCandidatesFor(
    r: NormalizedBookIdentifyResult,
    chapter: BookChapterDto,
  ): ImageCandidate[] {
    const exact = exactChapterCandidate(r, chapter);
    const candidates = chapterCoverCandidates(r);
    if (!exact) return candidates;
    return [
      exact,
      ...candidates.filter((candidate) => candidate.url !== exact.url),
    ];
  }

  function chapterImageKey(chapterId: string): string {
    return `chapterCover:${chapterId}`;
  }

  function setChapterCover(chapterId: string, url: string | null) {
    const key = chapterImageKey(chapterId);
    selectedImages = { ...selectedImages, [key]: url };
  }

  $effect(() => {
    const bookId = row.book.id;
    let cancelled = false;
    chaptersLoading = true;
    chapterError = null;

    void fetchBookDetail(bookId, { nsfw: includeNsfw ? "show" : "off" })
      .then((detail) => {
        if (!cancelled) chapters = detail.chapters;
      })
      .catch((err) => {
        if (!cancelled) {
          chapters = [];
          chapterError = err instanceof Error ? err.message : "Failed to load chapters";
        }
      })
      .finally(() => {
        if (!cancelled) chaptersLoading = false;
      });

    return () => {
      cancelled = true;
    };
  });

  function candidateId(c: NormalizedBookCandidate): string {
    return [c.externalIds.mangadex, c.externalIds.mangadexChapter, c.externalIds.language]
      .filter(Boolean)
      .join(":");
  }

  function currentCandidateId(): string | null {
    const ids = row.result?.externalIds;
    if (!ids?.mangadex) return null;
    return [ids.mangadex, ids.mangadexChapter, ids.language].filter(Boolean).join(":");
  }

  async function pickCandidate(id: string) {
    const candidate = row.result?.candidates?.find((c) => candidateId(c) === id);
    if (!candidate || !row.scrapeResultId) return;
    rerunning = true;
    rerunError = null;
    pickedCandidate = id;
    try {
      const scrapeRow = await fetchScrapeResult(row.scrapeResultId);
      if (!scrapeRow.pluginPackageId) {
        throw new Error("Cannot re-run because the scrape row has no plugin reference.");
      }
      const res = await executePlugin(
        scrapeRow.pluginPackageId,
        "bookByFragment",
        {
          title: row.book.title,
          name: row.book.title,
          includeNsfw,
          externalIds: candidate.externalIds,
        },
        { saveResult: true, entityId: row.book.id },
      );
      if (!res.ok || !res.result || !res.normalized) {
        throw new Error("Plugin returned no result for the picked candidate.");
      }
      const saved = res.result as Record<string, unknown>;
      const rawResult = (saved.rawResult as Record<string, unknown>) ?? {};
      const next = bookResult(rawResult, res.normalized);
      const nextId = typeof saved.id === "string" ? saved.id : null;
      if (!nextId) throw new Error("Plugin did not persist a scrape result.");
      onCandidateResult?.(next, nextId);
    } catch (err) {
      rerunError = err instanceof Error ? err.message : "Re-run failed";
    } finally {
      rerunning = false;
    }
  }

  async function doAccept() {
    busy = true;
    try {
      await onAccept(selectedImagesForAccept());
    } finally {
      busy = false;
    }
  }

  async function doAcceptNext() {
    busy = true;
    try {
      if (onAcceptAndNext) await onAcceptAndNext(selectedImagesForAccept());
      else await onAccept(selectedImagesForAccept());
    } finally {
      busy = false;
    }
  }

  function selectedImagesForAccept(): BookSelectedImages {
    const next: BookSelectedImages = { ...selectedImages };
    const result = row.result;
    if (!result) return next;
    for (const chapter of chapters) {
      const key = chapterImageKey(chapter.id);
      if (Object.prototype.hasOwnProperty.call(next, key)) continue;
      const exact = exactChapterCandidate(result, chapter);
      if (exact) next[key] = exact.url;
    }
    return next;
  }
</script>

<ReviewDrawer
  label={row.book.title}
  {onClose}
  {onNext}
  {onPrev}
  {hasNext}
  {hasPrev}
  error={rerunError}
>
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
            <Loader2 class="h-3 w-3 animate-spin" /> Applying...
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
        {#if r.candidates && r.candidates.length > 0}
          <div class="-mx-5 -mt-5">
            <CandidatePicker
              candidates={r.candidates}
              picked={pickedCandidate ?? currentCandidateId()}
              {rerunning}
              onPick={(id) => void pickCandidate(id)}
            />
          </div>
        {/if}
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex flex-row gap-3 md:w-32 md:flex-col">
            <ImagePicker
              label="Book cover"
              aspect="poster"
              candidates={bookCoverCandidates(r)}
              value={selectedImages.cover}
              onSelect={(url) => (selectedImages = { ...selectedImages, cover: url })}
              class="w-28 md:w-32"
            />
          </div>
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
              {#if r.urls.length > 0}
                <ToggleableField field="url" label="URL" value={r.urls[0]} enabled={row.selectedFields.has("url")} onToggle={() => onToggleField("url")} />
              {/if}
            </div>
            {#if r.details}
              <div class={cn("transition-opacity", !row.selectedFields.has("details") && "opacity-40")}>
                <div class="flex items-center gap-2 mb-1.5">
                  <Checkbox
                    checked={row.selectedFields.has("details")}
                    onchange={() => onToggleField("details")}
                  />
                  <span class="text-kicker">Description</span>
                </div>
                <p class="max-w-3xl whitespace-pre-wrap text-[0.72rem] leading-5 text-text-muted">
                  {r.details}
                </p>
              </div>
            {/if}
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
        {#if chapterCoverCandidates(r).length > 0}
          <div class="border-t border-border-subtle pt-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <span class="text-kicker">Chapter covers</span>
              {#if chaptersLoading}
                <span class="flex items-center gap-1.5 text-[0.62rem] text-text-muted">
                  <Loader2 class="h-3 w-3 animate-spin" /> loading chapters...
                </span>
              {/if}
            </div>
            {#if chapterError}
              <p class="text-[0.68rem] text-status-error-text">{chapterError}</p>
            {:else if chapters.length > 0}
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {#each chapters as chapter (chapter.id)}
                  <div class="space-y-1">
                    <ImagePicker
                      label={`Ch. ${chapter.chapterNumber}`}
                      aspect="poster"
                      candidates={chapterCandidatesFor(r, chapter)}
                      value={
                        Object.prototype.hasOwnProperty.call(
                          selectedImages,
                          chapterImageKey(chapter.id),
                        )
                          ? selectedImages[chapterImageKey(chapter.id)]
                          : (exactChapterCandidate(r, chapter)?.url ?? null)
                      }
                      onSelect={(url) => setChapterCover(chapter.id, url)}
                    />
                    <p class="truncate text-[0.62rem] text-text-muted" title={chapter.title}>
                      {chapter.title}
                    </p>
                  </div>
                {/each}
              </div>
            {:else if !chaptersLoading}
              <p class="text-[0.68rem] text-text-muted">
                No local chapters were available for per-chapter cover selection.
              </p>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  {/snippet}
</ReviewDrawer>
