import { json, type RequestHandler } from "@sveltejs/kit";
import {
  createGalleryWrite,
  listGalleriesRead,
  type ListGalleriesQuery,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

const SCALAR_KEYS = [
  "search",
  "sort",
  "order",
  "studio",
  "type",
  "parent",
  "root",
  "limit",
  "offset",
  "ratingMin",
  "ratingMax",
  "dateFrom",
  "dateTo",
  "imageCountMin",
  "organized",
  "isNsfw",
  "nsfw",
  "randomSeed",
] as const;

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  const query: ListGalleriesQuery = {};
  for (const key of SCALAR_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null) query[key] = value;
  }
  for (const key of ["tag", "performer"] as const) {
    const values = url.searchParams.getAll(key);
    if (values.length === 1) query[key] = values[0];
    else if (values.length > 1) query[key] = values;
  }
  return json(await listGalleriesRead(db, query));
};

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  try {
    return json(await createGalleryWrite(db, await request.json()), {
      status: 201,
    });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
