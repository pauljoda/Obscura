import path from "node:path";
import { existsSync } from "node:fs";
import { readdir, readFile, rename } from "node:fs/promises";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import {
  discoverImageFilesAndDirs,
  duplicatedBookVolumeFolderNameRepair,
  extractComicInfoFromZip,
  fileNameToTitle,
  parseZipImageMembers,
  type ComicInfoMetadata,
} from "@obscura/media-core";
import {
  findOrCreatePerformerId,
  findOrCreateStudioId,
  findOrCreateTagId,
  listIgnoredMediaPathsUnderRoot,
  markLinkedMetadataNsfwForLibraryRoot,
} from "@obscura/app-core";
import {
  db,
  libraryRoots,
  books,
  bookVolumes,
  bookChapters,
  bookPages,
  bookPerformers,
  bookTags,
} from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";
import { enqueueCollectionRefreshAll, enqueuePendingBookPageJob } from "../lib/enqueue.js";
import { inferComicBookArchivePlan, isSupportedComicBookArchive } from "./book-scan-utils.js";

async function attachBookRelations(
  bookId: string,
  comicInfo: ComicInfoMetadata | null,
  isNsfw: boolean,
) {
  if (!comicInfo) return;

  for (const name of comicInfo.creators) {
    const performerId = await findOrCreatePerformerId(db, name, { isNsfw });
    await db.insert(bookPerformers).values({ bookId, performerId }).onConflictDoNothing();
  }

  for (const name of comicInfo.tags) {
    const tagId = await findOrCreateTagId(db, name, { isNsfw });
    await db.insert(bookTags).values({ bookId, tagId }).onConflictDoNothing();
  }
}

function comicInfoMarksNsfw(comicInfo: ComicInfoMetadata | null) {
  if (!comicInfo) return false;
  const candidates = [
    comicInfo.ageRating,
    comicInfo.manga,
    ...comicInfo.tags,
  ].map((value) => value?.toLowerCase() ?? "");
  return candidates.some((value) =>
    /adult|adults only|18\+|mature|explicit|erotic|hentai|nsfw|porn/.test(value),
  );
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim().length > 0)?.trim();
}

function resolveBookFolderPath(
  rootPath: string,
  plan: ReturnType<typeof inferComicBookArchivePlan>,
  archivePath: string,
) {
  if (plan.bookRelativePath && plan.bookRelativePath !== plan.relativePath) {
    return path.join(rootPath, plan.bookRelativePath);
  }
  return path.dirname(archivePath);
}

interface VolumeFolderRepair {
  fromPath: string;
  toPath: string;
  fromRelativePath: string;
  toRelativePath: string;
}

async function repairDuplicateBookVolumeFolders(
  rootPath: string,
  recursive: boolean,
): Promise<VolumeFolderRepair[]> {
  const repairs: VolumeFolderRepair[] = [];

  async function walk(dirPath: string) {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const currentPath = path.join(dirPath, entry.name);
      const repairedName = duplicatedBookVolumeFolderNameRepair(entry.name);
      let nextPath = currentPath;

      if (repairedName) {
        const repairedPath = path.join(dirPath, repairedName);
        if (!existsSync(repairedPath)) {
          await rename(currentPath, repairedPath);
          nextPath = repairedPath;
          repairs.push({
            fromPath: currentPath,
            toPath: repairedPath,
            fromRelativePath: path.relative(rootPath, currentPath) || entry.name,
            toRelativePath: path.relative(rootPath, repairedPath) || repairedName,
          });
        }
      }

      if (recursive) {
        await walk(nextPath);
      }
    }
  }

  await walk(rootPath);
  return repairs;
}

function replacePathPrefix(value: string | null, fromPrefix: string, toPrefix: string): string | null {
  if (!value) return value;
  if (value === fromPrefix) return toPrefix;
  if (value.startsWith(`${fromPrefix}${path.sep}`)) {
    return `${toPrefix}${value.slice(fromPrefix.length)}`;
  }
  return value;
}

async function patchRepairedBookVolumeFolders(
  libraryRootId: string,
  repairs: VolumeFolderRepair[],
) {
  if (repairs.length === 0) return;

  const volumeRows = await db
    .select({
      id: bookVolumes.id,
      folderPath: bookVolumes.folderPath,
      relativePath: bookVolumes.relativePath,
    })
    .from(bookVolumes)
    .innerJoin(books, eq(books.id, bookVolumes.bookId))
    .where(eq(books.libraryRootId, libraryRootId));

  for (const row of volumeRows) {
    let folderPath = row.folderPath;
    let relativePath = row.relativePath;
    for (const repair of repairs) {
      folderPath = replacePathPrefix(folderPath, repair.fromPath, repair.toPath);
      relativePath = replacePathPrefix(relativePath, repair.fromRelativePath, repair.toRelativePath);
    }
    if (folderPath !== row.folderPath || relativePath !== row.relativePath) {
      await db
        .update(bookVolumes)
        .set({ folderPath, relativePath, updatedAt: new Date() })
        .where(eq(bookVolumes.id, row.id));
    }
  }

  const chapterRows = await db
    .select({
      id: bookChapters.id,
      archivePath: bookChapters.archivePath,
      relativePath: bookChapters.relativePath,
    })
    .from(bookChapters)
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .where(eq(books.libraryRootId, libraryRootId));

  for (const row of chapterRows) {
    let archivePath = row.archivePath;
    let relativePath = row.relativePath;
    for (const repair of repairs) {
      archivePath = replacePathPrefix(archivePath, repair.fromPath, repair.toPath) ?? archivePath;
      relativePath = replacePathPrefix(relativePath, repair.fromRelativePath, repair.toRelativePath) ?? relativePath;
    }
    if (archivePath !== row.archivePath || relativePath !== row.relativePath) {
      await db
        .update(bookChapters)
        .set({ archivePath, relativePath, updatedAt: new Date() })
        .where(eq(bookChapters.id, row.id));
    }
  }

  const pageRows = await db
    .select({ id: bookPages.id, filePath: bookPages.filePath })
    .from(bookPages)
    .innerJoin(books, eq(books.id, bookPages.bookId))
    .where(eq(books.libraryRootId, libraryRootId));

  for (const row of pageRows) {
    let filePath = row.filePath;
    for (const repair of repairs) {
      filePath = replacePathPrefix(filePath, repair.fromPath, repair.toPath) ?? filePath;
    }
    if (filePath !== row.filePath) {
      await db
        .update(bookPages)
        .set({ filePath, updatedAt: new Date() })
        .where(eq(bookPages.id, row.id));
    }
  }
}

async function readVolumeSidecar(folderPath: string | null): Promise<{
  title?: string;
  volumeNumber?: number | null;
  externalIds?: Record<string, string>;
} | null> {
  if (!folderPath) return null;
  try {
    const parsed = JSON.parse(
      await readFile(path.join(folderPath, ".obscura-volume.json"), "utf8"),
    ) as Record<string, unknown>;
    const volumeNumber =
      typeof parsed.volumeNumber === "number"
        ? parsed.volumeNumber
        : typeof parsed.volumeNumber === "string"
          ? Number.parseInt(parsed.volumeNumber, 10)
          : null;
    const externalIds =
      parsed.externalIds && typeof parsed.externalIds === "object" && !Array.isArray(parsed.externalIds)
        ? Object.fromEntries(
            Object.entries(parsed.externalIds as Record<string, unknown>)
              .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0),
          )
        : undefined;
    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : undefined,
      volumeNumber: Number.isFinite(volumeNumber) ? Math.round(volumeNumber!) : null,
      externalIds,
    };
  } catch {
    return null;
  }
}

export async function processBookScan(job: Job) {
  const sfwOnly = Boolean(job.data.sfwOnly);
  const libraryRootId = String(job.data.libraryRootId);
  const [root] = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.id, libraryRootId))
    .limit(1);

  if (!root) throw new Error("Library root not found");
  if (!(root.scanBooks ?? false)) return;

  await markJobActive(job, "book-scan", {
    type: "library-root",
    id: root.id,
    label: root.label,
  });

  const repairedVolumeFolders = await repairDuplicateBookVolumeFolders(root.path, root.recursive);
  await patchRepairedBookVolumeFolders(root.id, repairedVolumeFolders);

  const discovery = await discoverImageFilesAndDirs(root.path, root.recursive);
  const ignoredPaths = await listIgnoredMediaPathsUnderRoot(db, root.path);
  const archivePaths = discovery.zipFiles
    .filter(isSupportedComicBookArchive)
    .filter((filePath) => !ignoredPaths.has(path.resolve(filePath)))
    .sort((a, b) => a.localeCompare(b));
  const discoveredArchiveSet = new Set(archivePaths);

  const knownChapters = await db
    .select({ id: bookChapters.id, archivePath: bookChapters.archivePath })
    .from(bookChapters)
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .where(eq(books.libraryRootId, root.id));
  const staleChapterIds = knownChapters
    .filter((chapter) => !discoveredArchiveSet.has(chapter.archivePath))
    .map((chapter) => chapter.id);
  if (staleChapterIds.length > 0) {
    await db.delete(bookChapters).where(inArray(bookChapters.id, staleChapterIds));
  }

  let processed = 0;
  for (const archivePath of archivePaths) {
    let comicInfo: ComicInfoMetadata | null = null;
    try {
      comicInfo = extractComicInfoFromZip(archivePath);
    } catch {
      comicInfo = null;
    }

    const members = parseZipImageMembers(archivePath);
    const plan = inferComicBookArchivePlan({
      archivePath,
      rootPath: root.path,
      comicInfo,
    });
    const bookIsNsfw = Boolean(root.isNsfw || comicInfoMarksNsfw(comicInfo));
    const studioId = await findOrCreateStudioId(db, comicInfo?.publisher, {
      isNsfw: bookIsNsfw,
    });

    const [existingBook] = await db
      .select({ id: books.id, details: books.details, date: books.date, urls: books.urls, studioId: books.studioId })
      .from(books)
      .where(and(eq(books.libraryRootId, root.id), eq(books.relativePath, plan.bookRelativePath)))
      .limit(1);

    const bookFolderPath = resolveBookFolderPath(root.path, plan, archivePath);
    const bookPatch = {
      title: plan.bookTitle,
      folderPath: bookFolderPath,
      relativePath: plan.bookRelativePath,
      details: firstNonEmpty(existingBook?.details, comicInfo?.summary) ?? null,
      date: firstNonEmpty(existingBook?.date, comicInfo?.date) ?? null,
      urls: existingBook?.urls?.length ? existingBook.urls : (comicInfo?.urls ?? []),
      studioId: existingBook?.studioId ?? studioId,
      isNsfw: bookIsNsfw,
      updatedAt: new Date(),
    };

    let bookId: string;
    if (existingBook) {
      bookId = existingBook.id;
      await db.update(books).set(bookPatch).where(eq(books.id, bookId));
    } else {
      const [created] = await db
        .insert(books)
        .values({
          libraryRootId: root.id,
          bookType: "comic",
          title: plan.bookTitle,
          folderPath: bookFolderPath,
          relativePath: plan.bookRelativePath,
          details: comicInfo?.summary ?? null,
          date: comicInfo?.date ?? null,
          urls: comicInfo?.urls ?? [],
          studioId,
          isNsfw: bookIsNsfw,
        })
        .returning({ id: books.id });
      bookId = created.id;
    }

    await attachBookRelations(bookId, comicInfo, bookIsNsfw);

    let volumeId: string | null = null;
    if (plan.volumeTitle) {
      const volumeFolderPath = plan.volumeRelativePath ? path.join(root.path, plan.volumeRelativePath) : null;
      const sidecar = await readVolumeSidecar(volumeFolderPath);
      const volumeTitle = sidecar?.title ?? plan.volumeTitle;
      const volumeNumber = sidecar?.volumeNumber ?? plan.volumeNumber;
      const [existingVolume] = await db
        .select({ id: bookVolumes.id, externalIds: bookVolumes.externalIds })
        .from(bookVolumes)
        .where(
          and(
            eq(bookVolumes.bookId, bookId),
            plan.volumeRelativePath
              ? eq(bookVolumes.relativePath, plan.volumeRelativePath)
              : volumeNumber == null
                ? eq(bookVolumes.title, volumeTitle)
                : eq(bookVolumes.volumeNumber, volumeNumber),
          ),
        )
        .limit(1);
      if (existingVolume) {
        volumeId = existingVolume.id;
        await db
          .update(bookVolumes)
          .set({
            volumeNumber,
            title: volumeTitle,
            folderPath: volumeFolderPath,
            relativePath: plan.volumeRelativePath,
            externalIds: { ...(existingVolume.externalIds ?? {}), ...(sidecar?.externalIds ?? {}) },
            updatedAt: new Date(),
          })
          .where(eq(bookVolumes.id, volumeId));
      } else {
        const [createdVolume] = await db
          .insert(bookVolumes)
          .values({
            bookId,
            volumeNumber,
            title: volumeTitle,
            folderPath: volumeFolderPath,
            relativePath: plan.volumeRelativePath,
            externalIds: sidecar?.externalIds ?? {},
          })
          .returning({ id: bookVolumes.id });
        volumeId = createdVolume.id;
      }
    }

    const [existingChapter] = await db
      .select({
        id: bookChapters.id,
        coverPageId: bookChapters.coverPageId,
        coverImagePath: bookChapters.coverImagePath,
      })
      .from(bookChapters)
      .where(eq(bookChapters.archivePath, archivePath))
      .limit(1);

    let chapterId: string;
    const chapterPatch = {
      bookId,
      volumeId,
      title: plan.chapterTitle,
      chapterNumber: plan.chapterNumber,
      archivePath,
      relativePath: plan.relativePath,
      pageCount: members.length,
      updatedAt: new Date(),
    };
    if (existingChapter) {
      chapterId = existingChapter.id;
      await db.update(bookChapters).set(chapterPatch).where(eq(bookChapters.id, chapterId));
    } else {
      const [created] = await db
        .insert(bookChapters)
        .values({
          bookId,
          volumeId,
          title: plan.chapterTitle,
          chapterNumber: plan.chapterNumber,
          archivePath,
          relativePath: plan.relativePath,
          pageCount: members.length,
        })
        .returning({ id: bookChapters.id });
      chapterId = created.id;
    }

    const pageIds: string[] = [];
    for (let i = 0; i < members.length; i += 1) {
      const memberPath = members[i]!;
      const filePath = `${archivePath}::${memberPath}`;
      const [existingPage] = await db
        .select({ id: bookPages.id, thumbnailPath: bookPages.thumbnailPath })
        .from(bookPages)
        .where(eq(bookPages.filePath, filePath))
        .limit(1);

      if (existingPage) {
        pageIds.push(existingPage.id);
        await db
          .update(bookPages)
          .set({ bookId, chapterId, sortOrder: i, isNsfw: bookIsNsfw, updatedAt: new Date() })
          .where(eq(bookPages.id, existingPage.id));
        if (!existingPage.thumbnailPath && !sfwOnly) {
          await enqueuePendingBookPageJob("book-page-thumbnail", existingPage.id, {
            by: "book-scan",
            label: `Queued during ${root.label} book scan`,
          });
        }
        continue;
      }

      const [created] = await db
        .insert(bookPages)
        .values({
          bookId,
          chapterId,
          title: fileNameToTitle(memberPath),
          filePath,
          sortOrder: i,
          isNsfw: bookIsNsfw,
        })
        .returning({ id: bookPages.id });
      pageIds.push(created.id);
      if (!sfwOnly) {
        await enqueuePendingBookPageJob("book-page-thumbnail", created.id, {
          by: "book-scan",
          label: `Queued during ${root.label} book scan`,
        });
      }
    }

    const coverPageId =
      existingChapter?.coverPageId || existingChapter?.coverImagePath
        ? existingChapter.coverPageId
        : (pageIds[0] ?? null);
    await db
      .update(bookChapters)
      .set({ coverPageId, updatedAt: new Date() })
      .where(eq(bookChapters.id, chapterId));

    await db.execute(sql`
      WITH cover AS (
        SELECT bp.id
        FROM book_pages bp
        INNER JOIN book_chapters bc ON bc.id = bp.chapter_id
        WHERE bp.book_id = ${bookId}
        ORDER BY bc.chapter_number ASC, bc.title ASC, bp.sort_order ASC
        LIMIT 1
      )
      UPDATE books SET
        page_count = (SELECT count(*) FROM book_pages WHERE book_id = ${bookId}),
        chapter_count = (SELECT count(*) FROM book_chapters WHERE book_id = ${bookId}),
        cover_page_id = (SELECT id FROM cover),
        cover_image_path = CASE
          WHEN (SELECT id FROM cover) IS NULL THEN NULL
          ELSE '/assets/book-pages/' || (SELECT id FROM cover)::text || '/thumb'
        END,
        updated_at = NOW()
      WHERE id = ${bookId}
    `);

    processed += 1;
    if (archivePaths.length > 0) {
      await markJobProgress(job, "book-scan", Math.round((processed / archivePaths.length) * 100));
    }
  }

  await db.execute(sql`
    DELETE FROM book_volumes bv
    USING books b
    WHERE bv.book_id = b.id
      AND b.library_root_id = ${root.id}
      AND NOT EXISTS (SELECT 1 FROM book_chapters bc WHERE bc.volume_id = bv.id)
  `);

  await db.execute(sql`
    DELETE FROM books b
    WHERE b.library_root_id = ${root.id}
      AND NOT EXISTS (SELECT 1 FROM book_chapters bc WHERE bc.book_id = b.id)
  `);

  if (root.isNsfw) {
    await markLinkedMetadataNsfwForLibraryRoot(db, root.path);
  }

  await db
    .update(libraryRoots)
    .set({ lastScannedAt: new Date(), updatedAt: new Date() })
    .where(eq(libraryRoots.id, root.id));

  await enqueueCollectionRefreshAll({
    by: "book-scan",
    label: "Queued after book scan",
  });
}
