import { db, schema } from "../../db";
import { ilike, or, sql, and, gte, count, ne, desc } from "drizzle-orm";
import type { SearchProvider, SearchProviderQuery, SearchProviderResult } from "../types";
import {
  performerAudioLibraryCountExpr,
  performerImageAppearanceCountExpr,
  performerSfwSceneCountExpr,
} from "../../lib/appearance-count-expressions";

const { performers } = schema;

export const performersSearchProvider: SearchProvider = {
  kind: "performer",
  label: "Actors",
  defaultPreviewLimit: 3,

  async query({ q, limit, offset, filters }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;
    const sfwOnly = filters.nsfw === "off";

    const matchCondition = or(
      ilike(performers.name, term),
      ilike(performers.aliases, term),
      ilike(performers.disambiguation, term),
    )!;

    const conditions = [matchCondition];
    if (filters.rating) conditions.push(gte(performers.rating, filters.rating));
    if (sfwOnly) conditions.push(ne(performers.isNsfw, true));

    const where = and(...conditions);

    const scoreExpr = sql<number>`CASE
      WHEN lower(${performers.name}) = lower(${q}) THEN 100
      WHEN lower(${performers.name}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${performers.name}) LIKE '%' || lower(${q}) || '%' THEN 60
      WHEN ${performers.aliases} IS NOT NULL AND lower(${performers.aliases}) LIKE '%' || lower(${q}) || '%' THEN 50
      ELSE 30
    END`;

    const sceneCountSelect = sfwOnly ? performerSfwSceneCountExpr() : performers.sceneCount;

    const [rows, countResult] = await Promise.all([
      db.select({
        id: performers.id,
        name: performers.name,
        disambiguation: performers.disambiguation,
        gender: performers.gender,
        imagePath: performers.imagePath,
        rating: performers.rating,
        sceneCount: sceneCountSelect,
        imageAppearanceCount: performerImageAppearanceCountExpr(sfwOnly),
        audioLibraryCount: performerAudioLibraryCountExpr(sfwOnly),
        score: scoreExpr,
      })
        .from(performers)
        .where(where)
        .orderBy(desc(scoreExpr), desc(sceneCountSelect))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(performers).where(where),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      total,
      items: rows.map((r) => {
        const sceneCount = Number(r.sceneCount ?? 0);
        const imageAppearanceCount = Number(r.imageAppearanceCount ?? 0);
        const audioLibraryCount = Number(r.audioLibraryCount ?? 0);
        const bits = [
          r.gender,
          sceneCount > 0 ? `${sceneCount} videos` : null,
          imageAppearanceCount > 0 ? `${imageAppearanceCount} images` : null,
          audioLibraryCount > 0 ? `${audioLibraryCount} audio` : null,
        ].filter(Boolean);
        return {
          id: r.id,
          kind: "performer" as const,
          title: r.name,
          subtitle: bits.length > 0 ? bits.join(" · ") : null,
          imagePath: r.imagePath ?? null,
          href: `/performers/${r.id}`,
          rating: r.rating,
          score: r.score,
          meta: {
            gender: r.gender,
            sceneCount,
            imageAppearanceCount,
            audioLibraryCount,
            disambiguation: r.disambiguation,
          },
        };
      }),
    };
  },
};
