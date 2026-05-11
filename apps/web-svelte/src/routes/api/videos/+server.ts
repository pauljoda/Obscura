import { json, type RequestHandler } from "@sveltejs/kit";
import { listVideosRead, type ListVideosQuery } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

const SCALAR_KEYS = [
  "view",
  "search",
  "sort",
  "order",
  "limit",
  "offset",
  "nsfw",
  "ratingMin",
  "ratingMax",
  "dateFrom",
  "dateTo",
  "durationMin",
  "durationMax",
  "organized",
  "isNsfw",
  "interactive",
  "hasFile",
  "played",
  "videoSeriesId",
  "seriesScope",
  "uncategorized",
  "seasonNumber",
  "randomSeed",
] as const;

const REPEATED_KEYS = [
  "tag",
  "performer",
  "studio",
  "resolution",
  "codec",
] as const;

function readVideosQuery(url: URL): ListVideosQuery {
  const query: ListVideosQuery = {};

  for (const key of SCALAR_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null) {
      (query as Record<string, string | string[]>)[key] = value;
    }
  }

  for (const key of REPEATED_KEYS) {
    const values = url.searchParams.getAll(key);
    if (values.length === 1) {
      (query as Record<string, string | string[]>)[key] = values[0];
    } else if (values.length > 1) {
      (query as Record<string, string | string[]>)[key] = values;
    }
  }

  return query;
}

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  try {
    return json(await listVideosRead(db, readVideosQuery(url)));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
