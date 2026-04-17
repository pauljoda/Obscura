import {
  normalizeEpisodeResult,
  normalizeMovieResult,
  normalizeSeriesResult,
} from "@obscura/plugins";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Turn a plugin execute() return value into the JSON we persist on
 * `scrape_results.proposed_result` for the cascade review drawer.
 *
 * Accepts either a bare `Normalized*` shape or the Plan C discriminated
 * `{ kind, series | movie | episode }` wrapper.
 */
export function deriveProposedResultFromPluginOutput(
  result: unknown,
): Record<string, unknown> | null {
  if (!isRecord(result)) return null;

  if (result.kind === "series" && isRecord(result.series)) {
    const n = normalizeSeriesResult(result.series);
    return n ? { ...n } : null;
  }
  if (result.kind === "movie" && isRecord(result.movie)) {
    const n = normalizeMovieResult(result.movie);
    return n ? { ...n } : null;
  }
  if (result.kind === "episode" && isRecord(result.episode)) {
    const n = normalizeEpisodeResult(result.episode);
    return n ? { kind: "episode", episode: n } : null;
  }

  // Bare-shape routing. `normalizeSeriesResult` only requires `title`
  // to succeed, so a bare TMDB movie payload (which emits `releaseDate`
  // / `runtime` but no `seasons`) would land here as a series with an
  // empty `seasons: []` array. The cascade drawer then classifies by
  // presence of `seasons` and shows a "movie vs series" mismatch.
  // Route to movie first when the payload carries movie-specific
  // signatures, and to episode when per-episode placement is set, so
  // the drawer's classifier and this derivation agree.
  const hasMovieSignature =
    typeof result.releaseDate === "string" ||
    typeof result.runtime === "number";
  const hasEpisodeSignature =
    typeof result.seasonNumber === "number" &&
    typeof result.episodeNumber === "number";
  const hasSeriesSignature =
    Array.isArray(result.seasons) ||
    typeof result.firstAirDate === "string" ||
    Array.isArray(result.candidates);

  if (hasEpisodeSignature && !hasSeriesSignature) {
    const episode = normalizeEpisodeResult(result);
    if (episode) return { kind: "episode", episode };
  }
  if (hasMovieSignature && !hasSeriesSignature) {
    const movie = normalizeMovieResult(result);
    if (movie) return { ...movie };
  }

  const series = normalizeSeriesResult(result);
  if (series) return { ...series };

  const movie = normalizeMovieResult(result);
  if (movie) return { ...movie };

  const episode = normalizeEpisodeResult(result);
  if (episode) return { kind: "episode", episode };

  return null;
}
