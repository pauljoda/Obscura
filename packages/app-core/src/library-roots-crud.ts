/**
 * Library roots CRUD helpers for the first-party API surface. The file
 * verification step is threaded in as a dep so callers can override it if
 * needed, though the shared `verifyDirectory` helper is the default.
 */
import { schema, type AppDb } from "@obscura/db";
import { and, asc, eq, or, type SQL } from "drizzle-orm";
import path from "node:path";
import { labelForPath, verifyDirectory } from "./library-browse";
import { syncMediaNsfwWithLibraryRoot } from "./library-root-nsfw-sync";

const { libraryRoots } = schema;

type LibraryRootRow = typeof libraryRoots.$inferSelect;

export interface ListLibrariesQuery {
  scanVideos?: string;
  scanImages?: string;
  scanAudio?: string;
  enabled?: string;
}

function parseBool(v: string | undefined): boolean | null {
  if (v == null) return null;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return null;
}

export async function listLibraryRootsRead(
  db: AppDb,
  query: ListLibrariesQuery,
): Promise<{ roots: LibraryRootRow[] }> {
  const scanVideos = parseBool(query.scanVideos);
  const scanImages = parseBool(query.scanImages);
  const scanAudio = parseBool(query.scanAudio);
  const enabled = parseBool(query.enabled);

  const filters: SQL[] = [];
  // Legacy `scanVideos` alias: `=true` matches roots with at least one of
  // scan_movies / scan_series on (OR), `=false` requires both off (AND).
  if (scanVideos === true) {
    filters.push(
      or(
        eq(libraryRoots.scanMovies, true),
        eq(libraryRoots.scanSeries, true),
      )!,
    );
  }
  if (scanVideos === false) {
    filters.push(
      and(
        eq(libraryRoots.scanMovies, false),
        eq(libraryRoots.scanSeries, false),
      )!,
    );
  }
  if (scanImages != null) filters.push(eq(libraryRoots.scanImages, scanImages));
  if (scanAudio != null) filters.push(eq(libraryRoots.scanAudio, scanAudio));
  if (enabled != null) filters.push(eq(libraryRoots.enabled, enabled));

  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const roots = await db
    .select()
    .from(libraryRoots)
    .where(whereClause)
    .orderBy(asc(libraryRoots.path));
  return { roots };
}

export interface CreateLibraryRootBody {
  path: string;
  label?: string;
  enabled?: boolean;
  recursive?: boolean;
  scanVideos?: boolean;
  scanMovies?: boolean;
  scanSeries?: boolean;
  scanImages?: boolean;
  scanAudio?: boolean;
}

export async function createLibraryRootWrite(
  db: AppDb,
  body: CreateLibraryRootBody,
): Promise<LibraryRootRow> {
  const resolvedPath = path.resolve(body.path);
  await verifyDirectory(resolvedPath);

  const videoAlias = body.scanVideos;
  const [created] = await db
    .insert(libraryRoots)
    .values({
      path: resolvedPath,
      label: body.label?.trim() || labelForPath(resolvedPath),
      enabled: body.enabled ?? true,
      recursive: body.recursive ?? true,
      scanMovies: body.scanMovies ?? videoAlias ?? true,
      scanSeries: body.scanSeries ?? videoAlias ?? true,
      scanImages: body.scanImages ?? true,
      scanAudio: body.scanAudio ?? true,
    })
    .returning();
  return created;
}

export interface UpdateLibraryRootBody {
  path?: string;
  label?: string;
  enabled?: boolean;
  recursive?: boolean;
  scanVideos?: boolean;
  scanMovies?: boolean;
  scanSeries?: boolean;
  scanImages?: boolean;
  scanAudio?: boolean;
  isNsfw?: boolean;
}

export class LibraryRootNotFoundError extends Error {
  constructor() {
    super("Library root not found");
    this.name = "LibraryRootNotFoundError";
  }
}

export async function updateLibraryRootWrite(
  db: AppDb,
  id: string,
  body: UpdateLibraryRootBody,
): Promise<LibraryRootRow> {
  const [existing] = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.id, id));
  if (!existing) throw new LibraryRootNotFoundError();

  const nextPath = body.path ? path.resolve(body.path) : existing.path;
  if (body.path) {
    await verifyDirectory(nextPath);
  }

  const videoAlias = body.scanVideos;

  const [updated] = await db
    .update(libraryRoots)
    .set({
      path: nextPath,
      label: body.label?.trim() || existing.label,
      enabled: body.enabled ?? existing.enabled,
      recursive: body.recursive ?? existing.recursive,
      scanMovies: body.scanMovies ?? videoAlias ?? existing.scanMovies,
      scanSeries: body.scanSeries ?? videoAlias ?? existing.scanSeries,
      scanImages: body.scanImages ?? existing.scanImages,
      scanAudio: body.scanAudio ?? existing.scanAudio,
      isNsfw: body.isNsfw ?? existing.isNsfw,
      updatedAt: new Date(),
    })
    .where(eq(libraryRoots.id, id))
    .returning();

  if (updated && body.isNsfw !== undefined) {
    const prevNsfw = existing.isNsfw === true;
    const nextNsfw = updated.isNsfw === true;
    if (prevNsfw !== nextNsfw) {
      await syncMediaNsfwWithLibraryRoot(db, updated.path, nextNsfw);
    }
  }

  return updated;
}

export async function deleteLibraryRootWrite(
  db: AppDb,
  id: string,
): Promise<{ ok: true }> {
  const [deleted] = await db
    .delete(libraryRoots)
    .where(eq(libraryRoots.id, id))
    .returning();
  if (!deleted) throw new LibraryRootNotFoundError();
  return { ok: true as const };
}
