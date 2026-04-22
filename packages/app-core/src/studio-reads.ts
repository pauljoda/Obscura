/**
 * Studio read helpers shared by the Fastify API and the SvelteKit server.
 */
import { schema, type AppDb } from "@obscura/db";
import { asc, ne } from "drizzle-orm";
import {
  studioAudioLibraryCountExpr,
  studioImageAppearanceCountExpr,
  studioSfwSceneCountExpr,
  studioTotalSceneCountExpr,
} from "./appearance-count-expressions";

const { studios } = schema;

export interface StudioListEntry {
  id: string;
  name: string;
  description: string | null;
  aliases: string | null;
  url: string | null;
  parentId: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  favorite: boolean;
  rating: number | null;
  isNsfw: boolean;
  videoCount: number;
  imageAppearanceCount: number;
  audioLibraryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function listStudiosRead(
  db: AppDb,
  sfwOnly: boolean,
): Promise<{ studios: StudioListEntry[] }> {
  const rows = await db
    .select({
      id: studios.id,
      name: studios.name,
      description: studios.description,
      aliases: studios.aliases,
      url: studios.url,
      parentId: studios.parentId,
      imageUrl: studios.imageUrl,
      imagePath: studios.imagePath,
      favorite: studios.favorite,
      rating: studios.rating,
      isNsfw: studios.isNsfw,
      videoCount: sfwOnly
        ? studioSfwSceneCountExpr()
        : studioTotalSceneCountExpr(),
      createdAt: studios.createdAt,
      updatedAt: studios.updatedAt,
      imageAppearanceCount: studioImageAppearanceCountExpr(sfwOnly),
      audioLibraryCount: studioAudioLibraryCountExpr(sfwOnly),
    })
    .from(studios)
    .where(sfwOnly ? ne(studios.isNsfw, true) : undefined)
    .orderBy(asc(studios.name));

  return {
    studios: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      aliases: r.aliases,
      url: r.url,
      parentId: r.parentId,
      imageUrl: r.imageUrl,
      imagePath: r.imagePath,
      favorite: r.favorite,
      rating: r.rating,
      isNsfw: r.isNsfw,
      videoCount: Number(r.videoCount ?? 0),
      imageAppearanceCount: Number(r.imageAppearanceCount ?? 0),
      audioLibraryCount: Number(r.audioLibraryCount ?? 0),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
}
