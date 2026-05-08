<script lang="ts">
  import { ArrowDownUp, FolderInput, Loader2, X } from "@lucide/svelte";
  import type { GalleryListItemDto } from "@obscura/contracts";
  import { mergeGalleriesIntoSeries } from "$lib/api/media";

  interface Props {
    open: boolean;
    galleries: GalleryListItemDto[];
    onClose: () => void;
    onMerged: (seriesId: string) => void | Promise<void>;
  }

  let { open, galleries, onClose, onMerged }: Props = $props();

  type MergeRow = {
    id: string;
    originalTitle: string;
    title: string;
    sequence: number;
  };

  let title = $state("");
  let rows = $state<MergeRow[]>([]);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let initializedKey = $state("");

  function stripTrailingNumber(value: string) {
    return value
      .replace(/\s+#?\d{1,4}$/i, "")
      .replace(/\s+vol(?:ume)?\.?\s*\d{1,4}$/i, "")
      .trim();
  }

  function suggestedTitle(items: GalleryListItemDto[]) {
    if (items.length === 0) return "";
    const first = stripTrailingNumber(items[0].title);
    return first || items[0].title;
  }

  function resetFromSelection() {
    title = suggestedTitle(galleries);
    rows = galleries.map((gallery, index) => ({
      id: gallery.id,
      originalTitle: gallery.title,
      title: `${suggestedTitle(galleries)} #${String(index + 1).padStart(2, "0")}`,
      sequence: index + 1,
    }));
    error = null;
  }

  $effect(() => {
    const key = open ? galleries.map((gallery) => gallery.id).join("|") : "";
    if (key && key !== initializedKey) {
      initializedKey = key;
      resetFromSelection();
    }
    if (!open) initializedKey = "";
  });

  async function submit() {
    if (saving) return;
    saving = true;
    error = null;
    try {
      const ordered = [...rows].sort((a, b) => a.sequence - b.sequence);
      const response = await mergeGalleriesIntoSeries({
        title: title.trim(),
        galleries: ordered.map((row, index) => ({
          id: row.id,
          title: row.title.trim() || `${title.trim()} #${String(index + 1).padStart(2, "0")}`,
          sequence: row.sequence,
        })),
      });
      await onMerged(response.id);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to merge galleries";
    } finally {
      saving = false;
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
    <div class="w-full max-w-2xl border border-border-default bg-surface-2 shadow-2xl backdrop-blur sm:max-h-[88vh]">
      <div class="flex items-start justify-between gap-4 border-b border-border-subtle p-4">
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 text-base font-heading text-text-primary">
            <FolderInput class="h-4 w-4 text-text-accent" />
            Merge into series
          </h2>
          <p class="mt-1 text-[0.76rem] text-text-muted">
            {galleries.length} selected galler{galleries.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <button
          type="button"
          class="p-1.5 text-text-muted transition-colors hover:text-text-primary"
          aria-label="Close"
          onclick={onClose}
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="max-h-[70vh] space-y-4 overflow-y-auto p-4">
        {#if error}
          <div class="border border-status-error/40 bg-status-error/10 p-2.5 text-sm text-status-error-text">
            {error}
          </div>
        {/if}

        <label class="block space-y-1.5">
          <span class="text-kicker">Series folder name</span>
          <input
            class="w-full border border-border-default bg-black/25 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-border-accent"
            bind:value={title}
            placeholder="Series title"
          />
        </label>

        <div class="space-y-2">
          <div class="flex items-center gap-2 text-kicker">
            <ArrowDownUp class="h-3.5 w-3.5" />
            Chapter order
          </div>
          {#each rows as row, index (row.id)}
            <div class="grid grid-cols-[4.5rem_1fr] gap-2 border border-border-subtle bg-black/15 p-2">
              <label class="space-y-1">
                <span class="text-[0.58rem] uppercase tracking-wider text-text-disabled">No.</span>
                <input
                  class="w-full border border-border-default bg-black/25 px-2 py-1.5 text-sm text-text-primary outline-none focus:border-border-accent"
                  type="number"
                  min="1"
                  bind:value={row.sequence}
                />
              </label>
              <label class="min-w-0 space-y-1">
                <span class="block truncate text-[0.58rem] uppercase tracking-wider text-text-disabled">
                  {row.originalTitle}
                </span>
                <input
                  class="w-full border border-border-default bg-black/25 px-2 py-1.5 text-sm text-text-primary outline-none focus:border-border-accent"
                  bind:value={row.title}
                />
              </label>
            </div>
          {/each}
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-border-subtle p-4">
        <button
          type="button"
          class="px-3 py-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
          onclick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 border border-border-accent px-3 py-1.5 text-sm text-text-accent shadow-[0_0_18px_rgba(196,154,90,0.18)] transition-colors hover:text-text-accent-bright disabled:opacity-50"
          onclick={() => void submit()}
          disabled={saving || !title.trim() || rows.length === 0}
        >
          {#if saving}
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
          {:else}
            <FolderInput class="h-3.5 w-3.5" />
          {/if}
          Merge
        </button>
      </div>
    </div>
  </div>
{/if}
