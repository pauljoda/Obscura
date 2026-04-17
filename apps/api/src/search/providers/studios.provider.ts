import { db, schema } from "../../db";
import { ilike, or, sql, and, gte, count, ne, desc } from "drizzle-orm";
import type { SearchProvider, SearchProviderQuery, SearchProviderResult } from "../types";
import {
  studioAudioLibraryCountExpr,
  studioImageAppearanceCountExpr,
  studioSfwSceneCountExpr,
  studioTotalSceneCountExpr,
} from "../../lib/appearance-count-expressions";

const { studios } = schema;

export const studiosSearchProvider: SearchProvider = {
  kind: "studio",
  label: "Studios",
  defaultPreviewLimit: 3,

  async query({ q, limit, offset, filters }: SearchProviderQuery): Promise<SearchProviderResult> {
    const term = `%${q}%`;
    const sfwOnly = filters.nsfw === "off";

    const matchCondition = or(
      ilike(studios.name, term),
      ilike(studios.aliases, term),
      ilike(studios.description, term),
    )!;

    const conditions = [matchCondition];
    if (filters.rating) conditions.push(gte(studios.rating, filters.rating));
    if (sfwOnly) conditions.push(ne(studios.isNsfw, true));

    const where = and(...conditions);

    const scoreExpr = sql<number>`CASE
      WHEN lower(${studios.name}) = lower(${q}) THEN 100
      WHEN lower(${studios.name}) LIKE lower(${q}) || '%' THEN 80
      WHEN lower(${studios.name}) LIKE '%' || lower(${q}) || '%' THEN 60
      WHEN ${studios.aliases} IS NOT NULL AND lower(${studios.aliases}) LIKE '%' || lower(${q}) || '%' THEN 50
      ELSE 30
    END`;

    const sceneCountSelect = sfwOnly
      ? studioSfwSceneCountExpr()
      : studioTotalSceneCountExpr();

    const [rows, countResult] = await Promise.all([
      db.select({
        id: studios.id,
        name: studios.name,
        imagePath: studios.imagePath,
        rating: studios.rating,
        videoCount: sceneCountSelect,
        imageAppearanceCount: studioImageAppearanceCountExpr(sfwOnly),
        audioLibraryCount: studioAudioLibraryCountExpr(sfwOnly),
        score: scoreExpr,
      })
        .from(studios)
        .where(where)
        .orderBy(desc(scoreExpr), desc(sceneCountSelect))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(studios).where(where),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      total,
      items: rows.map((r) => {
        const videoCount = Number(r.videoCount ?? 0);
        const imageAppearanceCount = Number(r.imageAppearanceCount ?? 0);
        const audioLibraryCount = Number(r.audioLibraryCount ?? 0);
        const bits = [
          videoCount > 0 ? `${videoCount} videos` : null,
          imageAppearanceCount > 0 ? `${imageAppearanceCount} images` : null,
          audioLibraryCount > 0 ? `${audioLibraryCount} audio` : null,
        ].filter(Boolean);
        return {
          id: r.id,
          kind: "studio" as const,
          title: r.name,
          subtitle: bits.length > 0 ? bits.join(" · ") : null,
          imagePath: r.imagePath ?? null,
          href: `/studios/${r.id}`,
          rating: r.rating,
          score: r.score,
          meta: { videoCount, imageAppearanceCount, audioLibraryCount },
        };
      }),
    };
  },
};
