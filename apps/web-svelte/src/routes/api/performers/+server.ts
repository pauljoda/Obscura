import { json, type RequestHandler } from "@sveltejs/kit";
import {
  createPerformerWrite,
  listPerformersRead,
  type CreatePerformerBody,
  type ListPerformersQuery,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

const QUERY_KEYS = [
  "search",
  "sort",
  "order",
  "gender",
  "favorite",
  "isNsfw",
  "country",
  "limit",
  "offset",
  "nsfw",
  "ratingMin",
  "ratingMax",
  "hasImage",
  "videoCountMin",
  "counts",
  "randomSeed",
] as const;

export const GET: RequestHandler = async ({ url }) => {
  const query: ListPerformersQuery = {};
  for (const key of QUERY_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null) query[key] = value;
  }
  const db = await getWebDb();
  return json(await listPerformersRead(db, query));
};

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as CreatePerformerBody;
  try {
    return json(await createPerformerWrite(db, body), { status: 201 });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
