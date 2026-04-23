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
 * `scrape_results.proposed_result` for the review drawers.
 *
 * Accepts either a bare normalized shape or the discriminated
 * `{ kind, series | movie | episode }` wrapper.
 */
export function deriveProposedResultFromPluginOutput(
  result: unknown,
): Record<string, unknown> | null {
  if (!isRecord(result)) return null;

  if (result.kind === "series" && isRecord(result.series)) {
    const normalized = normalizeSeriesResult(result.series);
    return normalized ? { ...normalized } : null;
  }

  if (result.kind === "movie" && isRecord(result.movie)) {
    const normalized = normalizeMovieResult(result.movie);
    return normalized ? { ...normalized } : null;
  }

  if (result.kind === "episode" && isRecord(result.episode)) {
    const normalized = normalizeEpisodeResult(result.episode);
    return normalized ? { kind: "episode", episode: normalized } : null;
  }

  // Route bare payloads by the strongest signature first so movie and
  // episode results do not get misclassified as a generic series blob.
  const hasMovieSignature =
    typeof result.releaseDate === "string" || typeof result.runtime === "number";
  const hasEpisodeSignature =
    typeof result.seasonNumber === "number" &&
    typeof result.episodeNumber === "number";
  const hasSeriesSignature =
    Array.isArray(result.seasons) ||
    typeof result.firstAirDate === "string" ||
    Array.isArray(result.candidates);

  if (hasEpisodeSignature && !hasSeriesSignature) {
    const normalized = normalizeEpisodeResult(result);
    if (normalized) return { kind: "episode", episode: normalized };
  }

  if (hasMovieSignature && !hasSeriesSignature) {
    const normalized = normalizeMovieResult(result);
    if (normalized) return { ...normalized };
  }

  const series = normalizeSeriesResult(result);
  if (series) return { ...series };

  const movie = normalizeMovieResult(result);
  if (movie) return { ...movie };

  const episode = normalizeEpisodeResult(result);
  if (episode) return { kind: "episode", episode };

  return null;
}
