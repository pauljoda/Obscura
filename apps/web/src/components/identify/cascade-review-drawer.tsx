"use client";

/**
 * Cascade review drawer for the Identify tab.
 *
 * Opens from a video-folder identify row once the plugin seek has
 * produced a typed `proposedResult` in `scrape_results`. The drawer
 * discriminates on the payload shape:
 *
 *   - `NormalizedSeriesResult` → full cascade view: series header
 *     with poster/backdrop/logo pickers, disambiguation candidates,
 *     collapsible season sections (each with its own poster picker),
 *     and per-episode rows with match status and per-field checkboxes.
 *   - `NormalizedMovieResult` → compact single-movie review.
 *   - `NormalizedEpisodeResult` → compact single-episode re-identify.
 *   - Legacy folder shape or empty → fallback empty state that
 *     instructs the user to re-run the seek with a cascade-capable
 *     plugin.
 *
 * On accept, the drawer assembles a `CascadeAcceptSpec` from its
 * local checkbox / image-selection state and POSTs to the
 * appropriate `/video/{movies|series|episodes}/:id/accept-scrape`
 * endpoint from `scrape-accept.service.ts`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  NormalizedEpisodeResult,
  NormalizedMovieResult,
  NormalizedSeasonResult,
  NormalizedSeriesCandidate,
  NormalizedSeriesResult,
  ScrapeResultDto,
} from "@obscura/contracts";

type ScrapeResult = ScrapeResultDto;
import { cn } from "@obscura/ui/lib/utils";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  ScanSearch,
  X,
} from "lucide-react";
import {
  acceptVideoEpisodeScrape,
  acceptVideoMovieScrape,
  acceptVideoSeriesScrape,
  executePlugin,
  fetchScrapeResult,
  type AcceptFieldMask,
  type CascadeAcceptSpec,
  type SelectedImages,
} from "../../lib/api/scrapers";
import { fetchVideoSeriesLibraryDetail } from "../../lib/api/videos";
import { buildLocalSeasonsInput } from "./identify-video-folders-tab";
import { ImagePicker } from "./image-picker";

/* ─── Shape discrimination ───────────────────────────────────────── */

type DrawerMode =
  | { kind: "series"; result: NormalizedSeriesResult }
  | { kind: "movie"; result: NormalizedMovieResult }
  | { kind: "episode"; result: NormalizedEpisodeResult }
  | { kind: "empty"; reason: string };

/**
 * The plugin runtime writes to `proposedResult` either as a bare
 * normalized shape or as a discriminated union `{ kind, movie |
 * series | episode }` (Plan C §7.2). Accept either and collapse
 * to the same drawer mode.
 */
function classifyProposedResult(raw: unknown): DrawerMode {
  if (!raw || typeof raw !== "object") {
    return { kind: "empty", reason: "No proposed result payload on this scrape row." };
  }
  const r = raw as Record<string, unknown>;

  // Discriminated union form.
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

  // Bare-shape fallback: look for signature fields.
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

/* ─── Props ──────────────────────────────────────────────────────── */

export interface CascadeReviewDrawerProps {
  /**
   * The `scrape_results.id` whose `proposedResult` payload drives
   * the review. The drawer fetches the row on mount to get fresh
   * data.
   */
  scrapeResultId: string;
  /**
   * The video entity id that will receive the accept. Discriminated
   * by `entityKind`: for `video_series` we POST to the cascade
   * accept endpoint; for `video_movie` / `video_episode` the compact
   * single-entity endpoints.
   */
  entityKind: "video_series" | "video_movie" | "video_episode";
  entityId: string;
  /** Human-readable label for the drawer header (series title, etc.). */
  label: string;
  /** Called after a successful accept to refresh the parent row. */
  onAccepted: () => void;
  onClose: () => void;
}

/* ─── Drawer shell ───────────────────────────────────────────────── */

export function CascadeReviewDrawer({
  scrapeResultId: initialScrapeResultId,
  entityKind,
  entityId,
  label,
  onAccepted,
  onClose,
}: CascadeReviewDrawerProps) {
  // The user can re-run the plugin from inside the drawer (e.g. to
  // disambiguate a series match). Each re-run persists a new scrape
  // row, so the "current" id is tracked in state — starts as the prop
  // value and moves forward whenever `reRunWithExternalId` completes.
  const [currentScrapeResultId, setCurrentScrapeResultId] =
    useState(initialScrapeResultId);
  const [row, setRow] = useState<ScrapeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchScrapeResult(currentScrapeResultId)
      .then((r) => {
        if (!cancelled) {
          setRow(r);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentScrapeResultId]);

  const mode = useMemo<DrawerMode>(() => {
    if (!row) return { kind: "empty", reason: "Loading…" };
    return classifyProposedResult(row.proposedResult);
  }, [row]);

  /**
   * Re-run the plugin that produced this scrape result with a
   * caller-supplied override (typically `{ externalIds: { tmdb } }`
   * from a candidate pick). We round-trip through the server so the
   * new normalized payload is persisted on a fresh `scrape_results`
   * row, then point the drawer at it.
   */
  const reRunWithExternalId = useCallback(
    async (tmdbId: string) => {
      if (!row?.pluginPackageId) {
        setError("Cannot re-run — scrape row has no plugin reference.");
        return;
      }
      setRerunning(true);
      setError(null);
      try {
        const action =
          entityKind === "video_series"
            ? "folderByName"
            : entityKind === "video_movie"
              ? "movieByName"
              : "episodeByName";

        // Rebuild the localSeasons input for series re-runs so the
        // cascade plugin matches the new tmdb id against the same
        // on-disk episodes. Without this the re-run produces
        // series-only metadata and the user loses all per-episode
        // context when picking a candidate.
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

        const res = await executePlugin(
          row.pluginPackageId,
          action,
          pluginInput,
          { saveResult: true, entityId },
        );
        if (!res.ok) {
          throw new Error("Plugin returned no result for the picked candidate.");
        }
        const saved = res.result as { id?: string } | null;
        if (!saved?.id) {
          throw new Error("Plugin did not persist a scrape result.");
        }
        setCurrentScrapeResultId(saved.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Re-run failed");
      } finally {
        setRerunning(false);
      }
    },
    [row?.pluginPackageId, entityKind, entityId, label],
  );

  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-bg/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-1 flex h-full w-full max-w-3xl flex-col border-l border-border-subtle shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
              Review scrape
            </div>
            <h2 className="truncate text-base font-semibold text-text-primary">
              {label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex h-32 items-center justify-center text-text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading scrape
              result…
            </div>
          )}
          {!loading && error && (
            <div className="m-5 flex items-center gap-2 border border-status-error/30 bg-status-error/10 px-3 py-2 text-[0.72rem] text-status-error-text">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}
          {!loading && !error && mode.kind === "empty" && (
            <div className="m-5 flex items-start gap-2 border border-border-subtle bg-surface-2/50 px-3 py-3 text-[0.72rem] text-text-muted">
              <ScanSearch className="h-4 w-4 flex-shrink-0 text-text-disabled" />
              <p>{mode.reason}</p>
            </div>
          )}
          {!loading && !error && mode.kind === "series" && entityKind === "video_series" && (
            <SeriesCascadeBody
              key={currentScrapeResultId}
              result={mode.result}
              scrapeResultId={currentScrapeResultId}
              seriesId={entityId}
              rerunning={rerunning}
              onPickCandidate={(id) => void reRunWithExternalId(id)}
              onAccepted={onAccepted}
            />
          )}
          {!loading && !error && mode.kind === "movie" && entityKind === "video_movie" && (
            <MovieReviewBody
              key={currentScrapeResultId}
              result={mode.result}
              scrapeResultId={currentScrapeResultId}
              movieId={entityId}
              onAccepted={onAccepted}
            />
          )}
          {!loading &&
            !error &&
            mode.kind === "episode" &&
            entityKind === "video_episode" && (
              <EpisodeReviewBody
                key={currentScrapeResultId}
                result={mode.result}
                scrapeResultId={currentScrapeResultId}
                episodeId={entityId}
                onAccepted={onAccepted}
              />
            )}
          {!loading && !error && mode.kind !== "empty" && mode.kind !== entityKindToModeKind(entityKind) && (
            <div className="m-5 flex items-start gap-2 border border-status-warn/30 bg-status-warn/10 px-3 py-3 text-[0.72rem] text-status-warn-text">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>
                This scrape result contains a <strong>{mode.kind}</strong>{" "}
                payload, but the drawer was opened for a{" "}
                <strong>{entityKindToModeKind(entityKind)}</strong>. Re-run the
                identify from the correct entity.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function entityKindToModeKind(
  kind: CascadeReviewDrawerProps["entityKind"],
): "series" | "movie" | "episode" {
  if (kind === "video_series") return "series";
  if (kind === "video_movie") return "movie";
  return "episode";
}

/* ─── Series cascade body ────────────────────────────────────────── */

type FieldKey = keyof AcceptFieldMask;

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

const MOVIE_FIELDS: Array<{ key: FieldKey; label: string }> = [
  { key: "title", label: "Title" },
  { key: "overview", label: "Overview" },
  { key: "tagline", label: "Tagline" },
  { key: "releaseDate", label: "Release date" },
  { key: "runtime", label: "Runtime" },
  { key: "genres", label: "Genres" },
  { key: "studio", label: "Studio" },
  { key: "cast", label: "Cast" },
  { key: "rating", label: "Rating" },
  { key: "contentRating", label: "Content rating" },
  { key: "externalIds", label: "External IDs" },
];

/** All fields on by default. */
function allOn(fields: Array<{ key: FieldKey }>): AcceptFieldMask {
  return fields.reduce<AcceptFieldMask>((m, f) => {
    m[f.key] = true;
    return m;
  }, {});
}

function SeriesCascadeBody({
  result,
  scrapeResultId,
  seriesId,
  rerunning,
  onPickCandidate,
  onAccepted,
}: {
  result: NormalizedSeriesResult;
  scrapeResultId: string;
  seriesId: string;
  rerunning: boolean;
  onPickCandidate: (tmdbId: string) => void;
  onAccepted: () => void;
}) {
  // Disambiguation: if the plugin returned multiple candidates the
  // user picks one first. Picking a candidate triggers a plugin
  // re-run in the parent drawer via `onPickCandidate`; when the new
  // scrape row lands the drawer re-mounts this component (see the
  // `key={currentScrapeResultId}` on the drawer shell), so local
  // state is reset and the picker disappears automatically.
  const [pickedCandidate, setPickedCandidate] = useState<string | null>(null);

  const [seriesMask, setSeriesMask] = useState<AcceptFieldMask>(() =>
    allOn(SERIES_FIELDS),
  );
  const [selectedImages, setSelectedImages] = useState<SelectedImages>({});

  // Per-season state
  type SeasonState = {
    accepted: boolean;
    expanded: boolean;
    mask: AcceptFieldMask;
    poster: string | null | undefined;
    episodes: Record<
      number,
      {
        accepted: boolean;
        mask: AcceptFieldMask;
        still: string | null | undefined;
      }
    >;
  };

  const [seasons, setSeasons] = useState<Record<number, SeasonState>>(() => {
    const init: Record<number, SeasonState> = {};
    for (const s of result.seasons) {
      const epsInit: SeasonState["episodes"] = {};
      for (const ep of s.episodes) {
        epsInit[ep.episodeNumber] = {
          accepted: ep.matched !== false,
          mask: allOn(EPISODE_FIELDS),
          still: undefined,
        };
      }
      init[s.seasonNumber] = {
        accepted: true,
        expanded: s.seasonNumber !== 0,
        mask: allOn(SEASON_FIELDS),
        poster: undefined,
        episodes: epsInit,
      };
    }
    return init;
  });

  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function toggleSeriesField(key: FieldKey) {
    setSeriesMask((m) => ({ ...m, [key]: !m[key] }));
  }
  function setAllSeriesMask(on: boolean) {
    setSeriesMask(on ? allOn(SERIES_FIELDS) : {});
  }

  function setSeasonAccepted(n: number, accepted: boolean) {
    setSeasons((prev) => ({ ...prev, [n]: { ...prev[n], accepted } }));
  }
  function toggleSeasonExpanded(n: number) {
    setSeasons((prev) => ({
      ...prev,
      [n]: { ...prev[n], expanded: !prev[n].expanded },
    }));
  }
  function toggleSeasonField(n: number, key: FieldKey) {
    setSeasons((prev) => ({
      ...prev,
      [n]: {
        ...prev[n],
        mask: { ...prev[n].mask, [key]: !prev[n].mask[key] },
      },
    }));
  }
  function setSeasonPoster(n: number, url: string | null) {
    setSeasons((prev) => ({ ...prev, [n]: { ...prev[n], poster: url } }));
  }
  function setEpisodeAccepted(s: number, e: number, accepted: boolean) {
    setSeasons((prev) => ({
      ...prev,
      [s]: {
        ...prev[s],
        episodes: {
          ...prev[s].episodes,
          [e]: { ...prev[s].episodes[e], accepted },
        },
      },
    }));
  }
  function toggleEpisodeField(s: number, e: number, key: FieldKey) {
    setSeasons((prev) => ({
      ...prev,
      [s]: {
        ...prev[s],
        episodes: {
          ...prev[s].episodes,
          [e]: {
            ...prev[s].episodes[e],
            mask: {
              ...prev[s].episodes[e].mask,
              [key]: !prev[s].episodes[e].mask[key],
            },
          },
        },
      },
    }));
  }

  /** Flip all checkboxes on (used by the "Accept all" footer button). */
  function acceptAll() {
    setAllSeriesMask(true);
    setSeasons((prev) => {
      const next: Record<number, SeasonState> = {};
      for (const [k, v] of Object.entries(prev)) {
        const n = Number(k);
        const epsNext: SeasonState["episodes"] = {};
        for (const [ek, ev] of Object.entries(v.episodes)) {
          epsNext[Number(ek)] = {
            ...ev,
            accepted: true,
            mask: allOn(EPISODE_FIELDS),
          };
        }
        next[n] = {
          ...v,
          accepted: true,
          mask: allOn(SEASON_FIELDS),
          episodes: epsNext,
        };
      }
      return next;
    });
  }

  /** Build the cascade spec from local state and submit. */
  async function submit() {
    setBusy(true);
    setSubmitError(null);
    try {
      const seasonOverrides: NonNullable<
        CascadeAcceptSpec["seasonOverrides"]
      > = {};
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
      onAccepted();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setBusy(false);
    }
  }

  // Per §5.2, flat case = only season 0 has episodes.
  const nonZeroSeasons = result.seasons.filter((s) => s.seasonNumber > 0);
  const isFlat = nonZeroSeasons.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Disambiguation candidates */}
      {result.candidates && result.candidates.length > 0 && (
        <CandidatePicker
          candidates={result.candidates}
          picked={pickedCandidate}
          rerunning={rerunning}
          onPick={(id) => {
            setPickedCandidate(id);
            onPickCandidate(id);
          }}
        />
      )}

      {/* Series header */}
      <div className="border-b border-border-subtle p-5 space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3">
          <div className="min-w-0 space-y-2">
            <h3 className="text-lg font-semibold text-text-primary">
              {result.title}
            </h3>
            {result.originalTitle && result.originalTitle !== result.title && (
              <p className="text-[0.7rem] text-text-muted">
                {result.originalTitle}
              </p>
            )}
            {result.firstAirDate && (
              <p className="text-[0.7rem] text-text-muted">
                First aired: {result.firstAirDate}
                {result.endAirDate ? ` · Ended: ${result.endAirDate}` : ""}
              </p>
            )}
            {result.overview && (
              <p className="text-[0.72rem] text-text-muted line-clamp-4">
                {result.overview}
              </p>
            )}
            {result.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.genres.map((g) => (
                  <span
                    key={g}
                    className="tag-chip tag-chip-default text-[0.55rem]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ImagePicker
            label="Poster"
            aspect="poster"
            candidates={result.posterCandidates}
            value={selectedImages.poster ?? undefined}
            onSelect={(url) =>
              setSelectedImages((p) => ({ ...p, poster: url ?? undefined }))
            }
            className="w-28"
          />
          <ImagePicker
            label="Backdrop"
            aspect="backdrop"
            candidates={result.backdropCandidates}
            value={selectedImages.backdrop ?? undefined}
            onSelect={(url) =>
              setSelectedImages((p) => ({ ...p, backdrop: url ?? undefined }))
            }
            className="w-36"
          />
          <ImagePicker
            label="Logo"
            aspect="logo"
            candidates={result.logoCandidates}
            value={selectedImages.logo ?? undefined}
            onSelect={(url) =>
              setSelectedImages((p) => ({ ...p, logo: url ?? undefined }))
            }
            className="w-28"
          />
        </div>

        <FieldMaskGrid
          fields={SERIES_FIELDS}
          mask={seriesMask}
          onToggle={toggleSeriesField}
        />
      </div>

      {/* Seasons */}
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-bg px-5 py-2 text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
          {isFlat ? "Episodes" : `Seasons (${result.seasons.length})`}
        </div>
        {result.seasons.length === 0 && (
          <div className="px-5 py-10 text-center text-[0.72rem] text-text-muted">
            The plugin did not return any season data.
          </div>
        )}
        {result.seasons.map((season) => {
          const state = seasons[season.seasonNumber];
          if (!state) return null;
          return (
            <SeasonSection
              key={season.seasonNumber}
              season={season}
              state={state}
              flat={isFlat}
              onSeasonAccepted={(a) =>
                setSeasonAccepted(season.seasonNumber, a)
              }
              onExpand={() => toggleSeasonExpanded(season.seasonNumber)}
              onToggleField={(k) => toggleSeasonField(season.seasonNumber, k)}
              onSelectPoster={(url) => setSeasonPoster(season.seasonNumber, url)}
              onEpisodeAccepted={(e, a) =>
                setEpisodeAccepted(season.seasonNumber, e, a)
              }
              onToggleEpisodeField={(e, k) =>
                toggleEpisodeField(season.seasonNumber, e, k)
              }
            />
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
        <button
          type="button"
          onClick={acceptAll}
          disabled={busy}
          className="text-[0.7rem] text-text-accent hover:text-text-accent-bright disabled:opacity-50"
        >
          Accept all
        </button>
        {submitError && (
          <p className="flex-1 text-[0.68rem] text-status-error-text">
            {submitError}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={cn(
            "surface-card px-4 py-1.5 text-[0.72rem] font-medium hover:border-border-accent",
            busy && "opacity-50 cursor-not-allowed",
          )}
        >
          {busy ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Applying…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Check className="h-3 w-3" /> Apply cascade
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Disambiguation picker ──────────────────────────────────────── */

function CandidatePicker({
  candidates,
  picked,
  rerunning,
  onPick,
}: {
  candidates: NormalizedSeriesCandidate[];
  picked: string | null;
  rerunning: boolean;
  onPick: (externalId: string) => void;
}) {
  return (
    <div className="border-b border-border-accent/30 bg-surface-2/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
        Multiple matches — pick one
        {rerunning && (
          <span className="flex items-center gap-1 text-text-accent">
            <Loader2 className="h-3 w-3 animate-spin" /> refetching…
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {candidates.map((c) => {
          // Prefer the tmdb id specifically so the parent drawer can
          // re-run the plugin with `{ externalIds: { tmdb } }` — the
          // plugin side uses this as a direct lookup bypass.
          const id =
            c.externalIds.tmdb ??
            Object.values(c.externalIds)[0] ??
            c.title + (c.year ?? "");
          const isPicked = id === picked;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              disabled={rerunning}
              className={cn(
                "surface-card no-lift flex gap-2 p-2 text-left transition-colors",
                isPicked && "border-border-accent",
                rerunning && "opacity-50 cursor-not-allowed",
              )}
            >
              {c.posterUrl && (
                <img
                  src={c.posterUrl}
                  alt=""
                  loading="lazy"
                  className="h-16 w-12 flex-shrink-0 object-cover"
                />
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="truncate text-[0.72rem] font-medium">
                  {c.title}
                </div>
                {c.year && (
                  <div className="text-[0.6rem] text-text-muted">{c.year}</div>
                )}
                {c.overview && (
                  <div className="line-clamp-2 text-[0.6rem] text-text-muted">
                    {c.overview}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Season section ─────────────────────────────────────────────── */

function SeasonSection({
  season,
  state,
  flat,
  onSeasonAccepted,
  onExpand,
  onToggleField,
  onSelectPoster,
  onEpisodeAccepted,
  onToggleEpisodeField,
}: {
  season: NormalizedSeasonResult;
  state: {
    accepted: boolean;
    expanded: boolean;
    mask: AcceptFieldMask;
    poster: string | null | undefined;
    episodes: Record<
      number,
      {
        accepted: boolean;
        mask: AcceptFieldMask;
        still: string | null | undefined;
      }
    >;
  };
  flat: boolean;
  onSeasonAccepted: (a: boolean) => void;
  onExpand: () => void;
  onToggleField: (key: FieldKey) => void;
  onSelectPoster: (url: string | null) => void;
  onEpisodeAccepted: (episode: number, accepted: boolean) => void;
  onToggleEpisodeField: (episode: number, key: FieldKey) => void;
}) {
  const label =
    flat
      ? "Episodes"
      : season.seasonNumber === 0
        ? "Specials"
        : `Season ${season.seasonNumber}`;

  const acceptedCount = Object.values(state.episodes).filter(
    (e) => e.accepted,
  ).length;
  const totalCount = Object.values(state.episodes).length;

  return (
    <div className="border-b border-border-subtle/50">
      <button
        type="button"
        onClick={onExpand}
        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/40"
      >
        <input
          type="checkbox"
          checked={state.accepted}
          onChange={(e) => {
            e.stopPropagation();
            onSeasonAccepted(e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5"
          title="Accept this season"
        />
        <span className="flex-1 font-medium text-[0.82rem] text-text-primary">
          {label}
        </span>
        <span className="text-[0.62rem] text-text-muted">
          {acceptedCount} / {totalCount} accepted
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-text-disabled transition-transform duration-fast",
            state.expanded && "rotate-180",
          )}
        />
      </button>
      {state.expanded && (
        <div className="space-y-3 border-t border-border-subtle/50 bg-surface-2/20 p-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
            <ImagePicker
              label="Season poster"
              aspect="poster"
              candidates={season.posterCandidates}
              value={state.poster}
              onSelect={onSelectPoster}
              className="w-24"
            />
            <div className="min-w-0 space-y-2">
              {season.title && !flat && (
                <p className="text-[0.72rem] font-medium text-text-primary">
                  {season.title}
                </p>
              )}
              {season.airDate && (
                <p className="text-[0.62rem] text-text-muted">
                  Air date: {season.airDate}
                </p>
              )}
              {season.overview && (
                <p className="line-clamp-3 text-[0.68rem] text-text-muted">
                  {season.overview}
                </p>
              )}
              <FieldMaskGrid
                fields={SEASON_FIELDS}
                mask={state.mask}
                onToggle={onToggleField}
                compact
              />
            </div>
          </div>

          <div className="space-y-1">
            {season.episodes.map((ep) => {
              const epState = state.episodes[ep.episodeNumber];
              if (!epState) return null;
              return (
                <EpisodeRow
                  key={ep.episodeNumber}
                  episode={ep}
                  state={epState}
                  onAccepted={(a) => onEpisodeAccepted(ep.episodeNumber, a)}
                  onToggleField={(k) =>
                    onToggleEpisodeField(ep.episodeNumber, k)
                  }
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Episode row ────────────────────────────────────────────────── */

function EpisodeRow({
  episode,
  state,
  onAccepted,
  onToggleField,
}: {
  episode: NormalizedEpisodeResult;
  state: {
    accepted: boolean;
    mask: AcceptFieldMask;
    still: string | null | undefined;
  };
  onAccepted: (a: boolean) => void;
  onToggleField: (key: FieldKey) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const matched = episode.matched !== false;

  return (
    <div
      className={cn(
        "border border-border-subtle/40 bg-surface-2/40",
        !matched && "opacity-70",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2/60"
      >
        <input
          type="checkbox"
          checked={state.accepted}
          onChange={(e) => {
            e.stopPropagation();
            onAccepted(e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-3 w-3"
        />
        <span className="w-12 flex-shrink-0 font-mono text-[0.62rem] text-text-muted">
          {episode.seasonNumber}×{String(episode.episodeNumber).padStart(2, "0")}
        </span>
        <span className="flex-1 truncate text-[0.72rem] text-text-primary">
          {episode.title ?? <em className="text-text-muted">(no title)</em>}
        </span>
        {!matched && (
          <span className="flex items-center gap-1 text-[0.55rem] uppercase tracking-wide text-status-warn-text">
            <AlertCircle className="h-3 w-3" /> unmatched
          </span>
        )}
        {episode.localFilePath && (
          <span className="hidden max-w-[180px] truncate font-mono text-[0.55rem] text-text-disabled md:inline">
            {episode.localFilePath.split("/").pop()}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3 w-3 flex-shrink-0 text-text-disabled transition-transform duration-fast",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-border-subtle/40 p-3">
          {episode.overview && (
            <p className="text-[0.68rem] text-text-muted line-clamp-3">
              {episode.overview}
            </p>
          )}
          {episode.airDate && (
            <p className="text-[0.6rem] text-text-muted">
              Air date: {episode.airDate}
            </p>
          )}
          <FieldMaskGrid
            fields={EPISODE_FIELDS}
            mask={state.mask}
            onToggle={onToggleField}
            compact
          />
        </div>
      )}
    </div>
  );
}

/* ─── Field-mask checkbox grid ───────────────────────────────────── */

function FieldMaskGrid({
  fields,
  mask,
  onToggle,
  compact = false,
}: {
  fields: Array<{ key: FieldKey; label: string }>;
  mask: AcceptFieldMask;
  onToggle: (key: FieldKey) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-1.5",
        compact
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
      )}
    >
      {fields.map((f) => (
        <label
          key={f.key}
          className="flex items-center gap-1.5 text-[0.65rem] text-text-muted"
        >
          <input
            type="checkbox"
            checked={!!mask[f.key]}
            onChange={() => onToggle(f.key)}
            className="h-3 w-3"
          />
          <span>{f.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ─── Movie review body (compact) ────────────────────────────────── */

function MovieReviewBody({
  result,
  scrapeResultId,
  movieId,
  onAccepted,
}: {
  result: NormalizedMovieResult;
  scrapeResultId: string;
  movieId: string;
  onAccepted: () => void;
}) {
  const [mask, setMask] = useState<AcceptFieldMask>(() => allOn(MOVIE_FIELDS));
  const [selectedImages, setSelectedImages] = useState<SelectedImages>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleField(k: FieldKey) {
    setMask((m) => ({ ...m, [k]: !m[k] }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await acceptVideoMovieScrape(movieId, {
        scrapeResultId,
        fieldMask: mask,
        selectedImages,
      });
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3">
          <div className="min-w-0 space-y-2">
            <h3 className="text-lg font-semibold text-text-primary">
              {result.title}
            </h3>
            {result.originalTitle && result.originalTitle !== result.title && (
              <p className="text-[0.7rem] text-text-muted">
                {result.originalTitle}
              </p>
            )}
            {result.releaseDate && (
              <p className="text-[0.7rem] text-text-muted">
                Released: {result.releaseDate}
                {result.runtime ? ` · ${result.runtime}min` : ""}
              </p>
            )}
            {result.overview && (
              <p className="text-[0.72rem] text-text-muted line-clamp-5">
                {result.overview}
              </p>
            )}
            {result.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.genres.map((g) => (
                  <span
                    key={g}
                    className="tag-chip tag-chip-default text-[0.55rem]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ImagePicker
            label="Poster"
            aspect="poster"
            candidates={result.posterCandidates}
            value={selectedImages.poster ?? undefined}
            onSelect={(url) =>
              setSelectedImages((p) => ({ ...p, poster: url ?? undefined }))
            }
            className="w-28"
          />
          <ImagePicker
            label="Backdrop"
            aspect="backdrop"
            candidates={result.backdropCandidates}
            value={selectedImages.backdrop ?? undefined}
            onSelect={(url) =>
              setSelectedImages((p) => ({ ...p, backdrop: url ?? undefined }))
            }
            className="w-36"
          />
        </div>
        <FieldMaskGrid fields={MOVIE_FIELDS} mask={mask} onToggle={toggleField} />
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-5 py-3">
        {error && (
          <p className="flex-1 text-[0.68rem] text-status-error-text">{error}</p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={cn(
            "surface-card px-4 py-1.5 text-[0.72rem] font-medium hover:border-border-accent",
            busy && "opacity-50 cursor-not-allowed",
          )}
        >
          {busy ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Applying…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Check className="h-3 w-3" /> Apply
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Episode review body (compact) ──────────────────────────────── */

function EpisodeReviewBody({
  result,
  scrapeResultId,
  episodeId,
  onAccepted,
}: {
  result: NormalizedEpisodeResult;
  scrapeResultId: string;
  episodeId: string;
  onAccepted: () => void;
}) {
  const [mask, setMask] = useState<AcceptFieldMask>(() => allOn(EPISODE_FIELDS));
  const [selectedImages, setSelectedImages] = useState<SelectedImages>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleField(k: FieldKey) {
    setMask((m) => ({ ...m, [k]: !m[k] }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await acceptVideoEpisodeScrape(episodeId, {
        scrapeResultId,
        fieldMask: mask,
        selectedImages,
      });
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div className="min-w-0 space-y-2">
            <h3 className="text-lg font-semibold text-text-primary">
              {result.title ?? <em>(no title)</em>}
            </h3>
            <p className="font-mono text-[0.65rem] text-text-muted">
              {result.seasonNumber}×
              {String(result.episodeNumber).padStart(2, "0")}
            </p>
            {result.airDate && (
              <p className="text-[0.7rem] text-text-muted">
                Aired: {result.airDate}
                {result.runtime ? ` · ${result.runtime}min` : ""}
              </p>
            )}
            {result.overview && (
              <p className="text-[0.72rem] text-text-muted line-clamp-5">
                {result.overview}
              </p>
            )}
          </div>
          <ImagePicker
            label="Still"
            aspect="still"
            candidates={result.stillCandidates}
            value={selectedImages.still ?? undefined}
            onSelect={(url) =>
              setSelectedImages((p) => ({ ...p, still: url ?? undefined }))
            }
            className="w-36"
          />
        </div>
        <FieldMaskGrid
          fields={EPISODE_FIELDS}
          mask={mask}
          onToggle={toggleField}
        />
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-5 py-3">
        {error && (
          <p className="flex-1 text-[0.68rem] text-status-error-text">{error}</p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={cn(
            "surface-card px-4 py-1.5 text-[0.72rem] font-medium hover:border-border-accent",
            busy && "opacity-50 cursor-not-allowed",
          )}
        >
          {busy ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Applying…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Check className="h-3 w-3" /> Apply
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
