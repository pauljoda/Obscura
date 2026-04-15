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

  const series = normalizeSeriesResult(result);
  if (series) return { ...series };

  const movie = normalizeMovieResult(result);
  if (movie) return { ...movie };

  const episode = normalizeEpisodeResult(result);
  if (episode) return { kind: "episode", episode };

  return null;
}
