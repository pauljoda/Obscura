<script lang="ts">
  import { Check, ChevronDown, Loader2 } from "@lucide/svelte";
  import type { BookChapterDto, BookVolumeDto, ImageCandidate } from "@obscura/contracts";
  import { Checkbox, cn } from "@obscura/ui-svelte";
  import { fetchBookDetail } from "$lib/v1/api/media-v1";
  import { executePlugin, fetchScrapeResult } from "$lib/v1/api/scrapers-v1";
  import type {
    BookField,
    BookRow,
    NormalizedBookCandidate,
    NormalizedBookIdentifyResult,
  } from "$lib/identify/identify-types";
  import { bookResult } from "$lib/identify/book-runner";
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
  let volumeStates = $state<Record<string, { accepted: boolean; expanded: boolean }>>({});
  let chapterTitleEnabled = $state<Record<string, boolean>>({});
  let chapterTitleValues = $state<Record<string, string>>({});
  let chapters = $state<BookChapterDto[]>([]);
  let volumes = $state<BookVolumeDto[]>([]);
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
    return fallbackImageCandidate(r.chapterImageUrl, "plugin");
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

  function chapterTitleKey(chapterId: string): string {
    return `chapterTitle:${chapterId}`;
  }

  function exactChapterTitle(
    r: NormalizedBookIdentifyResult,
    chapter: BookChapterDto,
  ): string | null {
    return r.chapterTitleByNumber?.[String(chapter.chapterNumber)]?.trim() || null;
  }

  function chapterTitleValue(r: NormalizedBookIdentifyResult, chapter: BookChapterDto): string {
    return chapterTitleValues[chapter.id] ?? exactChapterTitle(r, chapter) ?? chapter.title;
  }

  function chapterTitleIsEnabled(r: NormalizedBookIdentifyResult, chapter: BookChapterDto): boolean {
    if (Object.prototype.hasOwnProperty.call(chapterTitleEnabled, chapter.id)) {
      return chapterTitleEnabled[chapter.id] ?? false;
    }
    return Boolean(exactChapterTitle(r, chapter));
  }

  function setChapterTitleEnabled(chapterId: string, enabled: boolean) {
    chapterTitleEnabled = { ...chapterTitleEnabled, [chapterId]: enabled };
  }

  function setChapterTitleValue(chapterId: string, title: string) {
    chapterTitleValues = { ...chapterTitleValues, [chapterId]: title };
  }

  function volumeGroupKey(volumeNumber: string): string {
    return `volumeGroup:${volumeNumber}`;
  }

  function volumeCoverKey(volumeNumber: string): string {
    return `volumeCover:${volumeNumber}`;
  }

  function volumeCoverCandidates(
    r: NormalizedBookIdentifyResult,
    volumeNumber: string,
  ): ImageCandidate[] {
    return (r.volumeCovers ?? []).filter(
      (candidate) => String(candidate.volumeNumber) === volumeNumber,
    );
  }

  function chapterNumberValue(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  function numericVolumeValue(value: unknown): number | null {
    const normalized = typeof value === "number" ? String(value) : String(value ?? "").trim();
    if (!/^\d+$/.test(normalized)) return null;
    const parsed = Number.parseInt(normalized, 10);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  function availableVolumeNumbers(r: NormalizedBookIdentifyResult): string[] {
    const seen = new Set<string>();
    const numbers: string[] = [];
    for (const cover of r.volumeCovers ?? []) {
      const value = String(cover.volumeNumber ?? "").trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      numbers.push(value);
    }
    return numbers.sort((a, b) => volumeSortValue(a) - volumeSortValue(b) || a.localeCompare(b));
  }

  function closestAvailableVolume(available: string[], target: number): string | null {
    let closest: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const value of available) {
      const numeric = numericVolumeValue(value);
      if (numeric == null) continue;
      const distance = Math.abs(numeric - target);
      if (distance < closestDistance || (distance === closestDistance && numeric < (numericVolumeValue(closest) ?? Number.MAX_SAFE_INTEGER))) {
        closest = value;
        closestDistance = distance;
      }
    }
    return closest;
  }

  function inferredChapterVolumeByNumber(r: NormalizedBookIdentifyResult): Map<number, string> {
    const availableVolumes = availableVolumeNumbers(r);
    const out = new Map<number, string>();
    for (const [chapterNumber, volumeNumber] of Object.entries(r.chapterVolumeByNumber ?? {})) {
      const chapter = chapterNumberValue(chapterNumber);
      const volume = String(volumeNumber ?? "").trim();
      if (chapter != null && volume) out.set(chapter, volume);
    }
    if (chapters.length === 0 || availableVolumes.length === 0) return out;

    const localNumbers = Array.from(
      new Set(chapters.map((chapter) => chapterNumberValue(chapter.chapterNumber)).filter((value): value is number => value != null)),
    ).sort((a, b) => a - b);
    if (localNumbers.length === 0) return out;

    const numericVolumes = availableVolumes
      .map(numericVolumeValue)
      .filter((value): value is number => value != null)
      .sort((a, b) => a - b);
    if (numericVolumes.length === 0) return out;

    const mappedVolumes = new Map<string, number[]>();
    for (const [chapter, volume] of out.entries()) {
      if (!localNumbers.includes(chapter)) continue;
      mappedVolumes.set(volume, [...(mappedVolumes.get(volume) ?? []), chapter]);
    }

    if (mappedVolumes.size === 1) {
      const [[volume, mappedChapters]] = Array.from(mappedVolumes.entries());
      const firstMapped = Math.min(...mappedChapters);
      const maxLocal = Math.max(...localNumbers);
      if (maxLocal <= numericVolumes.length * 3) {
        for (const chapter of localNumbers) {
          if (chapter >= firstMapped && !out.has(chapter)) out.set(chapter, volume);
        }
        return out;
      }
    }

    const maxChapter = Math.max(...localNumbers);
    const maxVolume = Math.max(...numericVolumes);
    const chaptersPerVolume = Math.max(1, Math.ceil(maxChapter / Math.max(1, maxVolume)));
    for (const chapter of localNumbers) {
      if (out.has(chapter)) continue;
      const estimatedVolume = Math.max(1, Math.ceil(chapter / chaptersPerVolume));
      const closest = closestAvailableVolume(availableVolumes, estimatedVolume);
      if (closest) out.set(chapter, closest);
    }
    return out;
  }

  function volumeState(volumeNumber: string): { accepted: boolean; expanded: boolean } {
    return volumeStates[volumeNumber] ?? { accepted: true, expanded: true };
  }

  function setVolumeAccepted(volumeNumber: string, accepted: boolean) {
    const current = volumeState(volumeNumber);
    volumeStates = {
      ...volumeStates,
      [volumeNumber]: { ...current, accepted },
    };
  }

  function toggleVolumeExpanded(volumeNumber: string) {
    const current = volumeState(volumeNumber);
    volumeStates = {
      ...volumeStates,
      [volumeNumber]: { ...current, expanded: !current.expanded },
    };
  }

  $effect(() => {
    const bookId = row.book.id;
    let cancelled = false;
    chaptersLoading = true;
    chapterError = null;

    void fetchBookDetail(bookId, { nsfw: includeNsfw ? "show" : "off" })
      .then((detail) => {
        if (!cancelled) {
          chapters = detail.chapters;
          volumes = detail.volumes;
        }
      })
      .catch((err) => {
        if (!cancelled) {
          chapters = [];
          volumes = [];
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
    const next: BookSelectedImages = {};
    const result = row.result;
    if (!result) return next;
    if (Object.prototype.hasOwnProperty.call(selectedImages, "cover")) {
      next.cover = imageSelectionForAccept(
        selectedImages.cover,
        "bookCover",
        bookCoverCandidates(result),
      );
    }
    for (const group of volumeGroups(result)) {
      next[volumeGroupKey(group.volumeNumber)] = volumeState(group.volumeNumber).accepted
        ? "accept"
        : "loose";
      const coverKey = volumeCoverKey(group.volumeNumber);
      if (Object.prototype.hasOwnProperty.call(selectedImages, coverKey)) {
        next[coverKey] = imageSelectionForAccept(
          selectedImages[coverKey],
          `volumeCover:${group.volumeNumber}`,
          volumeCoverCandidates(result, group.volumeNumber),
        );
      }
    }
    for (const chapter of chapters) {
      const key = chapterImageKey(chapter.id);
      if (Object.prototype.hasOwnProperty.call(selectedImages, key)) {
        next[key] = imageSelectionForAccept(
          selectedImages[key],
          `chapterCover:${chapter.chapterNumber}`,
          chapterCandidatesFor(result, chapter),
        );
      }
      if (chapterTitleIsEnabled(result, chapter)) {
        const title = chapterTitleValue(result, chapter).trim();
        if (title) next[chapterTitleKey(chapter.id)] = title;
      }
    }
    return next;
  }

  function imageSelectionForAccept(
    value: string | null | undefined,
    refKind: string,
    candidates: ImageCandidate[],
  ): string | null | undefined {
    if (value == null) return value;
    const index = candidates.findIndex((candidate) => candidate.url === value);
    if (index >= 0) return `plugin-image:${refKind}:${index}`;
    if (value.startsWith("data:image/")) return undefined;
    return value;
  }

  function volumeSortValue(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  }

  function volumeGroups(r: NormalizedBookIdentifyResult): Array<{
    volumeNumber: string;
    title: string;
    cover: ImageCandidate | null;
    chapters: BookChapterDto[];
  }> {
    const chapterVolumeMap = inferredChapterVolumeByNumber(r);
    const numbers: string[] = [];
    for (const cover of r.volumeCovers ?? []) {
      const value = String(cover.volumeNumber);
      if (cover.volumeNumber && !numbers.includes(value)) numbers.push(value);
    }
    for (const volumeNumber of chapterVolumeMap.values()) {
      const value = String(volumeNumber);
      if (volumeNumber && !numbers.includes(value)) numbers.push(value);
    }

    return numbers
      .sort((a, b) => volumeSortValue(a) - volumeSortValue(b) || a.localeCompare(b))
      .map((volumeNumber) => {
        const cover = r.volumeCovers?.find((item) => String(item.volumeNumber) === volumeNumber) ?? null;
        const existingVolume = volumes.find((item) => String(item.volumeNumber ?? "") === volumeNumber) ?? null;
        const groupedChapters = chapters.filter(
          (chapter) => {
            const chapterNumber = chapterNumberValue(chapter.chapterNumber);
            return chapterNumber != null && chapterVolumeMap.get(chapterNumber) === volumeNumber;
          },
        );
        return {
          volumeNumber,
          title: cover?.title ?? existingVolume?.title ?? `Volume ${volumeNumber}`,
          cover,
          chapters: groupedChapters.length > 0 ? groupedChapters : (existingVolume?.chapters ?? []),
        };
      })
      .filter((group) => group.chapters.length > 0);
  }

  function acceptedVolumeChapterIds(r: NormalizedBookIdentifyResult): string[] {
    const ids: string[] = [];
    for (const group of volumeGroups(r)) {
      if (!volumeState(group.volumeNumber).accepted) continue;
      for (const chapter of group.chapters) {
        if (!ids.includes(chapter.id)) ids.push(chapter.id);
      }
    }
    return ids;
  }

  function looseChapters(r: NormalizedBookIdentifyResult): BookChapterDto[] {
    const grouped = acceptedVolumeChapterIds(r);
    return chapters.filter((chapter) => !grouped.includes(chapter.id));
  }

  function hasChapterEdits(r: NormalizedBookIdentifyResult): boolean {
    return chapterCoverCandidates(r).length > 0 || Boolean(r.chapterTitleByNumber);
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
        {#snippet chapterEditRow(chapter: BookChapterDto)}
          <div class="grid gap-3 border border-border-subtle/40 bg-surface-2/30 p-2.5 sm:grid-cols-[70px_1fr]">
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
              class="w-[70px]"
            />
            <div class="min-w-0 space-y-2">
              <div class="flex items-center gap-2">
                <Checkbox
                  checked={chapterTitleIsEnabled(r, chapter)}
                  onchange={(e) => setChapterTitleEnabled(chapter.id, (e.currentTarget as HTMLInputElement).checked)}
                />
                <span class="text-kicker">Title</span>
              </div>
              <input
                value={chapterTitleValue(r, chapter)}
                oninput={(e) => setChapterTitleValue(chapter.id, (e.currentTarget as HTMLInputElement).value)}
                disabled={!chapterTitleIsEnabled(r, chapter)}
                class="w-full border border-border-subtle bg-surface-1 px-2 py-1.5 text-[0.76rem] text-text-primary disabled:opacity-50"
              />
              <p class="truncate text-[0.62rem] text-text-muted" title={chapter.title}>
                Local: {chapter.title}
              </p>
            </div>
          </div>
        {/snippet}
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
                  <span class="text-kicker">Artists</span>
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
        {#if volumeGroups(r).length > 0}
          <div class="border-t border-border-subtle pt-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <span class="text-kicker">Volume groups</span>
              <span class="text-[0.62rem] text-text-muted">
                Accepted groups will move their matched chapters into volume folders.
              </span>
            </div>
            <div class="overflow-hidden border border-border-subtle">
              {#each volumeGroups(r) as group (group.volumeNumber)}
                {@const state = volumeState(group.volumeNumber)}
                <div class="border-b border-border-subtle/50 last:border-b-0">
                  <div
                    class="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-surface-2/40"
                  >
                    <Checkbox
                      size="md"
                      checked={state.accepted}
                      onchange={(e) => {
                        e.stopPropagation();
                        setVolumeAccepted(
                          group.volumeNumber,
                          (e.currentTarget as HTMLInputElement).checked,
                        );
                      }}
                      title="Accept this volume group"
                    />
                    <div class="w-24 flex-shrink-0">
                      <ImagePicker
                        label="Volume cover"
                        aspect="poster"
                        candidates={volumeCoverCandidates(r, group.volumeNumber)}
                        value={
                          Object.prototype.hasOwnProperty.call(
                            selectedImages,
                            volumeCoverKey(group.volumeNumber),
                          )
                            ? selectedImages[volumeCoverKey(group.volumeNumber)]
                            : (group.cover?.url ?? null)
                        }
                        onSelect={(url) =>
                          (selectedImages = {
                            ...selectedImages,
                            [volumeCoverKey(group.volumeNumber)]: url,
                          })}
                      />
                    </div>
                    <button
                      type="button"
                      onclick={() => toggleVolumeExpanded(group.volumeNumber)}
                      class="flex min-w-0 flex-1 items-center gap-4 text-left"
                    >
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-[1rem] font-semibold text-text-primary">{group.title}</div>
                        <div class="mt-1 text-[0.7rem] text-text-muted">
                          {group.chapters.length} chapter{group.chapters.length === 1 ? "" : "s"} · {state.accepted ? "will be grouped" : "will stay loose"}
                        </div>
                      </div>
                      <span class="hidden text-[0.62rem] text-text-disabled sm:inline">
                        {group.chapters.map((chapter) => `Ch. ${chapter.chapterNumber}`).join(", ")}
                      </span>
                      <ChevronDown
                        class={cn(
                          "h-3.5 w-3.5 flex-shrink-0 text-text-disabled transition-transform duration-fast",
                          state.expanded && "rotate-180",
                        )}
                      />
                    </button>
                  </div>
                  {#if state.expanded}
                    <div class="space-y-2 border-t border-border-subtle/50 bg-surface-2/20 p-3">
                      {#if !state.accepted}
                        <p class="text-[0.68rem] text-text-muted">
                          This volume is unchecked. Its chapters will remain loose and are editable below.
                        </p>
                      {:else}
                        {#each group.chapters as chapter (chapter.id)}
                          {@render chapterEditRow(chapter)}
                        {/each}
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
        {#if hasChapterEdits(r) && looseChapters(r).length > 0}
          <div class="border-t border-border-subtle pt-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <span class="text-kicker">Loose chapters</span>
              {#if chaptersLoading}
                <span class="flex items-center gap-1.5 text-[0.62rem] text-text-muted">
                  <Loader2 class="h-3 w-3 animate-spin" /> loading chapters...
                </span>
              {/if}
            </div>
            {#if chapterError}
              <p class="text-[0.68rem] text-status-error-text">{chapterError}</p>
            {:else if looseChapters(r).length > 0}
              <div class="space-y-2">
                {#each looseChapters(r) as chapter (chapter.id)}
                  {@render chapterEditRow(chapter)}
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
