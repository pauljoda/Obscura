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
  "sort",
  "order",
  "limit",
  "offset",
  "nsfw",
  "studio",
  "tag",
  "performer",
  "ratingMin",
  "ratingMax",
  "dateFrom",
  "dateTo",
  "organized",
] as const;

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  const query: ListVideoSeriesQuery = {};
  for (const k of KEYS) {
    if (k === "studio" || k === "tag" || k === "performer") {
      const values = url.searchParams.getAll(k);
      if (values.length > 0) query[k] = values;
    } else {
      const v = url.searchParams.get(k);
      if (v !== null) query[k] = v;
    }
  }
  return json(await listVideoSeriesRead(db, query));
};
