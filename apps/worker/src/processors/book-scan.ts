import path from "node:path";
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import {
  discoverImageFilesAndDirs,
  extractComicInfoFromZip,
  fileNameToTitle,
  parseZipImageMembers,
  type ComicInfoMetadata,
} from "@obscura/media-core";
import { listIgnoredMediaPathsUnderRoot, markLinkedMetadataNsfwForLibraryRoot } from "@obscura/app-core";
import {
  db,
  libraryRoots,
  books,
  bookChapters,
  bookPages,
  bookPerformers,
  bookTags,
  performers,
  studios,
  tags,
} from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";
import { enqueueCollectionRefreshAll, enqueuePendingBookPageJob } from "../lib/enqueue.js";
import { inferComicBookArchivePlan, isSupportedComicBookArchive } from "./book-scan-utils.js";

async function findOrCreateStudioId(name: string | null | undefined) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return null;
  const [existing] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(ilike(studios.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(studios).values({ name: trimmed }).returning({ id: studios.id });
  return created.id;
}

async function findOrCreatePerformerId(name: string) {
  const trimmed = name.trim();
  const [existing] = await db
    .select({ id: performers.id })
    .from(performers)
    .where(ilike(performers.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(performers).values({ name: trimmed }).returning({ id: performers.id });
  return created.id;
}

async function findOrCreateTagId(name: string) {
  const trimmed = name.trim();
  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(ilike(tags.name, trimmed))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(tags).values({ name: trimmed }).returning({ id: tags.id });
  return created.id;
}

async function attachBookRelations(bookId: string, comicInfo: ComicInfoMetadata | null) {
  if (!comicInfo) return;

  for (const name of comicInfo.creators) {
    const performerId = await findOrCreatePerformerId(name);
    await db.insert(bookPerformers).values({ bookId, performerId }).onConflictDoNothing();
  }

  for (const name of comicInfo.tags) {
    const tagId = await findOrCreateTagId(name);
    await db.insert(bookTags).values({ bookId, tagId }).onConflictDoNothing();
  }
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim().length > 0)?.trim();
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
    const studioId = await findOrCreateStudioId(comicInfo?.publisher);

    const [existingBook] = await db
      .select({ id: books.id, details: books.details, date: books.date, urls: books.urls, studioId: books.studioId })
      .from(books)
      .where(and(eq(books.libraryRootId, root.id), eq(books.relativePath, plan.bookRelativePath)))
      .limit(1);

    const bookPatch = {
      title: plan.bookTitle,
      folderPath: path.dirname(archivePath),
      relativePath: plan.bookRelativePath,
      details: firstNonEmpty(existingBook?.details, comicInfo?.summary) ?? null,
      date: firstNonEmpty(existingBook?.date, comicInfo?.date) ?? null,
      urls: existingBook?.urls?.length ? existingBook.urls : (comicInfo?.urls ?? []),
      studioId: existingBook?.studioId ?? studioId,
      isNsfw: root.isNsfw,
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
          folderPath: path.dirname(archivePath),
          relativePath: plan.bookRelativePath,
          details: comicInfo?.summary ?? null,
          date: comicInfo?.date ?? null,
          urls: comicInfo?.urls ?? [],
          studioId,
          isNsfw: root.isNsfw,
        })
        .returning({ id: books.id });
      bookId = created.id;
    }

    await attachBookRelations(bookId, comicInfo);

    const [existingChapter] = await db
      .select({ id: bookChapters.id })
      .from(bookChapters)
      .where(eq(bookChapters.archivePath, archivePath))
      .limit(1);

    let chapterId: string;
    const chapterPatch = {
      bookId,
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
          .set({ bookId, chapterId, sortOrder: i, isNsfw: root.isNsfw, updatedAt: new Date() })
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
          isNsfw: root.isNsfw,
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

    const coverPageId = pageIds[0] ?? null;
    await db
      .update(bookChapters)
      .set({ coverPageId, updatedAt: new Date() })
      .where(eq(bookChapters.id, chapterId));

    const coverPatch = coverPageId
      ? sql`, cover_page_id = ${coverPageId}, cover_image_path = ${`/assets/book-pages/${coverPageId}/thumb`}`
      : sql``;
    await db.execute(sql`
      UPDATE books SET
        page_count = (SELECT count(*) FROM book_pages WHERE book_id = ${bookId}),
        chapter_count = (SELECT count(*) FROM book_chapters WHERE book_id = ${bookId}),
        updated_at = NOW()
        ${coverPatch}
      WHERE id = ${bookId}
    `);

    processed += 1;
    if (archivePaths.length > 0) {
      await markJobProgress(job, "book-scan", Math.round((processed / archivePaths.length) * 100));
    }
  }

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
