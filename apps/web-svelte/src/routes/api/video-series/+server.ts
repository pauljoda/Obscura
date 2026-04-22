import { json, type RequestHandler } from "@sveltejs/kit";
import {
  listVideoSeriesRead,
  type ListVideoSeriesQuery,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";

const KEYS = [
  "parent",
  "root",
  "search",
  "limit",
  "offset",
  "nsfw",
  "studio",
  "tag",
  "performer",
] as const;

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  const query: ListVideoSeriesQuery = {};
  for (const k of KEYS) {
    const v = url.searchParams.get(k);
    if (v !== null) query[k] = v;
  }
  return json(await listVideoSeriesRead(db, query));
};
