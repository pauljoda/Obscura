<script lang="ts">
  import { Building2, CalendarRange, Search, Tag, Users, X } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { EntityGridFilterOption } from "$lib/entities/entity-grid";

  interface Props {
    activeFilterIds: string[];
    filterOptions: EntityGridFilterOption[];
    onActiveFilterIdsChange: (ids: string[]) => void;
  }

  let { activeFilterIds, filterOptions, onActiveFilterIdsChange }: Props = $props();
  let peopleSearch = $state("");
  let studioSearch = $state("");
  let tagSearch = $state("");

  const activeSet = $derived(new Set(activeFilterIds));
  const optionMap = $derived(new Map(filterOptions.map((option) => [option.id, option])));

  const hasTechnicalFilters = $derived(
    filterOptions.some((option) => option.capabilityKind === "technical"),
  );
  const hasRatingFilters = $derived(
    filterOptions.some((option) => option.capabilityKind === "rating"),
  );
  const hasDateFilters = $derived(
    filterOptions.some((option) => option.capabilityKind === "dates"),
  );
  const hasPlaybackOrFileFilters = $derived(
    filterOptions.some((option) => option.capabilityKind === "files" || option.capabilityKind === "progress"),
  );
  const hasFlagFilters = $derived(
    filterOptions.some((option) => option.capabilityKind === "flags"),
  );

  const tagOptions = $derived(filterOptions.filter((option) => option.capabilityKind === "tags"));
  const peopleOptions = $derived(filterOptions.filter((option) => option.capabilityKind === "credits"));
  const studioOptions = $derived(filterOptions.filter((option) => option.capabilityKind === "studio"));
  const filteredPeopleOptions = $derived.by(() => {
    const query = peopleSearch.trim().toLowerCase();
    if (!query) return peopleOptions;
    return peopleOptions.filter((option) => option.label.toLowerCase().includes(query));
  });
  const filteredStudioOptions = $derived.by(() => {
    const query = studioSearch.trim().toLowerCase();
    if (!query) return studioOptions;
    return studioOptions.filter((option) => option.label.toLowerCase().includes(query));
  });
  const filteredTagOptions = $derived.by(() => {
    const query = tagSearch.trim().toLowerCase();
    if (!query) return tagOptions;
    return tagOptions.filter((option) => option.label.toLowerCase().includes(query));
  });
  const groupedTags = $derived.by(() => {
    if (filteredTagOptions.length <= 24) return null;
    const groups: Record<string, EntityGridFilterOption[]> = {};
    for (const option of filteredTagOptions) {
      const label = option.label.replace(/^Tag:\s*/i, "");
      const letter = label[0]?.toUpperCase() ?? "#";
      (groups[letter] ??= []).push(option);
    }
    return Object.entries(groups).sort(([left], [right]) => left.localeCompare(right));
  });

  const resolutions = ["4K", "1080p", "720p", "480p"];
  const durationChoices = [
    { id: "lt300", label: "< 5 min" },
    { id: "300-900", label: "5-15 min" },
    { id: "900-1800", label: "15-30 min" },
    { id: "gte1800", label: "30+ min" },
  ];
  const codecs = [
    { id: "h264", label: "H.264" },
    { id: "h265", label: "HEVC" },
    { id: "av1", label: "AV1" },
    { id: "vp9", label: "VP9" },
    { id: "vp8", label: "VP8" },
    { id: "mpeg4", label: "MPEG-4" },
    { id: "prores", label: "ProRes" },
    { id: "wmv", label: "WMV" },
  ];
  const ratingValues = [1, 2, 3, 4, 5];

  function isActive(id: string): boolean {
    return activeSet.has(id);
  }

  function toggleFilter(id: string) {
    onActiveFilterIdsChange(
      isActive(id)
        ? activeFilterIds.filter((filterId) => filterId !== id)
        : [...activeFilterIds, id],
    );
  }

  function replaceRangeFilter(prefix: string, value: string) {
    const next = activeFilterIds.filter((id) => !id.startsWith(prefix));
    if (value) next.push(`${prefix}${value}`);
    onActiveFilterIdsChange(next);
  }

  function chipClass(id: string, variant: "accent" | "info" = "accent"): string {
    const activeClass = variant === "info" ? "tag-chip-info" : "tag-chip-accent";
    const hoverClass =
      variant === "info"
        ? "tag-chip-default hover:tag-chip-info"
        : "tag-chip-default hover:tag-chip-accent";
    return cn("tag-chip cursor-pointer transition-colors duration-fast", isActive(id) ? activeClass : hoverClass);
  }

  function countFor(id: string): number | null {
    return optionMap.get(id)?.count ?? null;
  }

  function dateValue(prefix: string): string {
    return activeFilterIds.find((id) => id.startsWith(prefix))?.slice(prefix.length) ?? "";
  }
</script>

<div class="surface-well mt-px p-3">
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {#if hasTechnicalFilters}
      <section>
        <div class="mb-2 text-kicker">Resolution</div>
        <div class="flex flex-wrap gap-1">
          {#each resolutions as resolution (resolution)}
            {@const id = `technical:resolution:${resolution}`}
            <button type="button" class={chipClass(id)} onclick={() => toggleFilter(id)}>
              {resolution}
              {#if countFor(id) != null}<span class="ml-1 text-text-disabled">{countFor(id)}</span>{/if}
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if hasRatingFilters}
      <section>
        <div class="mb-2 text-kicker">Rating</div>
        <div class="space-y-2">
          <div class="font-mono text-[0.6rem] uppercase tracking-wider text-text-disabled">At least</div>
          <div class="flex flex-wrap gap-1">
            {#each ratingValues as value (value)}
              {@const id = `rating:min:${value}`}
              <button type="button" class={chipClass(id)} onclick={() => toggleFilter(id)}>
                {value}★+
              </button>
            {/each}
          </div>
          <div class="font-mono text-[0.6rem] uppercase tracking-wider text-text-disabled">At most</div>
          <div class="flex flex-wrap gap-1">
            {#each ratingValues as value (value)}
              {@const id = `rating:max:${value}`}
              <button type="button" class={chipClass(id)} onclick={() => toggleFilter(id)}>
                ≤{value}★
              </button>
            {/each}
          </div>
        </div>
      </section>
    {/if}

    {#if hasDateFilters}
      <section>
        <div class="mb-2 text-kicker">Date</div>
        <div class="flex flex-col gap-2">
          <label class="date-row">
            <CalendarRange class="h-3 w-3 shrink-0 text-text-disabled" />
            <span>From</span>
            <input
              type="date"
              value={dateValue("dates:from:")}
              onchange={(event) => replaceRangeFilter("dates:from:", (event.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <label class="date-row">
            <CalendarRange class="h-3 w-3 shrink-0 text-text-disabled" />
            <span>To</span>
            <input
              type="date"
              value={dateValue("dates:to:")}
              onchange={(event) => replaceRangeFilter("dates:to:", (event.currentTarget as HTMLInputElement).value)}
            />
          </label>
        </div>
      </section>
    {/if}

    {#if hasTechnicalFilters}
      <section>
        <div class="mb-2 text-kicker">Duration</div>
        <div class="flex flex-wrap gap-1">
          {#each durationChoices as duration (duration.id)}
            {@const id = `technical:duration:${duration.id}`}
            <button type="button" class={chipClass(id)} onclick={() => toggleFilter(id)}>
              {duration.label}
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if hasPlaybackOrFileFilters}
      <section>
        <div class="mb-2 text-kicker">Playback & File</div>
        <div class="flex flex-wrap gap-1">
          {#each [
            { id: "progress:played:true", label: "Played" },
            { id: "progress:played:false", label: "Unplayed" },
            { id: "files:has:true", label: "Has file" },
            { id: "files:has:false", label: "No file" },
          ] as item (item.id)}
            <button type="button" class={chipClass(item.id)} onclick={() => toggleFilter(item.id)}>
              {item.label}
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if hasFlagFilters}
      <section>
        <div class="mb-2 text-kicker">Library Flags</div>
        <div class="flex flex-wrap gap-1">
          {#each [
            { id: "flags:organized:true", label: "Organized" },
            { id: "flags:organized:false", label: "Not organized" },
            { id: "flags:nsfw:true", label: "Is NSFW" },
            { id: "flags:nsfw:false", label: "Not NSFW" },
          ] as item (item.id)}
            <button type="button" class={chipClass(item.id)} onclick={() => toggleFilter(item.id)}>
              {item.label}
              {#if countFor(item.id) != null}<span class="ml-1 text-text-disabled">{countFor(item.id)}</span>{/if}
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if hasTechnicalFilters}
      <section>
        <div class="mb-2 text-kicker">Codec</div>
        <div class="flex flex-wrap gap-1">
          {#each codecs as codec (codec.id)}
            {@const id = `technical:codec:${codec.id}`}
            <button type="button" class={chipClass(id)} onclick={() => toggleFilter(id)}>
              {codec.label}
              {#if countFor(id) != null}<span class="ml-1 text-text-disabled">{countFor(id)}</span>{/if}
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if tagOptions.length > 0}
      <section class="md:col-span-2 xl:col-span-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-kicker">
            <Tag class="h-3 w-3 text-text-disabled" />
            Tags
          </div>
          <span class="font-mono text-[0.6rem] tabular-nums text-text-disabled">
            {filteredTagOptions.length !== tagOptions.length
              ? `${filteredTagOptions.length} / ${tagOptions.length}`
              : tagOptions.length}
          </span>
        </div>

        {#if tagOptions.length > 12}
          <div class="relative mb-2">
            <Search
              class="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-disabled"
            />
            <input
              type="text"
              placeholder="Filter tags..."
              bind:value={tagSearch}
              class={cn(
                "w-full border border-border-subtle bg-surface-1 py-1 pl-6 pr-7 text-[0.7rem] text-text-primary",
                "placeholder:text-text-disabled focus:border-border-accent focus:outline-none",
                "transition-colors duration-fast",
              )}
            />
            {#if tagSearch}
              <button
                type="button"
                class="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
                aria-label="Clear tag search"
                onclick={() => (tagSearch = "")}
              >
                <X class="h-3 w-3" />
              </button>
            {/if}
          </div>
        {/if}

        <div class="tag-scroll-area max-h-48 overflow-y-auto">
          {#if filteredTagOptions.length === 0}
            <div class="flex items-center justify-center py-4 text-[0.68rem] text-text-disabled">
              <Tag class="mr-1.5 h-3 w-3 opacity-50" />
              No matching tags
            </div>
          {:else if groupedTags}
            <div class="space-y-2">
              {#each groupedTags as [letter, letterOptions] (letter)}
                <div>
                  <div
                    class="sticky top-0 z-10 mb-1 border-b border-border-subtle bg-surface-2/90 px-0.5 py-0.5 font-mono text-[0.55rem] font-semibold uppercase tracking-widest text-text-disabled backdrop-blur-sm"
                  >
                    {letter}
                  </div>
                  <div class="flex flex-wrap gap-1">
                    {#each letterOptions as option (option.id)}
                      <button
                        type="button"
                        class={chipClass(option.id, "info")}
                        aria-pressed={isActive(option.id)}
                        onclick={() => toggleFilter(option.id)}
                      >
                        {option.label.replace(/^Tag:\s*/i, "")}
                        <span class="ml-1 text-text-disabled">{option.count}</span>
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="flex flex-wrap gap-1">
              {#each filteredTagOptions as option (option.id)}
                <button
                  type="button"
                  class={chipClass(option.id, "info")}
                  aria-pressed={isActive(option.id)}
                  onclick={() => toggleFilter(option.id)}
                >
                  {option.label.replace(/^Tag:\s*/i, "")}
                  <span class="ml-1 text-text-disabled">{option.count}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </section>
    {/if}

    {#if peopleOptions.length > 0}
      <section class="md:col-span-2 xl:col-span-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-kicker">
            <Users class="h-3 w-3 text-text-disabled" />
            Performers
          </div>
          <span class="font-mono text-[0.6rem] tabular-nums text-text-disabled">
            {filteredPeopleOptions.length !== peopleOptions.length
              ? `${filteredPeopleOptions.length} / ${peopleOptions.length}`
              : peopleOptions.length}
          </span>
        </div>
        {#if peopleOptions.length > 12}
          <div class="relative mb-2">
            <Search class="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-disabled" />
            <input
              type="text"
              placeholder="Filter performers..."
              bind:value={peopleSearch}
              class={cn("w-full border border-border-subtle bg-surface-1 py-1 pl-6 pr-7 text-[0.7rem] text-text-primary", "placeholder:text-text-disabled focus:border-border-accent focus:outline-none", "transition-colors duration-fast")}
            />
            {#if peopleSearch}
              <button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted" aria-label="Clear performer search" onclick={() => (peopleSearch = "")}>
                <X class="h-3 w-3" />
              </button>
            {/if}
          </div>
        {/if}
        <div class="tag-scroll-area max-h-48 overflow-y-auto">
          <div class="flex flex-wrap gap-1">
            {#each filteredPeopleOptions as option (option.id)}
              <button type="button" class={chipClass(option.id, "info")} onclick={() => toggleFilter(option.id)}>
                {option.label}
                <span class="ml-1 text-text-disabled">{option.count}</span>
              </button>
            {/each}
          </div>
        </div>
      </section>
    {/if}

    {#if studioOptions.length > 0}
      <section class="md:col-span-2 xl:col-span-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-kicker">
            <Building2 class="h-3 w-3 text-text-disabled" />
            Studios
          </div>
          <span class="font-mono text-[0.6rem] tabular-nums text-text-disabled">
            {filteredStudioOptions.length !== studioOptions.length
              ? `${filteredStudioOptions.length} / ${studioOptions.length}`
              : studioOptions.length}
          </span>
        </div>
        {#if studioOptions.length > 12}
          <div class="relative mb-2">
            <Search class="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-disabled" />
            <input
              type="text"
              placeholder="Filter studios..."
              bind:value={studioSearch}
              class={cn("w-full border border-border-subtle bg-surface-1 py-1 pl-6 pr-7 text-[0.7rem] text-text-primary", "placeholder:text-text-disabled focus:border-border-accent focus:outline-none", "transition-colors duration-fast")}
            />
            {#if studioSearch}
              <button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted" aria-label="Clear studio search" onclick={() => (studioSearch = "")}>
                <X class="h-3 w-3" />
              </button>
            {/if}
          </div>
        {/if}
        <div class="tag-scroll-area max-h-48 overflow-y-auto">
          <div class="flex flex-wrap gap-1">
            {#each filteredStudioOptions as option (option.id)}
              <button type="button" class={chipClass(option.id)} onclick={() => toggleFilter(option.id)}>
                {option.label}
                <span class="ml-1 text-text-disabled">{option.count}</span>
              </button>
            {/each}
          </div>
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .date-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }

  .date-row span {
    width: 2.5rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .date-row input {
    min-width: 0;
    flex: 1;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-1);
    color: var(--color-text-primary);
    font-size: 0.72rem;
    padding: 0.35rem 0.5rem;
  }

  .date-row input:focus {
    border-color: var(--color-border-accent);
    outline: none;
  }
</style>
