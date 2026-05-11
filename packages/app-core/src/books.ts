import { and, asc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { schema, type AppDb } from "@obscura/db";
import type {
  BookDetailDto,
  BookListItemDto,
  BookPageDto,
  BookProgressDto,
  BookProgressPatchDto,
} from "@obscura/contracts";
import { NotFoundError } from "./errors";
import { bookVisibleSql, bookPageVisibleSql } from "./library-root-visibility";
import {
  buildBooleanCondition,
  buildDateConditions,
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
  bookChapters,
  bookPages,
  bookPerformers,
  bookTags,
  bookReadProgress,
  bookLegacyGalleryMap,
  performers,
  studios,
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

async function decorateBookItems(
  db: AppDb,
  rows: (typeof books.$inferSelect)[],
  nsfwMode?: string,
): Promise<BookListItemDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((book) => book.id);

  const [studioRows, performerRows, tagRows, progressRows] = await Promise.all([
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

  return rows.map((book) => {
    const progress = toProgressDto(progressByBook.get(book.id) ?? null);
    return {
      id: book.id,
      bookType: "comic",
      title: book.title,
      details: book.details,
      coverImagePath: book.coverImagePath,
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
  read?: string;
  randomSeed?: string;
}

export async function listBooksRead(db: AppDb, query: ListBooksQuery) {
  const { limit, offset } = parsePagination(query.limit, query.offset, 60, 200);
  const conditions: SQL[] = [eq(books.bookType, "comic"), bookVisibleSql(books.libraryRootId)];

  if (query.nsfw === "off") conditions.push(ne(books.isNsfw, true));
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

  const [studioRow, performerRows, chapterRows, pageRows] = await Promise.all([
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
      .from(bookChapters)
      .where(eq(bookChapters.bookId, id))
      .orderBy(asc(bookChapters.chapterNumber), asc(bookChapters.title)),
    db
      .select()
      .from(bookPages)
      .where(and(eq(bookPages.bookId, id), bookPageVisibleSql(bookPages.filePath)))
      .orderBy(asc(bookPages.chapterId), asc(bookPages.sortOrder)),
  ]);

  const pagesByChapter = new Map<string, typeof pageRows>();
  for (const page of pageRows) {
    pagesByChapter.set(page.chapterId, [...(pagesByChapter.get(page.chapterId) ?? []), page]);
  }

  return {
    ...base,
    folderPath: book.folderPath,
    relativePath: book.relativePath,
    urls: book.urls,
    studio: studioRow[0] ?? null,
    performers: (nsfwMode === "off" ? performerRows.filter((p) => !p.isNsfw) : performerRows),
    chapters: chapterRows.map((chapter) => ({
      id: chapter.id,
      bookId: chapter.bookId,
      title: chapter.title,
      chapterNumber: chapter.chapterNumber,
      archivePath: chapter.archivePath,
      relativePath: chapter.relativePath,
      pageCount: chapter.pageCount,
      coverImagePath: chapter.coverPageId ? `/assets/book-pages/${chapter.coverPageId}/thumb` : null,
      pages: (pagesByChapter.get(chapter.id) ?? []).map(toPageDto),
    })),
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
