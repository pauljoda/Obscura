import { existsSync } from "node:fs";
import { mkdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { schema, type AppDb } from "@obscura/db";
import type {
  BookDetailDto,
  BookVolumeDto,
  BookListItemDto,
  BookPageDto,
  BookProgressDto,
  BookProgressPatchDto,
} from "@obscura/contracts";
import {
  extractComicInfoFromZip,
  fileNameToTitle,
  getGeneratedBookChapterDir,
  getGeneratedBookDir,
  getGeneratedBookPageDir,
  getGeneratedBookVolumeDir,
  parseZipImageMembers,
} from "@obscura/media-core";
import { InternalError, NotFoundError, ValidationError } from "./errors";
import { bookVisibleSql, bookPageVisibleSql } from "./library-root-visibility";
import { ignoreMediaFilePath } from "./media-file-ignores";
import { enqueueQueueJob } from "./queue-writes";
import {
  assertDirExists,
  resolveCollisionSafePath,
  validateUploadInput,
  writeUploadBuffer,
  type UploadFileInput,
} from "./upload-utils";
import {
  buildBooleanCondition,
  buildDateConditions,
  buildNsfwFlagConditions,
  buildOrderBy,
  buildRatingConditions,
  parsePagination,
  resolvePerformerIds,
  resolveTagIds,
  toArray,
  type SortConfig,
} from "./media-query-helpers";

const {
  books,
  bookVolumes,
  bookChapters,
  bookPages,
  bookPerformers,
  bookTags,
  bookReadProgress,
  bookLegacyGalleryMap,
  performers,
  studios,
  libraryRoots,
  tags,
} = schema;

const bookSortConfig: SortConfig = {
  columns: {
    recent: books.createdAt,
    title: books.title,
    date: books.date,
    rating: books.rating,
    pages: books.pageCount,
  },
  defaultDirs: {
    recent: "desc",
    title: "asc",
    date: "desc",
    rating: "desc",
    pages: "desc",
  },
  fallbackColumn: books.createdAt,
  randomColumn: books.id,
};

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toProgressDto(progress: typeof bookReadProgress.$inferSelect | null): BookProgressDto | null {
  if (!progress) return null;
  return {
    bookId: progress.bookId,
    chapterId: progress.chapterId,
    pageIndex: progress.pageIndex,
    pageCount: progress.pageCount,
    readerMode: progress.readerMode === "webtoon" ? "webtoon" : "paged",
    completedAt: toIso(progress.completedAt),
    updatedAt: progress.updatedAt.toISOString(),
  };
}

function toPageDto(page: typeof bookPages.$inferSelect): BookPageDto {
  return {
    id: page.id,
    bookId: page.bookId,
    chapterId: page.chapterId,
    title: page.title,
    width: page.width,
    height: page.height,
    format: page.format,
    thumbnailPath: page.thumbnailPath,
    fullPath: `/assets/book-pages/${page.id}/full`,
    sortOrder: page.sortOrder,
  };
}

function bookPageThumbPath(pageId: string) {
  return `/assets/book-pages/${pageId}/thumb`;
}

export interface BookArtworkPage {
  pageId: string;
  chapterId: string;
  volumeId: string | null;
  volumeNumber: number | null;
  volumeTitle: string | null;
  chapterNumber: number;
  chapterTitle: string;
  sortOrder: number;
}

export function isCustomBookCoverPath(bookId: string, coverImagePath: string | null | undefined) {
  return coverImagePath === bookCoverPath(bookId);
}

function compareNullableNumber(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function compareText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", undefined, { numeric: true, sensitivity: "base" });
}

export function orderBookArtworkPages<T extends BookArtworkPage>(pages: T[]): T[] {
  const hasVolumes = pages.some((page) => page.volumeId);
  return [...pages].sort((a, b) => {
    if (hasVolumes && Boolean(a.volumeId) !== Boolean(b.volumeId)) {
      return a.volumeId ? -1 : 1;
    }
    if (hasVolumes) {
      const volumeNumber = compareNullableNumber(a.volumeNumber, b.volumeNumber);
      if (volumeNumber !== 0) return volumeNumber;
      const volumeTitle = compareText(a.volumeTitle, b.volumeTitle);
      if (volumeTitle !== 0) return volumeTitle;
      const volumeId = compareText(a.volumeId, b.volumeId);
      if (volumeId !== 0) return volumeId;
    }
    if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
    const chapterTitle = compareText(a.chapterTitle, b.chapterTitle);
    if (chapterTitle !== 0) return chapterTitle;
    const chapterId = compareText(a.chapterId, b.chapterId);
    if (chapterId !== 0) return chapterId;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return compareText(a.pageId, b.pageId);
  });
}

export function resolveBookArtwork(input: {
  bookId: string;
  storedCoverImagePath: string | null | undefined;
  pages: BookArtworkPage[];
  previewLimit?: number;
}) {
  const orderedPages = orderBookArtworkPages(input.pages);
  const pagePreviews = orderedPages
    .slice(0, input.previewLimit ?? 4)
    .map((page) => bookPageThumbPath(page.pageId));
  const customCover = isCustomBookCoverPath(input.bookId, input.storedCoverImagePath)
    ? input.storedCoverImagePath!
    : null;
  const coverImagePath = customCover ?? pagePreviews[0] ?? null;
  const previewImagePaths = customCover
    ? [customCover, ...pagePreviews].slice(0, input.previewLimit ?? 4)
    : pagePreviews;
  return { coverImagePath, previewImagePaths };
}

function sanitizeFolderName(value: string): string {
  return value
    .trim()
    .replace(/[/:\\]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 180)
    .trim();
}

function relativeToRoot(rootPath: string, filePath: string) {
  return path.relative(rootPath, filePath) || path.basename(filePath);
}

async function refreshBookCounts(db: AppDb, bookId: string) {
  await db.execute(sql`
    WITH cover AS (
      SELECT bp.id
      FROM book_pages bp
      INNER JOIN book_chapters bc ON bc.id = bp.chapter_id
      LEFT JOIN book_volumes bv ON bv.id = bc.volume_id
      WHERE bp.book_id = ${bookId}
      ORDER BY (bv.id IS NULL) ASC,
        bv.volume_number ASC NULLS LAST,
        bv.title ASC NULLS LAST,
        bc.chapter_number ASC,
        bc.title ASC,
        bp.sort_order ASC,
        bp.id ASC
      LIMIT 1
    )
    UPDATE books SET
      page_count = (SELECT count(*) FROM book_pages WHERE book_id = ${bookId}),
      chapter_count = (SELECT count(*) FROM book_chapters WHERE book_id = ${bookId}),
      cover_page_id = CASE
        WHEN cover_image_path = '/assets/books/' || ${bookId}::text || '/cover' THEN cover_page_id
        ELSE (SELECT id FROM cover)
      END,
      cover_image_path = CASE
        WHEN cover_image_path = '/assets/books/' || ${bookId}::text || '/cover' THEN cover_image_path
        WHEN (SELECT id FROM cover) IS NULL THEN NULL
        ELSE '/assets/book-pages/' || (SELECT id FROM cover)::text || '/thumb'
      END,
      updated_at = NOW()
    WHERE id = ${bookId}
  `);
}

async function enqueueBookPageThumbnail(db: AppDb, pageId: string, title: string) {
  await enqueueQueueJob(db, {
    queueName: "book-page-thumbnail",
    data: { pageId },
    target: {
      type: "book-page",
      id: pageId,
      label: title,
    },
    trigger: {
      by: "manual",
      label: "Queued after book update",
    },
  });
}

async function createChapterFromArchive(
  db: AppDb,
  input: {
    bookId: string;
    archivePath: string;
    rootPath: string;
    title?: string | null;
    chapterNumber?: number | null;
    isNsfw: boolean;
  },
) {
  const members = parseZipImageMembers(input.archivePath);
  if (members.length === 0) {
    throw new ValidationError("Comic archive does not contain readable image pages");
  }
  let comicInfo: ReturnType<typeof extractComicInfoFromZip> | null = null;
  try {
    comicInfo = extractComicInfoFromZip(input.archivePath);
  } catch {
    comicInfo = null;
  }
  const chapterTitle =
    input.title?.trim() || comicInfo?.title?.trim() || fileNameToTitle(input.archivePath);
  const chapterNumber =
    Number.isInteger(input.chapterNumber) && input.chapterNumber! > 0
      ? input.chapterNumber!
      : Number.parseInt(comicInfo?.number ?? "", 10) || 1;

  const [chapter] = await db
    .insert(bookChapters)
    .values({
      bookId: input.bookId,
      title: chapterTitle,
      chapterNumber,
      archivePath: input.archivePath,
      relativePath: relativeToRoot(input.rootPath, input.archivePath),
      pageCount: members.length,
    })
    .returning({ id: bookChapters.id });
  if (!chapter) throw new InternalError("Failed to create book chapter");

  let coverPageId: string | null = null;
  for (let i = 0; i < members.length; i += 1) {
    const memberPath = members[i]!;
    const pageTitle = fileNameToTitle(memberPath);
    const [page] = await db
      .insert(bookPages)
      .values({
        bookId: input.bookId,
        chapterId: chapter.id,
        title: pageTitle,
        filePath: `${input.archivePath}::${memberPath}`,
        sortOrder: i,
        isNsfw: input.isNsfw,
      })
      .returning({ id: bookPages.id, title: bookPages.title });
    if (!page) continue;
    coverPageId ??= page.id;
    await enqueueBookPageThumbnail(db, page.id, page.title);
  }

  await db
    .update(bookChapters)
    .set({ coverPageId, updatedAt: new Date() })
    .where(eq(bookChapters.id, chapter.id));

  await refreshBookCounts(db, input.bookId);
  return chapter;
}

async function decorateBookItems(
  db: AppDb,
  rows: (typeof books.$inferSelect)[],
  nsfwMode?: string,
): Promise<BookListItemDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((book) => book.id);

  const [studioRows, performerRows, tagRows, progressRows, pageRows] = await Promise.all([
    db
      .select({ id: studios.id, name: studios.name })
      .from(studios)
      .where(inArray(studios.id, rows.map((book) => book.studioId).filter((id): id is string => Boolean(id)))),
    db
      .select({
        bookId: bookPerformers.bookId,
        id: performers.id,
        name: performers.name,
        isNsfw: performers.isNsfw,
      })
      .from(bookPerformers)
      .innerJoin(performers, eq(bookPerformers.performerId, performers.id))
      .where(inArray(bookPerformers.bookId, ids))
      .orderBy(asc(performers.name)),
    db
      .select({
        bookId: bookTags.bookId,
        id: tags.id,
        name: tags.name,
        isNsfw: tags.isNsfw,
      })
      .from(bookTags)
      .innerJoin(tags, eq(bookTags.tagId, tags.id))
      .where(inArray(bookTags.bookId, ids))
      .orderBy(asc(tags.name)),
    db.select().from(bookReadProgress).where(inArray(bookReadProgress.bookId, ids)),
    db
      .select({
        bookId: bookPages.bookId,
        chapterId: bookPages.chapterId,
        pageId: bookPages.id,
        volumeId: bookChapters.volumeId,
        volumeNumber: bookVolumes.volumeNumber,
        volumeTitle: bookVolumes.title,
        chapterNumber: bookChapters.chapterNumber,
        chapterTitle: bookChapters.title,
        sortOrder: bookPages.sortOrder,
      })
      .from(bookPages)
      .innerJoin(bookChapters, eq(bookPages.chapterId, bookChapters.id))
      .leftJoin(bookVolumes, eq(bookChapters.volumeId, bookVolumes.id))
      .where(and(inArray(bookPages.bookId, ids), bookPageVisibleSql(bookPages.filePath)))
      .orderBy(
        asc(bookPages.bookId),
        sql`${bookVolumes.id} IS NULL`,
        asc(bookVolumes.volumeNumber),
        asc(bookVolumes.title),
        asc(bookChapters.chapterNumber),
        asc(bookChapters.title),
        asc(bookPages.sortOrder),
        asc(bookPages.id),
      ),
  ]);

  const studioById = new Map(studioRows.map((studio) => [studio.id, studio.name]));
  const performersByBook = new Map<string, typeof performerRows>();
  for (const row of performerRows) {
    if (nsfwMode === "off" && row.isNsfw) continue;
    performersByBook.set(row.bookId, [...(performersByBook.get(row.bookId) ?? []), row]);
  }
  const tagsByBook = new Map<string, typeof tagRows>();
  for (const row of tagRows) {
    if (nsfwMode === "off" && row.isNsfw) continue;
    tagsByBook.set(row.bookId, [...(tagsByBook.get(row.bookId) ?? []), row]);
  }
  const progressByBook = new Map(progressRows.map((progress) => [progress.bookId, progress]));
  const pagesByBook = new Map<string, typeof pageRows>();
  const chapterPreviewPagesByBook = new Map<string, typeof pageRows>();
  const seenChapterIds = new Set<string>();
  for (const page of orderBookArtworkPages(pageRows)) {
    pagesByBook.set(page.bookId, [...(pagesByBook.get(page.bookId) ?? []), page]);
    const chapterKey = `${page.bookId}:${page.chapterId}`;
    if (!seenChapterIds.has(chapterKey)) {
      seenChapterIds.add(chapterKey);
      chapterPreviewPagesByBook.set(page.bookId, [
        ...(chapterPreviewPagesByBook.get(page.bookId) ?? []),
        page,
      ]);
    }
  }

  return rows.map((book) => {
    const progress = toProgressDto(progressByBook.get(book.id) ?? null);
    const orderedPages = pagesByBook.get(book.id) ?? [];
    const previewPages =
      book.chapterCount > 1
        ? (chapterPreviewPagesByBook.get(book.id) ?? [])
        : orderedPages;
    const artwork = resolveBookArtwork({
      bookId: book.id,
      storedCoverImagePath: book.coverImagePath,
      pages: previewPages,
    });
    return {
      id: book.id,
      bookType: "comic",
      title: book.title,
      details: book.details,
      coverImagePath: artwork.coverImagePath,
      previewImagePaths: artwork.previewImagePaths,
      pageCount: book.pageCount,
      chapterCount: book.chapterCount,
      rating: book.rating,
      organized: book.organized,
      isNsfw: book.isNsfw,
      date: book.date,
      studioId: book.studioId,
      studioName: book.studioId ? (studioById.get(book.studioId) ?? null) : null,
      performers: (performersByBook.get(book.id) ?? []).map((p) => ({ id: p.id, name: p.name })),
      tags: (tagsByBook.get(book.id) ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        isNsfw: t.isNsfw,
      })),
      readCompleted: Boolean(progress?.completedAt),
      progress,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    };
  });
}

export interface ListBooksQuery {
  search?: string;
  sort?: string;
  order?: string;
  limit?: string;
  offset?: string;
  nsfw?: string;
  tag?: string | string[];
  performer?: string | string[];
  studio?: string;
  ratingMin?: string;
  ratingMax?: string;
  dateFrom?: string;
  dateTo?: string;
  organized?: string;
  isNsfw?: string;
  read?: string;
  randomSeed?: string;
}

export async function listBooksRead(db: AppDb, query: ListBooksQuery) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 60, 200);
  const conditions: SQL[] = [eq(books.bookType, "comic"), bookVisibleSql(books.libraryRootId)];

  conditions.push(...buildNsfwFlagConditions(books.isNsfw, query.nsfw, query.isNsfw));
  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(orBookSearch(term));
  }
  if (query.studio) conditions.push(eq(books.studioId, query.studio));
  if (query.read === "read") {
    conditions.push(sql`EXISTS (SELECT 1 FROM book_read_progress brp WHERE brp.book_id = ${books.id} AND brp.completed_at IS NOT NULL)`);
  } else if (query.read === "unread") {
    conditions.push(sql`NOT EXISTS (SELECT 1 FROM book_read_progress brp WHERE brp.book_id = ${books.id} AND brp.completed_at IS NOT NULL)`);
  }

  const tagEntityIds = await resolveTagIds(db, toArray(query.tag), bookTags, bookTags.bookId, bookTags.tagId);
  if (tagEntityIds === null) return { books: [], total: 0, limit, offset };
  if (tagEntityIds) conditions.push(inArray(books.id, tagEntityIds));

  const perfEntityIds = await resolvePerformerIds(db, toArray(query.performer), bookPerformers, bookPerformers.bookId, bookPerformers.performerId);
  if (perfEntityIds === null) return { books: [], total: 0, limit, offset };
  if (perfEntityIds) conditions.push(inArray(books.id, perfEntityIds));

  conditions.push(...buildRatingConditions(books.rating, query.ratingMin, query.ratingMax));
  conditions.push(...buildDateConditions(books.date, query.dateFrom, query.dateTo));
  const organizedCond = buildBooleanCondition(books.organized, query.organized);
  if (organizedCond) conditions.push(organizedCond);

  const where = and(...conditions);
  const [countRow, bookRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(books).where(where),
    db
      .select()
      .from(books)
      .where(where)
      .orderBy(buildOrderBy(bookSortConfig, query.sort, query.order, query.randomSeed))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    books: await decorateBookItems(db, bookRows, query.nsfw),
    total: Number(countRow[0]?.count ?? 0),
    limit,
    offset,
  };
}

export async function getBooksByIdsRead(db: AppDb, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(books)
    .where(and(inArray(books.id, ids), bookVisibleSql(books.libraryRootId)));
  return decorateBookItems(db, rows);
}

function orBookSearch(term: string): SQL {
  return sql`(
    ${books.title} ILIKE ${term}
    OR ${books.details} ILIKE ${term}
    OR EXISTS (
      SELECT 1 FROM book_tags bt
      INNER JOIN tags t ON t.id = bt.tag_id
      WHERE bt.book_id = ${books.id}
        AND t.name ILIKE ${term}
    )
  )`;
}

export async function getBookDetailRead(
  db: AppDb,
  id: string,
  nsfwMode?: string,
): Promise<BookDetailDto> {
  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, id), bookVisibleSql(books.libraryRootId)))
    .limit(1);
  if (!book || (nsfwMode === "off" && book.isNsfw)) throw new NotFoundError("Book not found");

  const [base] = await decorateBookItems(db, [book], nsfwMode);
  if (!base) throw new NotFoundError("Book not found");

  const [studioRow, performerRows, volumeRows, chapterRows, pageRows] = await Promise.all([
    book.studioId
      ? db
          .select({ id: studios.id, name: studios.name, url: studios.url })
          .from(studios)
          .where(eq(studios.id, book.studioId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: performers.id,
        name: performers.name,
        gender: performers.gender,
        imagePath: performers.imagePath,
        isNsfw: performers.isNsfw,
      })
      .from(bookPerformers)
      .innerJoin(performers, eq(bookPerformers.performerId, performers.id))
      .where(eq(bookPerformers.bookId, id))
      .orderBy(asc(performers.name)),
    db
      .select()
      .from(bookVolumes)
      .where(eq(bookVolumes.bookId, id))
      .orderBy(asc(bookVolumes.volumeNumber), asc(bookVolumes.title)),
    db
      .select({
        id: bookChapters.id,
        bookId: bookChapters.bookId,
        volumeId: bookChapters.volumeId,
        title: bookChapters.title,
        chapterNumber: bookChapters.chapterNumber,
        archivePath: bookChapters.archivePath,
        relativePath: bookChapters.relativePath,
        pageCount: bookChapters.pageCount,
        coverPageId: bookChapters.coverPageId,
        coverImagePath: bookChapters.coverImagePath,
        externalIds: bookChapters.externalIds,
        createdAt: bookChapters.createdAt,
        updatedAt: bookChapters.updatedAt,
        volumeNumber: bookVolumes.volumeNumber,
        volumeTitle: bookVolumes.title,
      })
      .from(bookChapters)
      .leftJoin(bookVolumes, eq(bookChapters.volumeId, bookVolumes.id))
      .where(eq(bookChapters.bookId, id))
      .orderBy(
        sql`${bookVolumes.id} IS NULL`,
        asc(bookVolumes.volumeNumber),
        asc(bookVolumes.title),
        asc(bookChapters.chapterNumber),
        asc(bookChapters.title),
        asc(bookChapters.id),
      ),
    db
      .select({
        id: bookPages.id,
        bookId: bookPages.bookId,
        chapterId: bookPages.chapterId,
        title: bookPages.title,
        filePath: bookPages.filePath,
        fileSize: bookPages.fileSize,
        width: bookPages.width,
        height: bookPages.height,
        format: bookPages.format,
        thumbnailPath: bookPages.thumbnailPath,
        sortOrder: bookPages.sortOrder,
        isNsfw: bookPages.isNsfw,
        createdAt: bookPages.createdAt,
        updatedAt: bookPages.updatedAt,
        pageId: bookPages.id,
        volumeId: bookChapters.volumeId,
        volumeNumber: bookVolumes.volumeNumber,
        volumeTitle: bookVolumes.title,
        chapterNumber: bookChapters.chapterNumber,
        chapterTitle: bookChapters.title,
      })
      .from(bookPages)
      .innerJoin(bookChapters, eq(bookPages.chapterId, bookChapters.id))
      .leftJoin(bookVolumes, eq(bookChapters.volumeId, bookVolumes.id))
      .where(and(eq(bookPages.bookId, id), bookPageVisibleSql(bookPages.filePath)))
      .orderBy(
        sql`${bookVolumes.id} IS NULL`,
        asc(bookVolumes.volumeNumber),
        asc(bookVolumes.title),
        asc(bookChapters.chapterNumber),
        asc(bookChapters.title),
        asc(bookPages.sortOrder),
        asc(bookPages.id),
      ),
  ]);

  const pagesByChapter = new Map<string, typeof pageRows>();
  for (const page of orderBookArtworkPages(pageRows)) {
    pagesByChapter.set(page.chapterId, [...(pagesByChapter.get(page.chapterId) ?? []), page]);
  }

  const chapters = chapterRows.map((chapter) => {
    const chapterPages = pagesByChapter.get(chapter.id) ?? [];
    const coverPageId = chapter.coverPageId ?? chapterPages[0]?.id ?? null;
    return {
      id: chapter.id,
      bookId: chapter.bookId,
      volumeId: chapter.volumeId,
      title: chapter.title,
      chapterNumber: chapter.chapterNumber,
      archivePath: chapter.archivePath,
      relativePath: chapter.relativePath,
      pageCount: chapter.pageCount,
      coverPageId: chapter.coverPageId,
      coverImagePath: chapter.coverImagePath ?? (coverPageId ? `/assets/book-pages/${coverPageId}/thumb` : null),
      hasCustomCover: Boolean(chapter.coverImagePath),
      pages: chapterPages.map(toPageDto),
    };
  });
  const chaptersByVolume = new Map<string, typeof chapters>();
  for (const chapter of chapters) {
    if (!chapter.volumeId) continue;
    chaptersByVolume.set(chapter.volumeId, [...(chaptersByVolume.get(chapter.volumeId) ?? []), chapter]);
  }
  const volumes: BookVolumeDto[] = volumeRows.map((volume) => {
    const volumeChapters = chaptersByVolume.get(volume.id) ?? [];
    const pageCount = volumeChapters.reduce((sum, chapter) => sum + chapter.pageCount, 0);
    return {
      id: volume.id,
      bookId: volume.bookId,
      volumeNumber: volume.volumeNumber,
      title: volume.title,
      folderPath: volume.folderPath,
      relativePath: volume.relativePath,
      coverImagePath: volume.coverImagePath,
      hasCustomCover: Boolean(volume.coverImagePath),
      pageCount,
      chapterCount: volumeChapters.length,
      externalIds: volume.externalIds ?? {},
      chapters: volumeChapters,
    };
  });

  return {
    ...base,
    folderPath: book.folderPath,
    relativePath: book.relativePath,
    urls: book.urls,
    studio: studioRow[0] ?? null,
    performers: (nsfwMode === "off" ? performerRows.filter((p) => !p.isNsfw) : performerRows),
    volumes,
    chapters,
  };
}

export async function updateBookProgressWrite(
  db: AppDb,
  bookId: string,
  patch: BookProgressPatchDto,
): Promise<BookProgressDto> {
  const [book] = await db
    .select({ id: books.id, pageCount: books.pageCount })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);
  if (!book) throw new NotFoundError("Book not found");

  const readerMode = patch.readerMode === "webtoon" ? "webtoon" : "paged";
  const pageCount = Math.max(0, Math.round(patch.pageCount ?? book.pageCount));
  const pageIndex = Math.min(Math.max(0, Math.round(patch.pageIndex ?? 0)), Math.max(0, pageCount - 1));
  const completedAt =
    patch.completedAt === undefined
      ? pageCount > 0 && pageIndex >= pageCount - 1
        ? new Date()
        : null
      : patch.completedAt
        ? new Date(patch.completedAt)
        : null;

  const [progress] = await db
    .insert(bookReadProgress)
    .values({
      bookId,
      chapterId: patch.chapterId ?? null,
      pageIndex,
      pageCount,
      readerMode,
      completedAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: bookReadProgress.bookId,
      set: {
        chapterId: patch.chapterId ?? null,
        pageIndex,
        pageCount,
        readerMode,
        completedAt,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toProgressDto(progress)!;
}

export async function updateBookWrite(
  db: AppDb,
  id: string,
  patch: {
    title?: string;
    details?: string | null;
    date?: string | null;
    rating?: number | null;
    organized?: boolean;
    isNsfw?: boolean;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
  },
) {
  const [existing] = await db.select({ id: books.id }).from(books).where(eq(books.id, id)).limit(1);
  if (!existing) throw new NotFoundError("Book not found");

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new ValidationError("Title is required");
    update.title = title;
  }
  if (patch.details !== undefined) update.details = patch.details?.trim() || null;
  if (patch.date !== undefined) update.date = patch.date?.trim() || null;
  if (patch.rating !== undefined) update.rating = patch.rating;
  if (patch.organized !== undefined) update.organized = patch.organized;
  if (patch.isNsfw !== undefined) update.isNsfw = patch.isNsfw;
  if (patch.studioName !== undefined) {
    const name = patch.studioName?.trim();
    if (!name) {
      update.studioId = null;
    } else {
      const [existingStudio] = await db
        .select({ id: studios.id })
        .from(studios)
        .where(sql`lower(${studios.name}) = lower(${name})`)
        .limit(1);
      update.studioId =
        existingStudio?.id ??
        (
          await db
            .insert(studios)
            .values({ name, isNsfw: patch.isNsfw ?? false })
            .returning({ id: studios.id })
        )[0]!.id;
      if (patch.isNsfw === true && existingStudio) {
        await db
          .update(studios)
          .set({ isNsfw: true, updatedAt: new Date() })
          .where(eq(studios.id, existingStudio.id));
      }
    }
  }

  if (Object.keys(update).length > 1) {
    await db.update(books).set(update).where(eq(books.id, id));
    if (patch.isNsfw !== undefined) {
      await db.update(bookPages).set({ isNsfw: patch.isNsfw }).where(eq(bookPages.bookId, id));
    }
  }

  if (patch.performerNames) {
    await db.delete(bookPerformers).where(eq(bookPerformers.bookId, id));
    for (const name of patch.performerNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      const [existingPerformer] = await db
        .select({ id: performers.id })
        .from(performers)
        .where(sql`lower(${performers.name}) = lower(${trimmed})`)
        .limit(1);
      const performerId =
        existingPerformer?.id ??
        (
          await db
            .insert(performers)
            .values({ name: trimmed, isNsfw: patch.isNsfw ?? false })
            .returning({ id: performers.id })
        )[0]!.id;
      if (patch.isNsfw === true && existingPerformer) {
        await db
          .update(performers)
          .set({ isNsfw: true, updatedAt: new Date() })
          .where(eq(performers.id, existingPerformer.id));
      }
      await db.insert(bookPerformers).values({ bookId: id, performerId }).onConflictDoNothing();
    }
  }

  if (patch.tagNames) {
    await db.delete(bookTags).where(eq(bookTags.bookId, id));
    for (const name of patch.tagNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      const [existingTag] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(sql`lower(${tags.name}) = lower(${trimmed})`)
        .limit(1);
      const tagId =
        existingTag?.id ??
        (
          await db
            .insert(tags)
            .values({ name: trimmed, isNsfw: patch.isNsfw ?? false })
            .returning({ id: tags.id })
        )[0]!.id;
      if (patch.isNsfw === true && existingTag) {
        await db
          .update(tags)
          .set({ isNsfw: true, updatedAt: new Date() })
          .where(eq(tags.id, existingTag.id));
      }
      await db.insert(bookTags).values({ bookId: id, tagId }).onConflictDoNothing();
    }
  }

  if (patch.isNsfw === true) {
    await db.execute(sql`
      UPDATE studios
      SET is_nsfw = TRUE, updated_at = NOW()
      WHERE id IN (SELECT studio_id FROM books WHERE id = ${id} AND studio_id IS NOT NULL)
    `);
    await db.execute(sql`
      UPDATE performers
      SET is_nsfw = TRUE, updated_at = NOW()
      WHERE id IN (SELECT performer_id FROM book_performers WHERE book_id = ${id})
    `);
    await db.execute(sql`
      UPDATE tags
      SET is_nsfw = TRUE, updated_at = NOW()
      WHERE id IN (SELECT tag_id FROM book_tags WHERE book_id = ${id})
    `);
  }

  return { ok: true as const, id };
}

const BOOK_CHAPTER_COVER_FILE = "cover-custom.jpg";
const BOOK_COVER_FILE = "cover-custom.jpg";

function bookCoverPath(bookId: string) {
  return `/assets/books/${bookId}/cover`;
}

export async function uploadBookCoverWrite(
  db: AppDb,
  bookId: string,
  buffer: Buffer,
) {
  if (!buffer.length) throw new ValidationError("Empty file");
  const [book] = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);
  if (!book) throw new NotFoundError("Book not found");

  const dir = getGeneratedBookDir(bookId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, BOOK_COVER_FILE), buffer);

  const coverImagePath = bookCoverPath(bookId);
  await db
    .update(books)
    .set({ coverPageId: null, coverImagePath, updatedAt: new Date() })
    .where(eq(books.id, bookId));

  return { ok: true as const, coverImagePath };
}

export async function setBookCoverFromUrlWrite(
  db: AppDb,
  bookId: string,
  imageUrl: string,
) {
  let buffer: Buffer;
  if (imageUrl.startsWith("data:image/")) {
    const b64 = imageUrl.split(",")[1];
    if (!b64) throw new ValidationError("Bad data URL");
    buffer = Buffer.from(b64, "base64");
  } else {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new InternalError(`Image download failed: HTTP ${res.status}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  }
  return uploadBookCoverWrite(db, bookId, buffer);
}

function bookChapterCoverPath(chapterId: string) {
  return `/assets/book-chapters/${chapterId}/cover`;
}

function bookVolumeCoverPath(volumeId: string) {
  return `/assets/book-volumes/${volumeId}/cover`;
}

async function deleteBookChapterCustomCoverFile(chapterId: string) {
  const customPath = path.join(getGeneratedBookChapterDir(chapterId), BOOK_CHAPTER_COVER_FILE);
  try {
    if (existsSync(customPath)) await unlink(customPath);
  } catch {
    /* non-fatal */
  }
}

export async function setBookChapterCoverPageWrite(
  db: AppDb,
  chapterId: string,
  pageId: string,
) {
  const [chapter] = await db
    .select({ id: bookChapters.id })
    .from(bookChapters)
    .where(eq(bookChapters.id, chapterId))
    .limit(1);
  if (!chapter) throw new NotFoundError("Chapter not found");

  const [page] = await db
    .select({ id: bookPages.id })
    .from(bookPages)
    .where(and(eq(bookPages.id, pageId), eq(bookPages.chapterId, chapterId)))
    .limit(1);
  if (!page) throw new NotFoundError("Book page not found");

  await deleteBookChapterCustomCoverFile(chapterId);
  await db
    .update(bookChapters)
    .set({
      coverPageId: pageId,
      coverImagePath: null,
      updatedAt: new Date(),
    })
    .where(eq(bookChapters.id, chapterId));

  return {
    ok: true as const,
    coverImagePath: bookPageThumbPath(pageId),
  };
}

export async function uploadBookChapterCoverWrite(
  db: AppDb,
  chapterId: string,
  buffer: Buffer,
) {
  if (!buffer.length) throw new ValidationError("Empty file");
  const [chapter] = await db
    .select({ id: bookChapters.id })
    .from(bookChapters)
    .where(eq(bookChapters.id, chapterId))
    .limit(1);
  if (!chapter) throw new NotFoundError("Chapter not found");

  const dir = getGeneratedBookChapterDir(chapterId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, BOOK_CHAPTER_COVER_FILE), buffer);

  const coverImagePath = bookChapterCoverPath(chapterId);
  await db
    .update(bookChapters)
    .set({
      coverPageId: null,
      coverImagePath,
      updatedAt: new Date(),
    })
    .where(eq(bookChapters.id, chapterId));

  return {
    ok: true as const,
    coverImagePath,
  };
}

export async function setBookChapterCoverFromUrlWrite(
  db: AppDb,
  chapterId: string,
  imageUrl: string,
) {
  let buffer: Buffer;
  if (imageUrl.startsWith("data:image/")) {
    const b64 = imageUrl.split(",")[1];
    if (!b64) throw new ValidationError("Bad data URL");
    buffer = Buffer.from(b64, "base64");
  } else {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new InternalError(`Image download failed: HTTP ${res.status}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  }
  return uploadBookChapterCoverWrite(db, chapterId, buffer);
}

async function deleteBookVolumeCustomCoverFile(volumeId: string) {
  const customPath = path.join(getGeneratedBookVolumeDir(volumeId), BOOK_CHAPTER_COVER_FILE);
  try {
    if (existsSync(customPath)) await unlink(customPath);
  } catch {
    /* non-fatal */
  }
}

export async function uploadBookVolumeCoverWrite(
  db: AppDb,
  volumeId: string,
  buffer: Buffer,
) {
  if (!buffer.length) throw new ValidationError("Empty file");
  const [volume] = await db
    .select({ id: bookVolumes.id })
    .from(bookVolumes)
    .where(eq(bookVolumes.id, volumeId))
    .limit(1);
  if (!volume) throw new NotFoundError("Volume not found");

  const dir = getGeneratedBookVolumeDir(volumeId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, BOOK_CHAPTER_COVER_FILE), buffer);

  const coverImagePath = bookVolumeCoverPath(volumeId);
  await db
    .update(bookVolumes)
    .set({
      coverImagePath,
      updatedAt: new Date(),
    })
    .where(eq(bookVolumes.id, volumeId));

  return {
    ok: true as const,
    coverImagePath,
  };
}

export async function setBookVolumeCoverFromUrlWrite(
  db: AppDb,
  volumeId: string,
  imageUrl: string,
) {
  let buffer: Buffer;
  if (imageUrl.startsWith("data:image/")) {
    const b64 = imageUrl.split(",")[1];
    if (!b64) throw new ValidationError("Bad data URL");
    buffer = Buffer.from(b64, "base64");
  } else {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new InternalError(`Image download failed: HTTP ${res.status}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  }
  return uploadBookVolumeCoverWrite(db, volumeId, buffer);
}

export async function deleteBookVolumeCoverWrite(db: AppDb, volumeId: string) {
  const [volume] = await db
    .select({ id: bookVolumes.id })
    .from(bookVolumes)
    .where(eq(bookVolumes.id, volumeId))
    .limit(1);
  if (!volume) throw new NotFoundError("Volume not found");

  await deleteBookVolumeCustomCoverFile(volumeId);
  await db
    .update(bookVolumes)
    .set({
      coverImagePath: null,
      updatedAt: new Date(),
    })
    .where(eq(bookVolumes.id, volumeId));

  return { ok: true as const };
}

export async function deleteBookChapterCoverWrite(db: AppDb, chapterId: string) {
  const [chapter] = await db
    .select({ id: bookChapters.id })
    .from(bookChapters)
    .where(eq(bookChapters.id, chapterId))
    .limit(1);
  if (!chapter) throw new NotFoundError("Chapter not found");

  await deleteBookChapterCustomCoverFile(chapterId);
  await db
    .update(bookChapters)
    .set({
      coverPageId: null,
      coverImagePath: null,
      updatedAt: new Date(),
    })
    .where(eq(bookChapters.id, chapterId));

  return { ok: true as const };
}

export async function deleteBookWrite(db: AppDb, id: string, deleteFile = false) {
  const [book] = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.id, id))
    .limit(1);
  if (!book) throw new NotFoundError("Book not found");

  const chapters = await db
    .select({ id: bookChapters.id, archivePath: bookChapters.archivePath })
    .from(bookChapters)
    .where(eq(bookChapters.bookId, id));

  if (!deleteFile) {
    for (const chapter of chapters) {
      await ignoreMediaFilePath(db, { path: chapter.archivePath, entityType: "book" });
    }
  }

  const pageRows = await db.select({ id: bookPages.id }).from(bookPages).where(eq(bookPages.bookId, id));
  const volumeRows = await db.select({ id: bookVolumes.id }).from(bookVolumes).where(eq(bookVolumes.bookId, id));
  await db.delete(books).where(eq(books.id, id));

  for (const page of pageRows) {
    await rm(getGeneratedBookPageDir(page.id), {
      recursive: true,
      force: true,
    }).catch(() => undefined);
  }
  for (const chapter of chapters) {
    await rm(getGeneratedBookChapterDir(chapter.id), {
      recursive: true,
      force: true,
    }).catch(() => undefined);
  }
  for (const volume of volumeRows) {
    await rm(getGeneratedBookVolumeDir(volume.id), {
      recursive: true,
      force: true,
    }).catch(() => undefined);
  }

  if (deleteFile) {
    for (const chapter of chapters) {
      if (chapter.archivePath && existsSync(chapter.archivePath)) {
        await unlink(chapter.archivePath).catch(() => undefined);
      }
    }
  }

  return { ok: true as const };
}

export async function uploadRootBookWrite(
  db: AppDb,
  libraryRootId: string,
  file: UploadFileInput,
) {
  const [root] = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.id, libraryRootId))
    .limit(1);
  if (!root) throw new NotFoundError("Library root not found");
  if (!root.enabled) throw new ValidationError("Selected library root is disabled");
  if (!root.scanBooks) {
    throw new ValidationError("Selected library root is not configured to receive book uploads");
  }
  await assertDirExists(root.path);
  const { safeName } = validateUploadInput(file, "book");
  const dest = await resolveCollisionSafePath(root.path, safeName);
  await writeUploadBuffer(dest, file.buffer);
  await enqueueQueueJob(db, {
    queueName: "book-scan",
    data: { libraryRootId: root.id },
    target: { type: "library-root", id: root.id, label: root.label },
    trigger: { by: "manual", label: `Queued after upload to ${root.label}` },
  });
  return { ok: true as const, path: dest, libraryRootId: root.id };
}

export async function uploadBookChapterWrite(
  db: AppDb,
  bookId: string,
  file: UploadFileInput,
) {
  const [book] = await db
    .select({
      id: books.id,
      title: books.title,
      folderPath: books.folderPath,
      libraryRootId: books.libraryRootId,
      isNsfw: books.isNsfw,
    })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);
  if (!book) throw new NotFoundError("Book not found");
  const [root] = await db
    .select()
    .from(libraryRoots)
    .where(eq(libraryRoots.id, book.libraryRootId))
    .limit(1);
  if (!root) throw new NotFoundError("Library root not found");

  const targetDir = book.folderPath ?? root.path;
  await mkdir(targetDir, { recursive: true });
  await assertDirExists(targetDir);
  const { safeName } = validateUploadInput(file, "book");
  const dest = await resolveCollisionSafePath(targetDir, safeName);
  await writeUploadBuffer(dest, file.buffer);

  const chapter = await createChapterFromArchive(db, {
    bookId: book.id,
    archivePath: dest,
    rootPath: root.path,
    isNsfw: book.isNsfw,
  });

  return { ok: true as const, id: chapter.id, bookId: book.id };
}

export async function mergeBooksIntoSeriesWrite(
  db: AppDb,
  body: {
    title: string;
    books: Array<{ id: string; title?: string; sequence?: number }>;
  },
) {
  const title = body.title?.trim();
  if (!title) throw new ValidationError("Book title is required");
  const requested = body.books ?? [];
  if (requested.length < 1) throw new ValidationError("Choose at least one book to merge");
  const requestedIds = [...new Set(requested.map((item) => item.id).filter(Boolean))];

  const bookRows = await db
    .select({
      id: books.id,
      title: books.title,
      libraryRootId: books.libraryRootId,
      folderPath: books.folderPath,
      relativePath: books.relativePath,
      details: books.details,
      date: books.date,
      rating: books.rating,
      organized: books.organized,
      isNsfw: books.isNsfw,
      studioId: books.studioId,
    })
    .from(books)
    .where(inArray(books.id, requestedIds));
  if (bookRows.length !== requestedIds.length) throw new NotFoundError("One or more books were not found");
  const rootIds = new Set(bookRows.map((book) => book.libraryRootId));
  if (rootIds.size !== 1) throw new ValidationError("Selected books must be in the same library root");
  const [root] = await db.select().from(libraryRoots).where(eq(libraryRoots.id, bookRows[0]!.libraryRootId)).limit(1);
  if (!root) throw new NotFoundError("Library root not found");

  const chapterRows = await db
    .select({
      id: bookChapters.id,
      bookId: bookChapters.bookId,
      title: bookChapters.title,
      archivePath: bookChapters.archivePath,
      chapterNumber: bookChapters.chapterNumber,
    })
    .from(bookChapters)
    .where(inArray(bookChapters.bookId, requestedIds))
    .orderBy(asc(bookChapters.chapterNumber), asc(bookChapters.title));
  if (chapterRows.length === 0) throw new ValidationError("Selected books do not have chapters to merge");

  const folderName = sanitizeFolderName(title);
  const firstDir = path.dirname(chapterRows[0]!.archivePath);
  const targetDir =
    path.basename(firstDir).toLowerCase() === folderName.toLowerCase()
      ? firstDir
      : path.join(firstDir, folderName);
  const targetParent = path.dirname(targetDir);
  for (const chapter of chapterRows) {
    const dir = path.dirname(chapter.archivePath);
    if (path.resolve(dir) !== path.resolve(targetDir) && path.resolve(dir) !== path.resolve(targetParent)) {
      throw new ValidationError("Selected books must live in the same folder or target book folder");
    }
  }
  await mkdir(targetDir, { recursive: true });

  const inputById = new Map(requested.map((item, index) => [item.id, { ...item, index }]));
  const targetBook = bookRows.find((book) => path.resolve(book.folderPath ?? "") === path.resolve(targetDir)) ?? bookRows[0]!;
  const movedByArchive = new Map<string, string>();
  for (const chapter of chapterRows) {
    const destination = path.join(targetDir, path.basename(chapter.archivePath));
    if (path.resolve(destination) === path.resolve(chapter.archivePath)) continue;
    if (existsSync(destination)) {
      throw new ValidationError(`A file already exists at ${destination}`);
    }
    await rename(chapter.archivePath, destination);
    movedByArchive.set(chapter.archivePath, destination);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(books)
      .set({
        title,
        folderPath: targetDir,
        relativePath: relativeToRoot(root.path, targetDir),
        isNsfw: bookRows.every((book) => book.isNsfw),
        updatedAt: new Date(),
      })
      .where(eq(books.id, targetBook.id));

    const chaptersByBook = new Map<string, typeof chapterRows>();
    for (const chapter of chapterRows) {
      chaptersByBook.set(chapter.bookId, [...(chaptersByBook.get(chapter.bookId) ?? []), chapter]);
    }
    let sequence = 1;
    for (const book of bookRows.sort((a, b) => (inputById.get(a.id)?.index ?? 0) - (inputById.get(b.id)?.index ?? 0))) {
      const input = inputById.get(book.id);
      for (const chapter of chaptersByBook.get(book.id) ?? []) {
        const archivePath = movedByArchive.get(chapter.archivePath) ?? chapter.archivePath;
        const nextTitle =
          (chaptersByBook.get(book.id)?.length === 1 ? input?.title?.trim() : null) ||
          chapter.title ||
          fileNameToTitle(archivePath);
        await tx
          .update(bookChapters)
          .set({
            bookId: targetBook.id,
            title: nextTitle,
            chapterNumber: sequence,
            archivePath,
            relativePath: relativeToRoot(root.path, archivePath),
            updatedAt: new Date(),
          })
          .where(eq(bookChapters.id, chapter.id));

        const oldPrefix = `${chapter.archivePath}::`;
        const newPrefix = `${archivePath}::`;
        if (oldPrefix !== newPrefix) {
          const pageRows = await tx
            .select({ id: bookPages.id, filePath: bookPages.filePath })
            .from(bookPages)
            .where(eq(bookPages.chapterId, chapter.id));
          for (const page of pageRows) {
            if (!page.filePath.startsWith(oldPrefix)) continue;
            await tx
              .update(bookPages)
              .set({
                bookId: targetBook.id,
                filePath: `${newPrefix}${page.filePath.slice(oldPrefix.length)}`,
                updatedAt: new Date(),
              })
              .where(eq(bookPages.id, page.id));
          }
        } else {
          await tx.update(bookPages).set({ bookId: targetBook.id }).where(eq(bookPages.chapterId, chapter.id));
        }
        sequence += 1;
      }
    }
    const sourceIds = requestedIds.filter((id) => id !== targetBook.id);
    if (sourceIds.length > 0) await tx.delete(books).where(inArray(books.id, sourceIds));
  });

  await refreshBookCounts(db, targetBook.id);
  return { ok: true as const, id: targetBook.id, targetDir };
}

export async function getBookLegacyGalleryRedirectRead(db: AppDb, galleryId: string) {
  const [row] = await db
    .select({
      bookId: bookLegacyGalleryMap.bookId,
      chapterId: bookLegacyGalleryMap.chapterId,
    })
    .from(bookLegacyGalleryMap)
    .where(eq(bookLegacyGalleryMap.galleryId, galleryId))
    .limit(1);
  return row ?? null;
}
