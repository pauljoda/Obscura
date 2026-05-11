/**
 * Library roots CRUD helpers for the first-party API surface. The file
 * verification step is threaded in as a dep so callers can override it if
 * needed, though the shared `verifyDirectory` helper is the default.
 */
import { schema, type AppDb } from "@obscura/db";
import { and, asc, eq, type SQL } from "drizzle-orm";
import path from "node:path";
import { labelForPath, verifyDirectory } from "./library-browse";
import { syncMediaNsfwWithLibraryRoot } from "./library-root-nsfw-sync";

const { libraryRoots } = schema;

type LibraryRootRow = typeof libraryRoots.$inferSelect;

export interface ListLibrariesQuery {
  scanVideos?: string;
  scanImages?: string;
  scanAudio?: string;
  scanBooks?: string;
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
  const scanBooks = parseBool(query.scanBooks);
  const enabled = parseBool(query.enabled);

  const filters: SQL[] = [];
  if (scanVideos != null) filters.push(eq(libraryRoots.scanVideos, scanVideos));
  if (scanImages != null) filters.push(eq(libraryRoots.scanImages, scanImages));
  if (scanAudio != null) filters.push(eq(libraryRoots.scanAudio, scanAudio));
  if (scanBooks != null) filters.push(eq(libraryRoots.scanBooks, scanBooks));
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
  scanImages?: boolean;
  scanAudio?: boolean;
  scanBooks?: boolean;
}

export async function createLibraryRootWrite(
  db: AppDb,
  body: CreateLibraryRootBody,
): Promise<LibraryRootRow> {
  const resolvedPath = path.resolve(body.path);
  await verifyDirectory(resolvedPath);

  const [created] = await db
    .insert(libraryRoots)
    .values({
      path: resolvedPath,
      label: body.label?.trim() || labelForPath(resolvedPath),
      enabled: body.enabled ?? true,
      recursive: body.recursive ?? true,
      scanVideos: body.scanVideos ?? true,
      scanImages: body.scanImages ?? true,
      scanAudio: body.scanAudio ?? true,
      scanBooks: body.scanBooks ?? false,
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
  scanImages?: boolean;
  scanAudio?: boolean;
  scanBooks?: boolean;
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

  const [updated] = await db
    .update(libraryRoots)
    .set({
      path: nextPath,
      label: body.label?.trim() || existing.label,
      enabled: body.enabled ?? existing.enabled,
      recursive: body.recursive ?? existing.recursive,
      scanVideos: body.scanVideos ?? existing.scanVideos,
      scanImages: body.scanImages ?? existing.scanImages,
      scanAudio: body.scanAudio ?? existing.scanAudio,
      scanBooks: body.scanBooks ?? existing.scanBooks,
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
