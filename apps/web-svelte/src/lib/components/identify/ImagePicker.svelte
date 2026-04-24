<script lang="ts">
  import { Check, Image as ImageIcon, X } from "@lucide/svelte";
  import type { ImageCandidate } from "@obscura/contracts";
  import { Checkbox, cn } from "@obscura/ui-svelte";

  export type ImagePickerAspect = "poster" | "backdrop" | "still" | "logo";

  interface Props {
    label: string;
    candidates: ImageCandidate[];
    /** `undefined` = default to first candidate; `null` = explicit no-image. */
    value: string | null | undefined;
    onSelect: (url: string | null) => void;
    aspect?: ImagePickerAspect;
    class?: string;
  }

  let {
    label,
    candidates,
    value,
    onSelect,
    aspect = "poster",
    class: className,
  }: Props = $props();

  const ASPECT_CLASS: Record<ImagePickerAspect, string> = {
    poster: "aspect-[2/3]",
    backdrop: "aspect-[16/9]",
    still: "aspect-[16/9]",
    logo: "aspect-[16/5]",
  };

  let open = $state(false);
  let sortBy = $state<"rank" | "resolution" | "language">("rank");
  let languageFilter = $state("");
  let hideLanguageless = $state(false);

  const effectiveUrl = $derived(
    value === null ? null : (value ?? candidates[0]?.url ?? null),
  );
  const aspectClass = $derived(ASPECT_CLASS[aspect]);

  const languages = $derived(
    Array.from(
      new Set(
        candidates
          .map((c) => c.language)
          .filter((l): l is string => typeof l === "string" && l.length > 0),
      ),
    ).sort(),
  );

  const filtered = $derived(
    candidates.filter((c) => {
      if (languageFilter && c.language !== languageFilter) return false;
      if (hideLanguageless && !c.language) return false;
      return true;
    }),
  );

  const sorted = $derived(
    [...filtered].sort((a, b) => {
      if (sortBy === "rank") {
        const ar = a.rank ?? 0;
        const br = b.rank ?? 0;
        if (br !== ar) return br - ar;
      }
      if (sortBy === "resolution") {
        const ap = (a.width ?? 0) * (a.height ?? 0);
        const bp = (b.width ?? 0) * (b.height ?? 0);
        if (bp !== ap) return bp - ap;
      }
      if (sortBy === "language") {
        const al = a.language ?? "";
        const bl = b.language ?? "";
        if (al !== bl) return al.localeCompare(bl);
      }
      return 0;
    }),
  );

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) open = false;
  }
</script>

<div class={cn("space-y-1", className)}>
  <div class="text-[0.62rem] uppercase tracking-[0.14em] text-text-muted">{label}</div>
  <button
    type="button"
    onclick={() => (open = true)}
    disabled={candidates.length === 0}
    class={cn(
      "group relative w-full overflow-hidden border border-border-subtle bg-surface-2 transition-colors duration-fast",
      candidates.length > 0
        ? "hover:border-border-accent cursor-pointer"
        : "opacity-50 cursor-not-allowed",
      aspectClass,
    )}
    title={candidates.length === 0
      ? "No candidates available"
      : `Choose ${label.toLowerCase()} (${candidates.length} available)`}
  >
    {#if effectiveUrl}
      <img
        src={effectiveUrl}
        alt={label}
        loading="lazy"
        class="absolute inset-0 h-full w-full object-cover"
      />
    {:else}
      <div
        class="flex h-full w-full flex-col items-center justify-center gap-1 text-text-disabled"
      >
        <ImageIcon class="h-6 w-6" />
        <span class="text-[0.6rem]">
          {candidates.length === 0 ? "None" : "No image"}
        </span>
      </div>
    {/if}
    {#if candidates.length > 1}
      <div
        class="absolute right-1 top-1 bg-surface-3/90 px-1 py-0.5 text-[0.55rem] font-mono text-text-muted"
      >
        {candidates.length}
      </div>
    {/if}
  </button>
</div>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[110] flex items-center justify-center bg-bg/95 backdrop-blur-md"
    onclick={handleBackdropClick}
  >
    <div
      class="surface-elevated flex max-h-[90vh] w-full max-w-5xl flex-col border border-border-subtle shadow-2xl"
    >
      <div
        class="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-3"
      >
        <h3 class="text-base font-semibold text-text-primary">
          Choose {label.toLowerCase()}
          <span class="ml-2 text-[0.7rem] font-normal text-text-muted">
            {filtered.length} of {candidates.length}
          </span>
        </h3>
        <button
          type="button"
          onclick={() => (open = false)}
          class="p-1 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div
        class="flex flex-wrap items-center gap-3 border-b border-border-subtle px-5 py-2 text-[0.7rem]"
      >
        <label class="flex items-center gap-1.5">
          <span class="text-text-muted">Sort</span>
          <select
            bind:value={sortBy}
            class="surface-card no-lift border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[0.7rem] text-text-primary"
          >
            <option value="rank">Rank</option>
            <option value="resolution">Resolution</option>
            <option value="language">Language</option>
          </select>
        </label>

        {#if languages.length > 0}
          <label class="flex items-center gap-1.5">
            <span class="text-text-muted">Language</span>
            <select
              bind:value={languageFilter}
              class="surface-card no-lift border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[0.7rem] text-text-primary"
            >
              <option value="">Any</option>
              {#each languages as lang (lang)}
                <option value={lang}>{lang}</option>
              {/each}
            </select>
          </label>
        {/if}

        <label class="flex items-center gap-1.5 cursor-pointer">
          <Checkbox
            checked={hideLanguageless}
            onchange={(e) => (hideLanguageless = (e.currentTarget as HTMLInputElement).checked)}
          />
          <span class="text-text-muted">Hide language-agnostic</span>
        </label>

        <button
          type="button"
          onclick={() => {
            onSelect(null);
            open = false;
          }}
          class={cn(
            "ml-auto px-2 py-1 text-[0.65rem] border transition-colors",
            effectiveUrl === null
              ? "border-status-error/60 bg-status-error/10 text-status-error-text"
              : "border-border-subtle text-text-muted hover:border-status-error/40 hover:text-status-error-text",
          )}
        >
          Use no image
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        {#if sorted.length === 0}
          <div class="flex h-32 items-center justify-center text-[0.72rem] text-text-muted">
            No candidates match the current filters.
          </div>
        {:else}
          <div
            class={cn(
              "grid gap-3",
              aspect === "poster"
                ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
                : "grid-cols-2 sm:grid-cols-3",
            )}
          >
            {#each sorted as candidate (candidate.url)}
              {@const isSelected = candidate.url === effectiveUrl}
              <button
                type="button"
                onclick={() => {
                  onSelect(candidate.url);
                  open = false;
                }}
                class={cn(
                  "group relative overflow-hidden border transition-colors duration-fast",
                  isSelected
                    ? "border-border-accent"
                    : "border-border-subtle hover:border-border-accent/60",
                )}
                title={`${candidate.width ?? "?"}\u00d7${candidate.height ?? "?"}`}
              >
                <div class={cn("bg-surface-2", aspectClass)}>
                  <img
                    src={candidate.url}
                    alt=""
                    loading="lazy"
                    class="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                {#if isSelected}
                  <div class="absolute right-1 top-1 bg-accent-500 p-0.5 text-bg">
                    <Check class="h-3 w-3" />
                  </div>
                {/if}
                <div
                  class="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-bg/70 px-1 py-0.5 text-[0.55rem] font-mono text-text-muted"
                >
                  <span>
                    {candidate.width && candidate.height
                      ? `${candidate.width}×${candidate.height}`
                      : "—"}
                  </span>
                  <span>
                    {candidate.language ?? "—"}
                    {candidate.rank !== undefined ? ` · ${candidate.rank.toFixed(1)}` : ""}
                  </span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div
        class="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3"
      >
        <div class="text-[0.65rem] text-text-muted">
          Currently selected:
          <span class="text-text-primary">
            {effectiveUrl === null
              ? "none"
              : effectiveUrl
                ? effectiveUrl.split("/").pop()
                : "(default)"}
          </span>
        </div>
        <button
          type="button"
          onclick={() => (open = false)}
          class="surface-card px-3 py-1 text-[0.7rem] hover:border-border-accent"
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}
