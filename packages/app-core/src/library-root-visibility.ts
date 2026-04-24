import path from "node:path";
import { sql, type Column, type SQL } from "drizzle-orm";

export interface LibraryRootVisibilityRow {
  id: string;
  path: string;
  enabled: boolean;
  scanVideos: boolean;
  scanImages: boolean;
  scanAudio: boolean;
}

export interface ActiveLibraryRootsSummary {
  videoRootIds: string[];
  imageRootPaths: string[];
  audioRootPaths: string[];
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function getRootScopedPath(filePath: string) {
  return filePath.includes("::") ? (filePath.split("::")[0] ?? filePath) : filePath;
}

function pathMatchesRootSql(pathColumn: Column | SQL, rootPathExpr: SQL) {
  return sql`(
    ${pathColumn} = ${rootPathExpr}
    OR ${pathColumn} LIKE (${rootPathExpr} || '/%')
    OR ${pathColumn} LIKE (${rootPathExpr} || '::%')
  )`;
}

export function summarizeActiveLibraryRoots(
  roots: LibraryRootVisibilityRow[],
): ActiveLibraryRootsSummary {
  const enabledRoots = roots.filter((root) => root.enabled);

  return {
    videoRootIds: unique(
      enabledRoots.filter((root) => root.scanVideos).map((root) => root.id),
    ),
    imageRootPaths: unique(
      enabledRoots.filter((root) => root.scanImages).map((root) => root.path),
    ),
    audioRootPaths: unique(
      enabledRoots.filter((root) => root.scanAudio).map((root) => root.path),
    ),
  };
}

export function isPathVisibleForRoots(
  filePath: string | null | undefined,
  rootPaths: string[],
) {
  if (!filePath || rootPaths.length === 0) return false;

  const candidate = path.resolve(getRootScopedPath(filePath));

  return rootPaths.some((rootPath) => {
    const resolvedRoot = path.resolve(rootPath);
    return (
      candidate === resolvedRoot ||
      candidate.startsWith(`${resolvedRoot}${path.sep}`)
    );
  });
}

function videoVisibleByRootSql(libraryRootIdColumn: Column | SQL) {
  return sql`EXISTS (
    SELECT 1
    FROM library_roots lr
    WHERE lr.id = ${libraryRootIdColumn}
      AND lr.enabled IS TRUE
      AND lr.scan_videos IS TRUE
  )`;
}

export function videoMovieVisibleSql(libraryRootIdColumn: Column | SQL) {
  return videoVisibleByRootSql(libraryRootIdColumn);
}

export function videoSeriesVisibleSql(libraryRootIdColumn: Column | SQL) {
  return videoVisibleByRootSql(libraryRootIdColumn);
}

export function videoEpisodeVisibleSql(seriesIdColumn: Column | SQL) {
  return sql`EXISTS (
    SELECT 1
    FROM video_series vs
    INNER JOIN library_roots lr ON lr.id = vs.library_root_id
    WHERE vs.id = ${seriesIdColumn}
      AND lr.enabled IS TRUE
      AND lr.scan_videos IS TRUE
  )`;
}

export function imageVisibleSql(filePathColumn: Column | SQL) {
  const rootPath = sql.raw("lr.path");
  return sql`EXISTS (
    SELECT 1
    FROM library_roots lr
    WHERE lr.enabled IS TRUE
      AND lr.scan_images IS TRUE
      AND ${pathMatchesRootSql(filePathColumn, rootPath)}
  )`;
}

export function galleryVisibleSql(
  folderPathColumn: Column | SQL,
  zipFilePathColumn: Column | SQL,
) {
  const rootPath = sql.raw("lr.path");
  return sql`(
    (${folderPathColumn} IS NULL AND ${zipFilePathColumn} IS NULL)
    OR EXISTS (
      SELECT 1
      FROM library_roots lr
      WHERE lr.enabled IS TRUE
        AND lr.scan_images IS TRUE
        AND (
          (${folderPathColumn} IS NOT NULL AND ${pathMatchesRootSql(folderPathColumn, rootPath)})
          OR (${zipFilePathColumn} IS NOT NULL AND ${pathMatchesRootSql(zipFilePathColumn, rootPath)})
        )
    )
  )`;
}

export function audioLibraryVisibleSql(folderPathColumn: Column | SQL) {
  const rootPath = sql.raw("lr.path");
  return sql`(
    ${folderPathColumn} IS NULL
    OR EXISTS (
      SELECT 1
      FROM library_roots lr
      WHERE lr.enabled IS TRUE
        AND lr.scan_audio IS TRUE
        AND ${pathMatchesRootSql(folderPathColumn, rootPath)}
    )
  )`;
}

export function audioTrackVisibleSql(filePathColumn: Column | SQL) {
  const rootPath = sql.raw("lr.path");
  return sql`EXISTS (
    SELECT 1
    FROM library_roots lr
    WHERE lr.enabled IS TRUE
      AND lr.scan_audio IS TRUE
      AND ${pathMatchesRootSql(filePathColumn, rootPath)}
  )`;
}
