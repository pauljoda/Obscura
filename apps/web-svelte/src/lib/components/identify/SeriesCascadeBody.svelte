<script lang="ts">
  import { onMount } from "svelte";
  import { Check, Loader2 } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type {
    NormalizedCastMember,
    NormalizedSeasonResult,
    NormalizedSeriesResult,
  } from "@obscura/contracts";
  import {
    acceptVideoSeriesScrape,
    type AcceptFieldMask,
    type CascadeAcceptSpec,
    type SelectedImages,
  } from "$lib/v1/api/scrapers-v1";
  import { fetchTags } from "$lib/v1/api/entities-v1";
  import { fetchAllPerformers } from "$lib/v1/api/entities-v1";
  import CandidatePicker from "./CandidatePicker.svelte";
  import FieldMaskGrid from "./FieldMaskGrid.svelte";
  import ImagePicker from "./ImagePicker.svelte";
  import SeasonSection from "./SeasonSection.svelte";

  type FieldKey = keyof AcceptFieldMask;
  type EpisodeState = {
    accepted: boolean;
    mask: AcceptFieldMask;
    still: string | null | undefined;
  };
  type SeasonState = {
    accepted: boolean;
    expanded: boolean;
    mask: AcceptFieldMask;
    poster: string | null | undefined;
    episodes: Record<number, EpisodeState>;
  };

  interface Props {
    result: NormalizedSeriesResult;
    scrapeResultId: string;
    seriesId: string;
    rerunning: boolean;
    onPickCandidate: (tmdbId: string) => void;
    onAccepted: () => void;
    onAcceptAndNext?: () => void;
  }

  let {
    result,
    scrapeResultId,
    seriesId,
    rerunning,
    onPickCandidate,
    onAccepted,
    onAcceptAndNext,
  }: Props = $props();

  const SERIES_FIELDS: Array<{ key: FieldKey; label: string }> = [
    { key: "title", label: "Title" },
    { key: "overview", label: "Overview" },
    { key: "tagline", label: "Tagline" },
    { key: "releaseDate", label: "First aired" },
    { key: "genres", label: "Genres" },
    { key: "studio", label: "Network" },
    { key: "cast", label: "Cast" },
    { key: "rating", label: "Rating" },
    { key: "contentRating", label: "Content rating" },
    { key: "externalIds", label: "External IDs" },
  ];
  const SEASON_FIELDS: Array<{ key: FieldKey; label: string }> = [
    { key: "title", label: "Title" },
    { key: "overview", label: "Overview" },
    { key: "airDate", label: "Air date" },
    { key: "externalIds", label: "External IDs" },
  ];
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

  function seasonReviewKey(season: NormalizedSeasonResult, index: number): string {
    const externalId = Object.values(season.externalIds)[0] ?? "";
    return `${season.seasonNumber}:${externalId}:${index}`;
  }

  function castReviewKey(member: NormalizedCastMember, index: number): string {
    return `${member.name.toLowerCase()}:${member.character ?? ""}:${member.order ?? ""}:${index}`;
  }

  let pickedCandidate = $state<string | null>(null);

  let existingTagNames = $state<Set<string>>(new Set());
  let existingPerformerNames = $state<Set<string>>(new Set());

  onMount(() => {
    let cancelled = false;
    void Promise.all([fetchTags(), fetchAllPerformers()])
      .then(([tagsRes, perfRes]) => {
        if (cancelled) return;
        existingTagNames = new Set(
          tagsRes.tags.map((t: { name: string }) => t.name.toLowerCase()),
        );
        existingPerformerNames = new Set(
          perfRes.performers.map((p: { name: string }) => p.name.toLowerCase()),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  });

  let seriesMask = $state<AcceptFieldMask>(allOn(SERIES_FIELDS));
  let selectedImages = $state<SelectedImages>({});

  function buildInitialSeasons(): Record<number, SeasonState> {
    const init: Record<number, SeasonState> = {};
    for (const s of result.seasons) {
      const epsInit: Record<number, EpisodeState> = {};
      for (const ep of s.episodes) {
        epsInit[ep.episodeNumber] = {
          accepted: ep.matched !== false,
          mask: allOn(EPISODE_FIELDS),
          still: undefined,
        };
      }
      if (init[s.seasonNumber]) continue;
      init[s.seasonNumber] = {
        accepted: true,
        expanded: s.seasonNumber !== 0,
        mask: allOn(SEASON_FIELDS),
        poster: undefined,
        episodes: epsInit,
      };
    }
    return init;
  }

  let seasons = $state<Record<number, SeasonState>>(buildInitialSeasons());
  let busy = $state(false);
  let submitError = $state<string | null>(null);

  function toggleSeriesField(key: FieldKey) {
    seriesMask = { ...seriesMask, [key]: !seriesMask[key] };
  }

  function setSeasonAccepted(n: number, accepted: boolean) {
    seasons = { ...seasons, [n]: { ...seasons[n], accepted } };
  }

  function toggleSeasonExpanded(n: number) {
    seasons = { ...seasons, [n]: { ...seasons[n], expanded: !seasons[n].expanded } };
  }

  function toggleSeasonField(n: number, key: FieldKey) {
    const s = seasons[n];
    seasons = {
      ...seasons,
      [n]: { ...s, mask: { ...s.mask, [key]: !s.mask[key] } },
    };
  }

  function setSeasonPoster(n: number, url: string | null) {
    seasons = { ...seasons, [n]: { ...seasons[n], poster: url } };
  }

  function setEpisodeAccepted(s: number, e: number, accepted: boolean) {
    const season = seasons[s];
    seasons = {
      ...seasons,
      [s]: {
        ...season,
        episodes: {
          ...season.episodes,
          [e]: { ...season.episodes[e], accepted },
        },
      },
    };
  }

  function toggleEpisodeField(s: number, e: number, key: FieldKey) {
    const season = seasons[s];
    const ep = season.episodes[e];
    seasons = {
      ...seasons,
      [s]: {
        ...season,
        episodes: {
          ...season.episodes,
          [e]: { ...ep, mask: { ...ep.mask, [key]: !ep.mask[key] } },
        },
      },
    };
  }

  function acceptAll() {
    seriesMask = allOn(SERIES_FIELDS);
    const next: Record<number, SeasonState> = {};
    for (const [k, v] of Object.entries(seasons)) {
      const epsNext: Record<number, EpisodeState> = {};
      for (const [ek, ev] of Object.entries(v.episodes)) {
        epsNext[Number(ek)] = {
          ...ev,
          accepted: true,
          mask: allOn(EPISODE_FIELDS),
        };
      }
      next[Number(k)] = {
        ...v,
        accepted: true,
        mask: allOn(SEASON_FIELDS),
        episodes: epsNext,
      };
    }
    seasons = next;
  }

  async function submit(andNext: boolean) {
    busy = true;
    submitError = null;
    try {
      const seasonOverrides: NonNullable<CascadeAcceptSpec["seasonOverrides"]> = {};
      for (const [k, s] of Object.entries(seasons)) {
        const n = Number(k);
        const episodes: NonNullable<
          CascadeAcceptSpec["seasonOverrides"]
        >[number]["episodes"] = {};
        for (const [ek, ev] of Object.entries(s.episodes)) {
          episodes[Number(ek)] = {
            accepted: ev.accepted,
            fieldMask: ev.mask,
            selectedImages:
              ev.still !== undefined ? { still: ev.still ?? undefined } : undefined,
          };
        }
        seasonOverrides[n] = {
          accepted: s.accepted,
          fieldMask: s.mask,
          selectedImages:
            s.poster !== undefined ? { poster: s.poster ?? undefined } : undefined,
          episodes,
        };
      }
      await acceptVideoSeriesScrape(seriesId, {
        scrapeResultId,
        fieldMask: seriesMask,
        selectedImages,
        cascade: { acceptAllSeasons: false, seasonOverrides },
      });
      if (andNext && onAcceptAndNext) onAcceptAndNext();
      else onAccepted();
    } catch (err) {
      submitError = err instanceof Error ? err.message : "Accept failed";
    } finally {
      busy = false;
    }
  }

  const nonZeroSeasons = $derived(result.seasons.filter((s) => s.seasonNumber > 0));
  const isFlat = $derived(nonZeroSeasons.length === 0);
</script>

<div class="flex flex-col">
  {#if result.candidates && result.candidates.length > 0}
    <CandidatePicker
      candidates={result.candidates}
      picked={pickedCandidate}
      {rerunning}
      onPick={(id) => {
        pickedCandidate = id;
        onPickCandidate(id);
      }}
    />
  {/if}

  <div class="border-b border-border-subtle p-5 space-y-4">
    <div class="flex flex-col md:flex-row gap-4">
      <div class="min-w-0 flex-1 space-y-2">
        <h3 class="text-lg font-semibold text-text-primary">{result.title}</h3>
        {#if result.originalTitle && result.originalTitle !== result.title}
          <p class="text-[0.7rem] text-text-muted">{result.originalTitle}</p>
        {/if}
        {#if result.firstAirDate}
          <p class="text-[0.7rem] text-text-muted">
            First aired: {result.firstAirDate}{#if result.endAirDate} · Ended: {result.endAirDate}{/if}
          </p>
        {/if}
        {#if result.overview}
          <p class="text-[0.72rem] text-text-muted line-clamp-4">{result.overview}</p>
        {/if}
        {#if result.genres.length > 0}
          <div class="flex flex-wrap gap-1">
            {#each result.genres as g, index (`${g.toLowerCase()}:${index}`)}
              {@const isExisting = existingTagNames.has(g.toLowerCase())}
              <span
                class={cn(
                  "tag-chip text-[0.55rem]",
                  isExisting ? "tag-chip-default" : "tag-chip-accent",
                )}
                title={isExisting ? "Existing tag" : "Will create new tag"}
              >
                {g}
                {#if !isExisting}
                  <span class="ml-0.5 text-[0.45rem] opacity-70">NEW</span>
                {/if}
              </span>
            {/each}
          </div>
        {/if}
        {#if result.cast && result.cast.length > 0}
          <div class="space-y-1">
            <span class="text-[0.6rem] uppercase tracking-[0.12em] text-text-muted">
              Cast ({result.cast.length})
            </span>
            <div class="flex flex-wrap gap-1">
              {#each result.cast.slice(0, 20) as c, index (castReviewKey(c, index))}
                {@const isExisting = existingPerformerNames.has(c.name.toLowerCase())}
                <span
                  class={cn(
                    "tag-chip text-[0.55rem]",
                    isExisting ? "tag-chip-default" : "tag-chip-accent",
                  )}
                  title={isExisting ? "Existing actor" : "Will create new actor"}
                >
                  {c.name}
                  {#if c.character}
                    <span class="text-text-disabled"> ({c.character})</span>
                  {/if}
                  {#if !isExisting}
                    <span class="ml-0.5 text-[0.45rem] opacity-70">NEW</span>
                  {/if}
                </span>
              {/each}
              {#if result.cast.length > 20}
                <span class="tag-chip tag-chip-default text-[0.55rem] text-text-disabled">
                  +{result.cast.length - 20}
                </span>
              {/if}
            </div>
          </div>
        {/if}
      </div>
      <ImagePicker
        label="Poster"
        aspect="poster"
        candidates={result.posterCandidates}
        value={selectedImages.poster ?? undefined}
        onSelect={(url) => (selectedImages = { ...selectedImages, poster: url ?? undefined })}
        class="w-28"
      />
      <ImagePicker
        label="Backdrop"
        aspect="backdrop"
        candidates={result.backdropCandidates}
        value={selectedImages.backdrop ?? undefined}
        onSelect={(url) => (selectedImages = { ...selectedImages, backdrop: url ?? undefined })}
        class="w-36"
      />
    </div>

    <FieldMaskGrid fields={SERIES_FIELDS} mask={seriesMask} onToggle={toggleSeriesField} />
  </div>

  <div>
    <div
      class="sticky top-0 z-10 bg-bg px-5 py-2 text-[0.6rem] uppercase tracking-[0.14em] text-text-muted"
    >
      {isFlat ? "Episodes" : `Seasons (${result.seasons.length})`}
    </div>
    {#if result.seasons.length === 0}
      <div class="px-5 py-10 text-center text-[0.72rem] text-text-muted">
        The plugin did not return any season data.
      </div>
    {/if}
    {#each result.seasons as season, seasonIndex (seasonReviewKey(season, seasonIndex))}
      {@const seasonState = seasons[season.seasonNumber]}
      {#if seasonState}
        <SeasonSection
          {season}
          {seasonState}
          flat={isFlat}
          onSeasonAccepted={(a) => setSeasonAccepted(season.seasonNumber, a)}
          onExpand={() => toggleSeasonExpanded(season.seasonNumber)}
          onToggleField={(k) => toggleSeasonField(season.seasonNumber, k)}
          onSelectPoster={(url) => setSeasonPoster(season.seasonNumber, url)}
          onEpisodeAccepted={(e, a) => setEpisodeAccepted(season.seasonNumber, e, a)}
          onToggleEpisodeField={(e, k) => toggleEpisodeField(season.seasonNumber, e, k)}
        />
      {/if}
    {/each}
  </div>

  <div
    class="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border-subtle bg-bg px-5 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.3)]"
  >
    <button
      type="button"
      onclick={acceptAll}
      disabled={busy}
      class="text-[0.7rem] text-text-accent hover:text-text-accent-bright disabled:opacity-50"
    >
      Select all
    </button>
    {#if submitError}
      <p class="flex-1 text-[0.68rem] text-status-error-text text-right mr-2">{submitError}</p>
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
          Apply all
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
            {onAcceptAndNext ? "Apply all & next" : "Apply all"}
          </span>
        {/if}
      </button>
    </div>
  </div>
</div>
