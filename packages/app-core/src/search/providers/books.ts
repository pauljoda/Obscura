import { schema, type AppDb } from "@obscura/db";
import {
  and,
  count,
  eq,
  exists,
  gte,
  ilike,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { bookVisibleSql } from "../../library-root-visibility";
import type {
  SearchProvider,
  SearchProviderFactory,
  SearchProviderQuery,
  SearchProviderResult,
} from "../types";

const { books, bookTags, tags } = schema;

export const createBooksSearchProvider: SearchProviderFactory = (
  db: AppDb,
): SearchProvider => ({
  kind: "book",
  label: "Books",
  defaultPreviewLimit: 3,

  async query({
    q,
    limit,
    offset,
    filters,
  }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;
    const matchCondition = or(
      ilike(books.title, term),
      ilike(books.details, term),
      exists(
        db
          .select({ x: sql`1` })
          .from(bookTags)
          .innerJoin(tags, eq(tags.id, bookTags.tagId))
          .where(and(eq(bookTags.bookId, books.id), ilike(tags.name, term))),
      ),
    )!;

    const conditions = [
      eq(books.bookType, "comic"),
      matchCondition,
      bookVisibleSql(books.libraryRootId),
    ];
    if (filters.rating) conditions.push(gte(books.rating, filters.rating));
    if (filters.dateFrom) conditions.push(gte(books.date, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(books.date, filters.dateTo));
    if (filters.nsfw === "off") conditions.push(ne(books.isNsfw, true));

    const where = and(...conditions);
    const scoreExpr = sql<number>`CASE
      WHEN lower(${books.title}) = lower(${q}) THEN 100
      WHEN lower(${books.title}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${books.title}) LIKE '%' || lower(${q}) || '%' THEN 60
      ELSE 40
    END`;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: books.id,
          title: books.title,
          coverImagePath: books.coverImagePath,
          pageCount: books.pageCount,
          chapterCount: books.chapterCount,
          rating: books.rating,
          isNsfw: books.isNsfw,
          score: scoreExpr,
        })
        .from(books)
        .where(where)
        .orderBy(sql`${scoreExpr} DESC`, sql`${books.createdAt} DESC`)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(books).where(where),
    ]);

    return {
      total: countResult[0]?.total ?? 0,
      items: rows.map((row) => ({
        id: row.id,
        kind: "book" as const,
        title: row.title,
        subtitle: `${row.chapterCount} chapter${row.chapterCount === 1 ? "" : "s"} · ${row.pageCount} pages`,
        imagePath: row.coverImagePath,
        href: `/books/${row.id}`,
        rating: row.rating,
        score: row.score,
        meta: {
          pageCount: row.pageCount,
          chapterCount: row.chapterCount,
          bookType: "comic",
          isNsfw: row.isNsfw,
        },
      })),
    };
  },
});
