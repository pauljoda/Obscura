import { json, type RequestHandler } from "@sveltejs/kit";
import {
  listAudioLibrariesRead,
  type ListAudioLibrariesQuery,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";

const SCALAR_KEYS = [
  "search",
  "sort",
  "order",
  "studio",
  "parent",
  "root",
  "limit",
  "offset",
  "ratingMin",
  "ratingMax",
  "dateFrom",
  "dateTo",
  "trackCountMin",
  "organized",
  "nsfw",
  "randomSeed",
] as const;

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  const query: ListAudioLibrariesQuery = {};
  for (const key of SCALAR_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null) query[key] = value;
  }
  for (const key of ["tag", "performer"] as const) {
    const values = url.searchParams.getAll(key);
    if (values.length === 1) query[key] = values[0];
    else if (values.length > 1) query[key] = values;
  }
  return json(await listAudioLibrariesRead(db, query));
};
