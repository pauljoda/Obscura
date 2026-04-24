/**
 * Filesystem helpers for library root management. `verifyDirectory` is
 * used before inserting or updating a library root. `browseDirectories`
 * powers the directory picker UI.
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export async function verifyDirectory(targetPath: string) {
  const stats = await stat(targetPath);
  if (!stats.isDirectory()) {
    throw new Error("Path is not a directory");
  }
}

export async function browseDirectories(rawPath?: string) {
  const resolvedPath = path.resolve(rawPath?.trim() || process.cwd());
  await verifyDirectory(resolvedPath);

  const entries = await readdir(resolvedPath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(resolvedPath, entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const parentPath = path.dirname(resolvedPath);

  return {
    path: resolvedPath,
    parentPath: parentPath === resolvedPath ? null : parentPath,
    directories,
  };
}

export function labelForPath(targetPath: string) {
  const base = path.basename(targetPath);
  return base || targetPath;
}
