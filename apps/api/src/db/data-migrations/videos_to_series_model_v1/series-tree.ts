import path from "node:path";
import type { VideoClassificationEpisode } from "@obscura/media-core";

export interface SeriesTreeNode {
  libraryRootPath: string;
  folderPath: string;
  folderName: string;
  /** Relative path from library root, using forward slashes. */
  relativePath: string;
  seasons: Map<number, SeasonTreeNode>;
}

export interface SeasonTreeNode {
  seasonNumber: number;
  /** Null for flat-series synthetic season 0. */
  folderPath: string | null;
  folderName: string | null;
  episodes: VideoClassificationEpisode[];
}

/**
 * Group classified episode files into a series tree keyed by
 * `seriesFolderPath`. Each series has seasons keyed by
 * `placementSeasonNumber`. Episodes land in the matching season.
 */
export function buildSeriesTree(
  episodes: VideoClassificationEpisode[],
): Map<string, SeriesTreeNode> {
  const tree = new Map<string, SeriesTreeNode>();

  for (const episode of episodes) {
    let series = tree.get(episode.seriesFolderPath);
    if (!series) {
      series = {
        libraryRootPath: episode.libraryRootPath,
        folderPath: episode.seriesFolderPath,
        folderName: episode.seriesFolderName,
        relativePath: path
          .relative(episode.libraryRootPath, episode.seriesFolderPath)
          .split(path.sep)
          .join("/"),
        seasons: new Map(),
      };
      tree.set(episode.seriesFolderPath, series);
    }

    let season = series.seasons.get(episode.placementSeasonNumber);
    if (!season) {
      season = {
        seasonNumber: episode.placementSeasonNumber,
        folderPath: episode.seasonFolderPath,
        folderName: episode.seasonFolderName,
        episodes: [],
      };
      series.seasons.set(episode.placementSeasonNumber, season);
    } else if (!season.folderPath && episode.seasonFolderPath) {
      // Prefer a concrete season folder if we encounter one later.
      season.folderPath = episode.seasonFolderPath;
      season.folderName = episode.seasonFolderName;
    }

    season.episodes.push(episode);
  }

  return tree;
}
