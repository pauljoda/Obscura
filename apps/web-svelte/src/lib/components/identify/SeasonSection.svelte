<script lang="ts">
  import { ChevronDown } from "@lucide/svelte";
  import { Checkbox, cn } from "@obscura/ui-svelte";
  import type { NormalizedEpisodeResult, NormalizedSeasonResult } from "@obscura/contracts";
  import type { AcceptFieldMask } from "$lib/v1/api/scrapers-v1";
  import FieldMaskGrid from "./FieldMaskGrid.svelte";
  import ImagePicker from "./ImagePicker.svelte";
  import EpisodeRow from "./EpisodeRow.svelte";

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
    season: NormalizedSeasonResult;
    seasonState: SeasonState;
    flat: boolean;
    onSeasonAccepted: (a: boolean) => void;
    onExpand: () => void;
    onToggleField: (key: FieldKey) => void;
    onSelectPoster: (url: string | null) => void;
    onEpisodeAccepted: (episode: number, accepted: boolean) => void;
    onToggleEpisodeField: (episode: number, key: FieldKey) => void;
  }

  let {
    season,
    seasonState,
    flat,
    onSeasonAccepted,
    onExpand,
    onToggleField,
    onSelectPoster,
    onEpisodeAccepted,
    onToggleEpisodeField,
  }: Props = $props();

  const SEASON_FIELDS: Array<{ key: FieldKey; label: string }> = [
    { key: "title", label: "Title" },
    { key: "overview", label: "Overview" },
    { key: "airDate", label: "Air date" },
    { key: "externalIds", label: "External IDs" },
  ];

  const label = $derived(
    flat ? "Episodes" : season.seasonNumber === 0 ? "Specials" : `Season ${season.seasonNumber}`,
  );
  const acceptedCount = $derived(Object.values(seasonState.episodes).filter((e) => e.accepted).length);
  const totalCount = $derived(Object.values(seasonState.episodes).length);

  function episodeReviewKey(episode: NormalizedEpisodeResult, index: number): string {
    const externalId = Object.values(episode.externalIds)[0] ?? "";
    return `${episode.seasonNumber}:${episode.episodeNumber}:${externalId}:${index}`;
  }
</script>

<div class="border-b border-border-subtle/50">
  <button
    type="button"
    onclick={onExpand}
    class="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/40"
  >
    <Checkbox
      size="md"
      checked={seasonState.accepted}
      onchange={(e) => {
        e.stopPropagation();
        onSeasonAccepted((e.currentTarget as HTMLInputElement).checked);
      }}
      onclick={(e) => e.stopPropagation()}
      title="Accept this season"
    />
    <span class="flex-1 font-medium text-[0.82rem] text-text-primary">{label}</span>
    <span class="text-[0.62rem] text-text-muted">{acceptedCount} / {totalCount} accepted</span>
    <ChevronDown
      class={cn(
        "h-3 w-3 text-text-disabled transition-transform duration-fast",
        seasonState.expanded && "rotate-180",
      )}
    />
  </button>
  {#if seasonState.expanded}
    <div class="space-y-3 border-t border-border-subtle/50 bg-surface-2/20 p-4">
      <div class="flex flex-col sm:flex-row gap-4">
        <ImagePicker
          label="Season poster"
          aspect="poster"
          candidates={season.posterCandidates}
          value={seasonState.poster}
          onSelect={onSelectPoster}
          class="w-24"
        />
        <div class="min-w-0 space-y-2">
          {#if season.title && !flat}
            <p class="text-[0.72rem] font-medium text-text-primary">{season.title}</p>
          {/if}
          {#if season.airDate}
            <p class="text-[0.62rem] text-text-muted">Air date: {season.airDate}</p>
          {/if}
          {#if season.overview}
            <p class="line-clamp-3 text-[0.68rem] text-text-muted">{season.overview}</p>
          {/if}
          <FieldMaskGrid fields={SEASON_FIELDS} mask={seasonState.mask} onToggle={onToggleField} compact />
        </div>
      </div>

      <div class="space-y-1">
        {#each season.episodes as ep, episodeIndex (episodeReviewKey(ep, episodeIndex))}
          {@const epState = seasonState.episodes[ep.episodeNumber]}
          {#if epState}
            <EpisodeRow
              episode={ep}
              episodeState={epState}
              onAccepted={(a) => onEpisodeAccepted(ep.episodeNumber, a)}
              onToggleField={(k) => onToggleEpisodeField(ep.episodeNumber, k)}
            />
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>
