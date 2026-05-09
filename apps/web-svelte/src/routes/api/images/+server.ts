import { json, type RequestHandler } from "@sveltejs/kit";
import { listImagesRead, type ListImagesQuery } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";

const SCALAR_KEYS = [
  "search",
  "sort",
  "order",
  "gallery",
  "studio",
  "limit",
  "offset",
  "nsfw",
  "ratingMin",
  "ratingMax",
  "dateFrom",
  "dateTo",
  "resolution",
  "organized",
  "comic",
  "animated",
  "randomSeed",
] as const;

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  const query: ListImagesQuery = {};
  for (const key of SCALAR_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null) query[key] = value;
  }
  for (const key of ["tag", "performer", "format", "dimension"] as const) {
    const values = url.searchParams.getAll(key);
    if (values.length === 1) query[key] = values[0];
    else if (values.length > 1) query[key] = values;
  }
  return json(await listImagesRead(db, query));
};
