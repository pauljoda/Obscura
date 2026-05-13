<script lang="ts">
  import { AlertCircle, ScanSearch } from "@lucide/svelte";
  import type {
    NormalizedEpisodeResult,
    NormalizedMovieResult,
    NormalizedSeriesResult,
  } from "@obscura/contracts";
  import type { ScrapeResult } from "$lib/v1/api/types-v1";
  import { executePlugin, fetchScrapeResult } from "$lib/v1/api/scrapers-v1";
  import { fetchVideoSeriesLibraryDetail } from "$lib/v1/api/videos-v1";
  import { buildLocalSeasonsInput } from "$lib/v1/identify/identify-video-series-runner-v1";
  import ReviewDrawer from "./ReviewDrawerV1.svelte";
  import SeriesCascadeBody from "./SeriesCascadeBodyV1.svelte";
  import MovieReviewBody from "./MovieReviewBodyV1.svelte";
  import EpisodeReviewBody from "./EpisodeReviewBodyV1.svelte";

  type DrawerMode =
    | { kind: "series"; result: NormalizedSeriesResult }
    | { kind: "movie"; result: NormalizedMovieResult }
    | { kind: "episode"; result: NormalizedEpisodeResult }
    | { kind: "empty"; reason: string };

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

  let overrideScrapeResult = $state<{ baseId: string; id: string } | null>(null);
  const currentScrapeResultId = $derived(
    overrideScrapeResult?.baseId === scrapeResultId
      ? overrideScrapeResult.id
      : scrapeResultId,
  );
  let row = $state<ScrapeResult | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let rerunning = $state(false);

  function classifyProposedResult(raw: unknown): DrawerMode {
    if (!raw || typeof raw !== "object") {
      return { kind: "empty", reason: "No proposed result payload on this scrape row." };
    }
    const r = raw as Record<string, unknown>;

    if (typeof r.kind === "string") {
      if (r.kind === "series" && r.series && typeof r.series === "object") {
        return { kind: "series", result: r.series as NormalizedSeriesResult };
      }
      if (r.kind === "movie" && r.movie && typeof r.movie === "object") {
        return { kind: "movie", result: r.movie as NormalizedMovieResult };
      }
      if (r.kind === "episode" && r.episode && typeof r.episode === "object") {
        return { kind: "episode", result: r.episode as NormalizedEpisodeResult };
      }
    }

    if ("seasons" in r || "firstAirDate" in r || "endAirDate" in r) {
      return { kind: "series", result: r as unknown as NormalizedSeriesResult };
    }
    if ("episodeNumber" in r && "seasonNumber" in r) {
      return { kind: "episode", result: r as unknown as NormalizedEpisodeResult };
    }
    if ("title" in r && ("releaseDate" in r || "runtime" in r)) {
      return { kind: "movie", result: r as unknown as NormalizedMovieResult };
    }

    return {
      kind: "empty",
      reason:
        "The scrape result does not match a typed movie / series / episode shape. Re-run with a plugin that supports seriesCascade to populate this view.",
    };
  }

  function entityKindToModeKind(
    kind: "video_series" | "video_movie" | "video_episode",
  ): "series" | "movie" | "episode" {
    if (kind === "video_series") return "series";
    if (kind === "video_movie") return "movie";
    return "episode";
  }

  async function loadRow(id: string) {
    loading = true;
    error = null;
    try {
      row = await fetchScrapeResult(id);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void loadRow(currentScrapeResultId);
  });

  async function reRunWithExternalId(tmdbId: string) {
    if (!row?.pluginPackageId) {
      error = "Cannot re-run — scrape row has no plugin reference.";
      return;
    }
    rerunning = true;
    error = null;
    try {
      const action =
        entityKind === "video_series"
          ? "folderByName"
          : entityKind === "video_movie"
            ? "movieByName"
            : "episodeByName";

      let pluginInput: Record<string, unknown> = {
        title: label,
        name: label,
        externalIds: { tmdb: tmdbId },
      };
      if (entityKind === "video_series") {
        try {
          const detail = await fetchVideoSeriesLibraryDetail(entityId);
          const extra = buildLocalSeasonsInput(detail);
          if (extra) pluginInput = { ...pluginInput, ...extra };
        } catch {
          // fall through — metadata-only re-run is better than no re-run
        }
      }

      const res = await executePlugin(row.pluginPackageId, action, pluginInput, {
        saveResult: true,
        entityId,
      });
      if (!res.ok) {
        throw new Error("Plugin returned no result for the picked candidate.");
      }
      const saved = res.result as { id?: string } | null;
      if (!saved?.id) {
        throw new Error("Plugin did not persist a scrape result.");
      }
      overrideScrapeResult = { baseId: scrapeResultId, id: saved.id };
    } catch (err) {
      error = err instanceof Error ? err.message : "Re-run failed";
    } finally {
      rerunning = false;
    }
  }

  const mode = $derived<DrawerMode>(
    row ? classifyProposedResult(row.proposedResult) : { kind: "empty", reason: "Loading…" },
  );
  const expectedKind = $derived(entityKindToModeKind(entityKind));
</script>

<ReviewDrawer
  {label}
  {onClose}
  {onNext}
  {onPrev}
  {hasNext}
  {hasPrev}
  {loading}
  {error}
>
  {#snippet children()}
    {#if mode.kind === "empty"}
      <div
        class="m-5 flex items-start gap-2 border border-border-subtle bg-surface-2/50 px-3 py-3 text-[0.72rem] text-text-muted"
      >
        <ScanSearch class="h-4 w-4 flex-shrink-0 text-text-disabled" />
        <p>{mode.reason}</p>
      </div>
    {:else if mode.kind === "series" && entityKind === "video_series"}
      {#key currentScrapeResultId}
        <SeriesCascadeBody
          result={mode.result}
          scrapeResultId={currentScrapeResultId}
          seriesId={entityId}
          {rerunning}
          onPickCandidate={(id) => void reRunWithExternalId(id)}
          {onAccepted}
          {onAcceptAndNext}
        />
      {/key}
    {:else if mode.kind === "movie" && entityKind === "video_movie"}
      {#key currentScrapeResultId}
        <MovieReviewBody
          result={mode.result}
          scrapeResultId={currentScrapeResultId}
          movieId={entityId}
          {onAccepted}
          {onAcceptAndNext}
        />
      {/key}
    {:else if mode.kind === "episode" && entityKind === "video_episode"}
      {#key currentScrapeResultId}
        <EpisodeReviewBody
          result={mode.result}
          scrapeResultId={currentScrapeResultId}
          episodeId={entityId}
          {onAccepted}
          {onAcceptAndNext}
        />
      {/key}
    {:else if mode.kind !== expectedKind}
      <div
        class="m-5 flex items-start gap-2 border border-status-warning/30 bg-status-warning/10 px-3 py-3 text-[0.72rem] text-status-warning-text"
      >
        <AlertCircle class="h-4 w-4 flex-shrink-0" />
        <p>
          This scrape result contains a <strong>{mode.kind}</strong> payload, but the drawer
          was opened for a <strong>{expectedKind}</strong>. Re-run the identify from the
          correct entity.
        </p>
      </div>
    {/if}
  {/snippet}
</ReviewDrawer>
